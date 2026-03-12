# Resilience: Zombie Cleanup and Worker Self-Healing

## What problems does this solve?

Cinnamon runs jobs by spawning child processes (e.g. `python3 script.py`). Two things can go wrong:

1. **Orphaned child processes** — The worker exits but the child script keeps running, consuming CPU/memory with no parent to manage it.
2. **Stuck "processing" in the dashboard** — The worker crashes and never updates `jobs_log`, so the dashboard shows the job as "processing" forever.

We solve both:

- **Zombie cleanup** kills child processes on graceful shutdown (Ctrl+C / SIGTERM), timeout, or cancel.
- **Worker self-healing** marks orphaned `jobs_log` rows as "interrupted" on startup.

---

## Prerequisites

Before testing, have these running:

| Component        | Required for                         | Start with                |
| ---------------- | ------------------------------------ | ------------------------- |
| Redis            | Queue (required)                     | Your usual Redis setup    |
| Postgres         | `jobs_log` (required)                | Your usual Postgres setup |
| Server           | Dashboard and API (for verification) | `bun run server`          |
| Worker           | Processing jobs (in separate terminal) | `bun run src/worker.ts`   |

`cinnamon trigger` adds jobs directly to the queue, so the server is not required to enqueue. You need the server only if you want to trigger via the dashboard or verify status in the UI.

---

## How BullMQ fits in (important context)

BullMQ has its **own** resilience layer running in Redis, separate from our `jobs_log` in Postgres:

- BullMQ uses **lock renewal**: while a job is processing, the worker periodically renews a lock in Redis (every 15s, lock lasts 30s).
- If a worker dies, the lock expires and BullMQ marks the job as **stalled** in Redis.
- Stalled jobs are automatically **retried** by any available worker.

This means:

| Scenario | BullMQ behavior | Our `jobs_log` behavior |
|----------|----------------|------------------------|
| Ctrl+C (graceful shutdown) | `worker.close()` finishes; job marked cancelled/failed in Redis | Our abort handler marks `cancelled` in Postgres |
| `kill -9` (hard crash) | Lock expires after 30s, job retried by next worker | Row stays `processing` until self-healing or retry overwrites it |
| Worker restarted quickly (<60s) | BullMQ retries the job; new worker picks it up | `upsertProcessingLog` overwrites old row back to `processing`, then `completed` |
| Worker restarted slowly (>60s) | Same as above | `recoverStuckJobs` marks it `interrupted` first; but if BullMQ also retries, the retry overwrites to `processing` then `completed` |

**Key takeaway**: BullMQ retries are **not** something we control from `jobs_log`. A job can be `cancelled` in Postgres but still retry via Redis. When it retries, `upsertProcessingLog` overwrites the old status. This is **by design** — BullMQ ensures jobs eventually complete, even after crashes.

---

## Feature 1: Zombie Cleanup

### What it does

Tracks every spawned child process in a registry (`procRegistry`). On shutdown, timeout, or cancel, kills those processes so they don't outlive the worker.

### Code flow

1. `runShellJob` spawns a child process and calls `onProcSpawn(proc)`.
2. Worker registers it: `procRegistry.set(jobId, proc)`.
3. On `proc.close`, it unregisters: `procRegistry.delete(jobId)`.
4. On shutdown (`SIGINT`/`SIGTERM`):
   - Abort all `activeJobs` (AbortControllers).
   - SIGTERM every process in `procRegistry`.
   - Wait 4 seconds.
   - SIGKILL any that are still alive.
   - Then `worker.close()`.

### How to test (step by step)

**Test: Ctrl+C kills the child process**

```bash
# Terminal 1: start the worker (NOT with --watch, to avoid bun restarting it)
bun run src/worker.ts

# Terminal 2: trigger slow-job from the dashboard or CLI
cinnamon trigger slow-job
# Wait for output like: [shell] Running: python3 ./jobs/shell/scripts/slow.py

# Terminal 3: verify the python process is running
ps aux | grep slow.py
# You should see: python3 ./jobs/shell/scripts/slow.py

# Terminal 1: press Ctrl+C
# You should see:
#   [worker] Shutting down...
#   [worker] Killing 1 active child process(es)...

# Terminal 3: verify the python process is gone
ps aux | grep slow.py
# Should show only the grep line, nothing else
```

**Expected result**: The python process is gone. Dashboard shows job as `cancelled`.

**What if it fails**: If `ps aux | grep slow.py` still shows the python process, zombie cleanup is broken. The child survived the worker shutdown.

> **Important**: Use `bun run src/worker.ts` (not `bun run worker`) for testing.
> The npm script uses `bun run --watch`, which means bun itself is the parent process
> and may interfere with signal handling. For clean testing, run the worker directly.

---

## Feature 2: Worker Self-Healing

### What it does

On startup, before processing any jobs, runs `recoverStuckJobs()`:

1. Finds `jobs_log` rows where `status = 'processing'` AND `started_at` is older than 60 seconds.
2. Updates them to `status = 'interrupted'`, `error = true`, `finished_at = now()`.

### Why the 60-second threshold?

- BullMQ's lock duration is 30 seconds, renewed every 15 seconds.
- If we set the threshold too low, we'd mark jobs as interrupted that are still actively running.
- 60 seconds gives enough buffer: if a job has been "processing" for 60+ seconds with no worker alive, it's definitely orphaned.

