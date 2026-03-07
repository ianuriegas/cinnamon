# API Reference

The API server (`src/server.ts`) listens on `PORT` (default `3000`). Start it with `bun run server` (production) or `bun run dev` (development with Vite HMR for the dashboard).

## Authentication

All `/v1/*` endpoints require a `Bearer` token in the `Authorization` header. The server hashes the key with SHA-256 and looks it up in the `api_keys` table.

```
Authorization: Bearer cin_<your_key>
```

Generate a key with the seed script:

```bash
bun run scripts/seed-team.ts
bun run scripts/seed-team.ts "Acme Corp"
bun run scripts/seed-team.ts "Acme Corp" "acme-ci"
```

- No arguments uses "Default Team".
- First argument sets a custom team name.
- Second argument sets a custom key label.

## Endpoints

| Method | Path                       | Auth     | Description                          |
| ------ | -------------------------- | -------- | ------------------------------------ |
| GET    | `/health`                  | None     | Health check                         |
| POST   | `/v1/enqueue`              | Required | Enqueue a job by handler name        |
| GET    | `/v1/jobs`                 | Required | List job runs (paginated, filterable)|
| GET    | `/v1/jobs/:id`             | Required | Get a single job run (full detail)   |
| GET    | `/v1/jobs/definitions`     | Required | List registered job definitions      |
| GET    | `/v1/jobs/schedules`       | Required | List active schedules                |
| POST   | `/v1/jobs/:name/trigger`   | Required | Trigger a job by name                |

---

### GET /health

Returns `{ "status": "ok" }`. No auth required.

---

### POST /v1/enqueue

Enqueue a job by providing a handler name and optional data payload.

**Request body:**

```json
{
  "jobName": "shell",
  "data": { "command": "echo", "args": ["hello"] }
}
```

- `jobName` (required) -- must match a registered handler (native or config-driven).
- `data` (optional) -- arbitrary JSON payload forwarded to the job handler.

**Response (200):**

```json
{ "jobId": "12", "jobName": "shell" }
```

**Example:**

```bash
curl -s -X POST http://localhost:3000/v1/enqueue \
  -H "Authorization: Bearer cin_<your_key>" \
  -H "Content-Type: application/json" \
  -d '{"jobName": "hello-world"}' | jq
```

---

### GET /v1/jobs

List recent job runs for your team, sorted by `created_at` descending. Payload and result fields are truncated in the list view (use the detail endpoint for full output).

**Query parameters:**

| Param    | Default | Description                              |
| -------- | ------- | ---------------------------------------- |
| `limit`  | 20      | Number of results (max 100)              |
| `offset` | 0       | Pagination offset                        |
| `name`   | --      | Filter by job name                       |
| `status` | --      | Filter by status (queued, processing, completed, failed, cancelled) |
| `since`  | --      | ISO timestamp; only runs created after this time |

**Response (200):**

```json
{
  "data": [
    {
      "id": 5,
      "jobId": "37",
      "teamId": 1,
      "queueName": "jobs-queue",
      "jobName": "shell",
      "status": "completed",
      "payload": "...",
      "result": "...",
      "error": false,
      "startedAt": "2025-03-05T22:44:00.000Z",
      "finishedAt": "2025-03-05T22:44:01.000Z",
      "createdAt": "2025-03-05T22:44:00.000Z"
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "total": 1 }
}
```

**Examples:**

List all runs:

```bash
curl -s http://localhost:3000/v1/jobs \
  -H "Authorization: Bearer cin_<your_key>" | jq
```

Filter by name and status:

```bash
curl -s "http://localhost:3000/v1/jobs?name=hello-world&status=failed" \
  -H "Authorization: Bearer cin_<your_key>" | jq
```

Paginate:

```bash
curl -s "http://localhost:3000/v1/jobs?limit=5&offset=10" \
  -H "Authorization: Bearer cin_<your_key>" | jq
```

Since a date:

```bash
curl -s "http://localhost:3000/v1/jobs?since=2025-03-01T00:00:00Z" \
  -H "Authorization: Bearer cin_<your_key>" | jq
```

---

### GET /v1/jobs/:id

Get a single job run by its database ID (numeric) or BullMQ jobId (string). Returns full (non-truncated) payload and result. Only returns jobs belonging to your team.

**Response (200):**

```json
{
  "data": {
    "id": 5,
    "jobId": "37",
    "teamId": 1,
    "queueName": "jobs-queue",
    "jobName": "shell",
    "status": "completed",
    "payload": { "command": "echo", "args": ["hello"], "teamId": 1 },
    "result": { "stdout": "hello\n", "stderr": "", "exitCode": 0 },
    "error": false,
    "startedAt": "2025-03-05T22:44:00.000Z",
    "finishedAt": "2025-03-05T22:44:01.000Z",
    "createdAt": "2025-03-05T22:44:00.000Z"
  }
}
```

