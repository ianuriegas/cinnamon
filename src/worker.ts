import type { ChildProcess } from "node:child_process";
import { type Job, Worker } from "bullmq";
import { and, eq, lt } from "drizzle-orm";

import { getJobHandlers } from "@/config/dynamic-registry.ts";
import { getRedisConnection } from "@/config/env.ts";
import { loadConfig } from "@/config/load-config.ts";
import {
  CHANNEL_PREFIX,
  closeRedisPublisher,
  createRedisSubscriber,
  getRedisPublisher,
} from "@/config/redis-pubsub.ts";
import { db, pool } from "@/db/index.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import type { ShellJobOptions } from "@/src/executors/shell.ts";
import { JOB_STATUS, type JobData } from "./job-types.ts";
import { captureConsoleLogs } from "./log-capture.ts";
import { fireNotifications, type JobEvent } from "./notifications.ts";
import { jobsQueueName } from "./queue.ts";

const jobHandlers = await getJobHandlers();
const config = await loadConfig();

const STUCK_THRESHOLD_MS = 60_000;

async function recoverStuckJobs(): Promise<void> {
  try {
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const updated = await db
      .update(jobsLog)
      .set({
        status: JOB_STATUS.interrupted,
        error: true,
        result: { message: "Worker restarted; job was interrupted" },
        finishedAt: new Date(),
      })
      .where(and(eq(jobsLog.status, JOB_STATUS.processing), lt(jobsLog.startedAt, threshold)))
      .returning({ jobId: jobsLog.jobId });

    const count = updated.length;
    if (count > 0) {
      console.log(`[worker] Recovered ${count} stuck job(s) → interrupted`);
    }
  } catch (err) {
    console.error("[worker] Failed to recover stuck jobs:", err);
  }
}

await recoverStuckJobs();

const activeJobs = new Map<string, AbortController>();
const procRegistry = new Map<string, ChildProcess>();

function publishLogEvent(jobId: string, event: Record<string, unknown>) {
  try {
    const payload = JSON.stringify(event);
    const pub = getRedisPublisher();
    const bufKey = `${CHANNEL_PREFIX.logbuf}${jobId}`;
    pub.rpush(bufKey, payload);
    pub.publish(`${CHANNEL_PREFIX.logs}${jobId}`, payload);
    if (event.type === "done") {
      pub.expire(bufKey, 300);
    }
  } catch {
    // non-critical — don't block job execution
  }
}

async function upsertProcessingLog(job: Job<JobData>, jobId: string) {
  try {
    await db
      .insert(jobsLog)
      .values({
        jobId,
        teamId: (job.data.teamId as number) ?? null,
        queueName: jobsQueueName,
        jobName: job.name,
        status: JOB_STATUS.processing,
        payload: job.data,
        startedAt: new Date(),
        finishedAt: null,
        error: false,
        result: null,
      })
      .onConflictDoUpdate({
        target: jobsLog.jobId,
        set: {
          teamId: (job.data.teamId as number) ?? null,
          status: JOB_STATUS.processing,
          payload: job.data,
          startedAt: new Date(),
          finishedAt: null,
          error: false,
          result: null,
        },
      });
  } catch (error) {
    console.error(`Failed to upsert processing log for job ${jobId}:`, error);
  }
}

async function markCompleted(jobId: string, result: unknown, logs?: string) {
  try {
    await db
      .update(jobsLog)
      .set({
        status: JOB_STATUS.completed,
        result: result ?? null,
        logs: logs || null,
        error: false,
        finishedAt: new Date(),
      })
      .where(eq(jobsLog.jobId, jobId));
  } catch (error) {
    console.error(`Failed to mark job ${jobId} as completed:`, error);
  }
}

async function markFailed(jobId: string, error: Error, logs?: string) {
  try {
    await db
      .update(jobsLog)
      .set({
        status: JOB_STATUS.failed,
        error: true,
        result: { message: error.message },
        logs: logs || null,
        finishedAt: new Date(),
      })
      .where(eq(jobsLog.jobId, jobId));
  } catch (dbError) {
    console.error(`Failed to mark job ${jobId} as failed:`, dbError);
  }
}

async function markCancelled(jobId: string, logs?: string, partialResult?: unknown) {
  try {
    await db
      .update(jobsLog)
      .set({
        status: JOB_STATUS.cancelled,
        error: false,
        result: partialResult ?? { message: "Job cancelled" },
        logs: logs || null,
        finishedAt: new Date(),
      })
      .where(eq(jobsLog.jobId, jobId));
  } catch (dbError) {
    console.error(`Failed to mark job ${jobId} as cancelled:`, dbError);
  }
}

const jobLogsMap = new Map<string, string>();
const jobLogLinesMap = new Map<string, string[]>();