### How to test (step by step)

**Test: Hard-kill worker, wait 60s, restart**

```bash
# Terminal 1: start the worker directly (no --watch)
bun run src/worker.ts

# Terminal 2: trigger slow-job
cinnamon trigger slow-job
# Wait for: [shell] Running: python3 ./jobs/shell/scripts/slow.py

# Terminal 2: find the worker PID and hard-kill it
pgrep -f "bun.*src/worker.ts"
# Note the PID, e.g. 12345

kill -9 12345
# Worker is now dead. No graceful shutdown, no cleanup.

# Terminal 2: wait at least 65 seconds
sleep 65

# Terminal 1 (or any): restart the worker
bun run src/worker.ts

# Look for this line in the output:
#   [worker] Recovered 1 stuck job(s) → interrupted

# Check the dashboard: the job should show status "interrupted"
```

**Expected result**: Worker prints "Recovered 1 stuck job(s)" and dashboard shows `interrupted`.

**What can go wrong (and why)**:

1. **You restart too quickly (< 60s)**: `recoverStuckJobs` won't find the job because `started_at` is too recent. Then BullMQ detects the stalled job and retries it. The new worker picks it up, `upsertProcessingLog` overwrites the row back to `processing`, and it eventually completes. Dashboard shows `completed`. This is BullMQ doing its job — the job was retried and succeeded.

2. **You restart after 60s but BullMQ also retries**: `recoverStuckJobs` marks it `interrupted`, but then BullMQ's stalled detection also retries the same job. The new worker picks up the retry, `upsertProcessingLog` overwrites `interrupted` back to `processing`, and it runs again. This is a race condition between our self-healing and BullMQ's retry mechanism.

3. **You use `bun run worker` (with --watch)**: Bun's watch mode restarts the process immediately, which means the restart happens in < 1 second. BullMQ always wins the race and retries the job.

**To reliably see "interrupted"**:
- Use `bun run src/worker.ts` (no --watch).
- Use `kill -9` (not Ctrl+C, which triggers graceful shutdown).
- Wait at least 65 seconds before restarting.
- The job should be one that won't be retried by BullMQ (e.g., `maxStalledCount: 0` on the queue, or the job exhausted its retries).

**Quick test via SQL (no 65s wait)**

Insert a fake stuck row and restart the worker:

```bash
psql $DATABASE_URL -c "
  INSERT INTO cinnamon.jobs_log (job_id, queue_name, job_name, status, started_at, created_at, error)
  VALUES ('test-stuck-' || extract(epoch from now())::int, 'jobs-queue', 'test', 'processing',
          now() - interval '5 minutes', now() - interval '5 minutes', false)
  ON CONFLICT DO NOTHING;
"

bun run src/worker.ts
# Should print: [worker] Recovered 1 stuck job(s) → interrupted
```

Verify: `SELECT job_id, status FROM cinnamon.jobs_log WHERE job_id LIKE 'test-stuck-%';` — status should be `interrupted`.

---

## Feature interaction: BullMQ retries vs self-healing

This is the subtle part. Both systems operate independently:

```
Timeline after kill -9:

T=0     Worker dies. Job "processing" in Postgres, active in Redis.
T=30    BullMQ lock expires. Job marked "stalled" in Redis.
T=45    BullMQ stalled check runs. Job moved to "waiting" for retry.
T=65    You restart the worker.
        → recoverStuckJobs: "processing" row is 65s old → marks "interrupted"
        → BullMQ: sees job in waiting queue → worker picks it up
        → upsertProcessingLog: overwrites "interrupted" → "processing"
        → Job runs to completion → "completed"
```

So self-healing fires correctly, but BullMQ's retry can overwrite it. This is actually **good** in production: the job gets retried and succeeds rather than staying failed. Self-healing's main value is for jobs where:

- BullMQ has already exhausted retries.
- The Redis queue was also cleared (e.g., Redis restart).
- The job was removed from BullMQ but `jobs_log` still says "processing".

---

## Docker

Same behavior as local. The only differences are how you start/stop:

```bash
# Start
docker compose up worker

# Graceful stop (SIGTERM → zombie cleanup runs)
docker compose stop worker

# Hard kill (simulates crash, no cleanup)
docker compose kill worker

# Restart after waiting 65s
sleep 65
docker compose up worker
# Check logs for: [worker] Recovered N stuck job(s) → interrupted
```

---

## Config

| Setting              | Default | Location | Description |
| -------------------- | ------- | -------- | ----------- |
| `STUCK_THRESHOLD_MS` | 60,000 ms | `src/worker.ts` | Only recover jobs stuck in "processing" for longer than this |
| `SHUTDOWN_KILL_GRACE_MS` | 4,000 ms | `src/worker.ts` | Wait this long between SIGTERM and SIGKILL during shutdown |
| `lockDuration` | 30,000 ms | `src/worker.ts` (BullMQ) | How long a job lock lasts before BullMQ considers it stalled |
| `stalledInterval` | 15,000 ms | `src/worker.ts` (BullMQ) | How often BullMQ checks for stalled jobs |
| New status: `interrupted` | — | `src/job-types.ts` | Terminal status for jobs recovered by self-healing |