**Errors:** 404 if the ID doesn't exist or belongs to another team.

**Example:**

```bash
curl -s http://localhost:3000/v1/jobs/5 \
  -H "Authorization: Bearer cin_<your_key>" | jq
```

---

### GET /v1/jobs/definitions

List all job definitions loaded from `cinnamon.config.ts`. Useful for discovering what jobs are available.

**Response (200):**

```json
{
  "data": [
    {
      "name": "hello-world",
      "command": "python3",
      "script": "./jobs/shell/scripts/hello.py",
      "schedule": null,
      "timeout": "30s",
      "retries": null,
      "description": "Demo Python script"
    }
  ]
}
```

**Example:**

```bash
curl -s http://localhost:3000/v1/jobs/definitions \
  -H "Authorization: Bearer cin_<your_key>" | jq
```

---

### GET /v1/jobs/schedules

List active BullMQ job schedulers with their cron pattern and next run time.

**Response (200):**

```json
{
  "data": [
    {
      "name": "spotify-recently-played",
      "pattern": "0 * * * *",
      "next": "2025-03-06T01:00:00.000Z"
    }
  ]
}
```

**Example:**

```bash
curl -s http://localhost:3000/v1/jobs/schedules \
  -H "Authorization: Bearer cin_<your_key>" | jq
```

---

### POST /v1/jobs/:name/trigger

Trigger a job by name. This is a convenience alias -- it validates the job name, attaches your team ID, and enqueues it.

**Request body (optional):**

```json
{
  "data": { "command": "echo", "args": ["triggered"] }
}
```

The body can be omitted entirely for jobs that don't need extra data.

**Response (200):**

```json
{ "jobId": "38", "jobName": "hello-world" }
```

**Errors:** 400 if the job name doesn't match any registered handler.

**Examples:**

Trigger with no data:

```bash
curl -s -X POST http://localhost:3000/v1/jobs/hello-world/trigger \
  -H "Authorization: Bearer cin_<your_key>" | jq
```

Trigger with data:

```bash
curl -s -X POST http://localhost:3000/v1/jobs/shell/trigger \
  -H "Authorization: Bearer cin_<your_key>" \
  -H "Content-Type: application/json" \
  -d '{"data": {"command": "echo", "args": ["hello from trigger"]}}' | jq
```

---

## Dashboard API

The dashboard API (`/api/dashboard/*`) is served alongside the React SPA. These endpoints power the web dashboard.

When `SESSION_SECRET` and Google OAuth credentials are configured, all `/api/dashboard/*` endpoints require a valid session cookie (Google OAuth sign-in). Mutating endpoints (`POST`) also require a matching `Origin` header (CSRF protection). When those env vars are unset, the dashboard is open — useful for local dev. See `.env.example` for details.

| Method | Path                              | Description                                   |
| ------ | --------------------------------- | --------------------------------------------- |
| GET    | `/api/dashboard/runs`             | List runs (paginated, filterable)             |
| GET    | `/api/dashboard/runs/:id`         | Get a single run by jobId or numeric ID       |
| GET    | `/api/dashboard/runs/:id/raw`     | Raw logs as `text/plain`                      |
| GET    | `/api/dashboard/runs/:id/stream`  | SSE stream of live logs for a run             |
| POST   | `/api/dashboard/runs/:id/cancel`  | Cancel a queued or processing run             |
| GET    | `/api/dashboard/definitions`      | List job definitions from config              |
| GET    | `/api/dashboard/schedules`        | List active schedules with stats              |
| POST   | `/api/dashboard/trigger/:name`    | Trigger a job by name                         |

### GET /api/dashboard/runs/:id/stream

Server-Sent Events stream for real-time log output. Emits three event types:

- `log` — console log lines captured from the job handler
- `chunk` — stdout/stderr chunks from the shell subprocess (includes `stream: "stdout" | "stderr"`)
- `done` — terminal event with final status (`completed`, `failed`, `cancelled`)

If the job is already finished, all stored output is sent as events and the stream closes immediately.

### POST /api/dashboard/runs/:id/cancel

Cancel a running or queued job.

- **Queued jobs** are removed from the BullMQ queue and marked as `cancelled` in the database.
- **Processing jobs** receive a cancel signal via Redis pub-sub. The worker sends SIGTERM to the subprocess, waits 3 seconds, then SIGKILL. Partial output is preserved.

**Response:**

```json
{ "status": "cancelled" }
```

or for processing jobs (cancel is asynchronous):

```json
{ "status": "cancelling" }
```