const worker = new Worker<JobData>(
  jobsQueueName,
  async (job: Job<JobData>) => {
    const jobId = String(job.id ?? "");
    const ac = new AbortController();

    if (jobId) {
      activeJobs.set(jobId, ac);
      jobLogLinesMap.set(jobId, []);
      await upsertProcessingLog(job, jobId);
    }

    const logLines = (jobId ? jobLogLinesMap.get(jobId) : undefined) ?? [];

    try {
      const handler = jobHandlers[job.name];
      if (!handler) {
        throw new Error(`No handler registered for job '${job.name}'`);
      }

      const shellOptions: ShellJobOptions = {
        signal: ac.signal,
        onChunk: (stream, data) => {
          if (jobId) {
            logLines.push(data);
            publishLogEvent(jobId, { type: "chunk", stream, text: data });
          }
        },
        onProcSpawn: jobId
          ? (proc) => {
              procRegistry.set(jobId, proc);
              proc.once("close", () => procRegistry.delete(jobId));
            }
          : undefined,
      };

      const { result } = await captureConsoleLogs(() => handler(job.data, shellOptions), {
        onLine: (line) => {
          if (jobId) {
            logLines.push(`${line}\n`);
            publishLogEvent(jobId, { type: "log", text: line });
          }
        },
      });

      return result;
    } finally {
      if (jobId) {
        if (logLines.length > 0) {
          jobLogsMap.set(jobId, logLines.join(""));
        }
        activeJobs.delete(jobId);
        procRegistry.delete(jobId);
        jobLogLinesMap.delete(jobId);
      }
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
    lockDuration: 30_000,
    stalledInterval: 15_000,
  },
);

worker.on("completed", async (job, result) => {
  const jobId = String(job.id ?? "");
  const logs = jobLogsMap.get(jobId);
  jobLogsMap.delete(jobId);

  console.log(`Job ${job.id} completed.`);
  publishLogEvent(jobId, { type: "done", status: "completed" });

  if (!job.id) return;

  await markCompleted(String(job.id), result, logs);

  const notifications = config.jobs[job.name]?.notifications;
  if (notifications?.on_success?.length) {
    const event: JobEvent = {
      jobName: job.name,
      jobId: String(job.id),
      status: "completed",
      durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null,
      result,
    };
    fireNotifications(notifications, event).catch((err) => {
      console.error(`[notifications] Error dispatching for job ${job.id}:`, err);
    });
  }
});

worker.on("failed", async (job, error) => {
  const jobId = String(job?.id ?? "");
  const logs = jobLogsMap.get(jobId);
  jobLogsMap.delete(jobId);

  const isCancellation = error?.message === "Job cancelled";

  if (isCancellation) {
    console.log(`Job ${job?.id ?? "unknown"} cancelled.`);
    publishLogEvent(jobId, { type: "done", status: "cancelled" });

    if (job?.id) {
      const partialResult = (error as Error & { result?: unknown })?.result;
      await markCancelled(String(job.id), logs, partialResult);
    }
    return;
  }

  console.error(`Job ${job?.id ?? "unknown"} failed:`, error);
  publishLogEvent(jobId, { type: "done", status: "failed" });

  if (!job?.id || !error) return;

  await markFailed(String(job.id), error, logs);

  const notifications = config.jobs[job.name]?.notifications;
  if (notifications?.on_failure?.length) {
    const event: JobEvent = {
      jobName: job.name,
      jobId: String(job.id),
      status: "failed",
      durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null,
      error: error.message,
    };
    fireNotifications(notifications, event).catch((err) => {
      console.error(`[notifications] Error dispatching for job ${job.id}:`, err);
    });
  }
});

// Cancel listener: subscribe to cancel channels and abort matching active jobs
const cancelSub = createRedisSubscriber();
cancelSub.psubscribe(`${CHANNEL_PREFIX.cancel}*`);
cancelSub.on("pmessage", (_pattern: string, channel: string, _message: string) => {
  const jobId = channel.slice(CHANNEL_PREFIX.cancel.length);
  const ac = activeJobs.get(jobId);
  if (ac) {
    console.log(`[cancel] Received cancel signal for job ${jobId}`);
    ac.abort();
  }
});

const SHUTDOWN_KILL_GRACE_MS = 4_000;

const shutdown = async () => {
  console.log("[worker] Shutting down...");

  for (const ac of activeJobs.values()) {
    ac.abort();
  }

  const procs = Array.from(procRegistry.entries());
  if (procs.length > 0) {
    console.log(`[worker] Killing ${procs.length} active child process(es)...`);
    for (const [jobId, proc] of procs) {
      try {
        if (proc.pid && !proc.killed) {
          proc.kill("SIGTERM");
        }
      } catch {
        // Process may have already exited
      }
      procRegistry.delete(jobId);
    }
    await new Promise((r) => setTimeout(r, SHUTDOWN_KILL_GRACE_MS));
    for (const [, proc] of procs) {
      try {
        if (proc.pid && !proc.killed) {
          proc.kill("SIGKILL");
        }
      } catch {
        // ignore
      }
    }
  }

  await worker.close();
  await cancelSub.quit();
  await closeRedisPublisher();
  await pool.end();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
