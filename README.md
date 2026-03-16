# cinnamon

A job orchestration framework powered by BullMQ, Postgres, and Hono. Define jobs in a config file, trigger them via CLI, HTTP API, or cron, and monitor everything through a built-in dashboard.

- **Language-agnostic** -- run Python, Bash, Node, or any command. If it runs in a shell, cinnamon can orchestrate it.
- **Multi-tenant** -- teams and API keys isolate workloads. Each job run is scoped to the team that triggered it. The dashboard is team-scoped for regular users; super admins see all.
- **Durable** -- every run is logged to Postgres with status, stdout, stderr, timing, and structured results.
- **Observable** -- query job history, inspect runs, check schedules, and stream live logs through the REST API or dashboard.
- **Notifiable** -- get Slack, Discord, or generic webhook notifications on job success or failure.

## Architecture

```mermaid
flowchart LR
  CLI["CLI"] --> Queue["BullMQ (Redis)"]
  API["API server (Hono)"] -->|"POST /v1/jobs/:name/trigger"| Queue
  Dashboard["Dashboard (React)"] -->|"/api/dashboard/*"| API
  Queue --> Worker[worker]
  Worker --> Handler[job handler]
  Worker --> JobsLog["cinnamon.jobs_log (Postgres)"]
```

## Getting started

Requires [Bun](https://bun.sh).

```bash
bun create cinnamon my-app
cd my-app
```

The wizard lets you choose a setup mode:

- **Docker Image** (recommended) -- runs cinnamon via pre-built Docker image. Requires Docker.
- **Git Submodule** -- pins cinnamon source as a submodule. Run services locally with Bun.
- **Full Source** -- copies the full cinnamon source into your project.

All three modes use the same commands:

```bash
bun run db:migrate
bun run seed:team              # creates a team + API key (save the cin_... key)
bun run dev
```

Open the dashboard at the URL shown after `bun run dev`.

```bash
cinnamon init                   # paste your API key when prompted
cinnamon trigger hello-world    # trigger a job
cinnamon status hello-world     # check the result
```

### Development (clone the repo)

If you want to contribute or work on the framework itself:

```bash
git clone https://github.com/ianuriegas/cinnamon.git
cd cinnamon
bun install
cp .env.example .env
docker compose up -d postgres redis
bun run db:migrate
bun run seed:team
```

Then start the worker and dev server with `bun run dev`.

## How to add a job

Three steps: config, script, trigger.

**1. Define the job** in `cinnamon.config.ts`:

```typescript
export default defineConfig({
  jobs: {
    "my-job": {
      command: "python3",
      script: "./jobs/my-job/my-script.py",
      timeout: "30s",
      description: "My custom job",
    },
  },
});
```

Any command that can run in a shell works -- `python3`, `bash`, `bun`, `node`, `curl`, etc.

**2. Create the script** at the path you specified:

```python
# jobs/my-job/my-script.py
import json

result = {"processed": 42, "status": "ok"}
print(json.dumps(result))  # last line of JSON stdout → stored in jobs_log.result
```

**3. Trigger it:**

```bash
cinnamon trigger my-job              # via CLI
# or
curl -X POST http://localhost:3000/v1/jobs/my-job/trigger \
  -H "Authorization: Bearer cin_<your_key>"
```

Add a `schedule` field (cron syntax) to run it automatically:

```typescript
"my-job": {
  command: "python3",
  script: "./jobs/my-job/my-script.py",
  timeout: "30s",
  schedule: "0 * * * *",  // every hour
},
```

See [Jobs and config](docs/jobs.md) and [Writing scripts](docs/writing-scripts.md) for the full spec.

## Notifications

Jobs can send webhooks on success or failure. Cinnamon auto-detects Discord and Slack URLs and formats messages accordingly; any other URL receives a generic JSON payload.

```typescript
"my-job": {
  command: "python3",
  script: "./jobs/my-job/my-script.py",
  timeout: "30s",
  notifications: {
    on_failure: [{ url: "${DISCORD_WEBHOOK_URL}" }],
    on_success: [{ url: "${SLACK_WEBHOOK_URL}" }],
  },
},
```

`${VAR}` references are resolved from environment variables at runtime.

## Dashboard auth (optional)

The dashboard is open by default for local dev. To require Google sign-in:

1. Place your GCP OAuth `client_secret.json` in the project root (or set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`).
2. Generate a session secret and add it to `.env`:

```bash
bun run generate:secret
```

Paste the output as `SESSION_SECRET` in `.env`.

3. For local dev with `bun run dev` (Vite on port 5173), create `.env.local` with `BASE_URL=http://localhost:5173` so the OAuth callback and session cookie use the same origin. Keep `BASE_URL=http://localhost:3000` in `.env` for Docker/production. `.env.local` overrides `.env` when running locally and is gitignored.

4. Set super-admin emails (these users get full dashboard access on first login):

```
SUPER_ADMINS=you@gmail.com,teammate@gmail.com
```

5. Optionally enable access requests so non-admin users can request dashboard access:

```
ACCESS_REQUESTS_ENABLED=true
```

When `SESSION_SECRET` is unset, auth is disabled and the dashboard remains open.

See [Access requests](docs/access-requests.md) for the full operator guide and `.env.example` for all options.

## Docs

- [API reference](docs/api.md) -- endpoints, query params, and curl examples
- [Jobs and config](docs/jobs.md) -- job definitions, `cinnamon.config.ts`
- [Writing scripts](docs/writing-scripts.md) -- output contract for shell scripts
- [Migrations](docs/migrations.md) -- schema namespacing, dual migration pattern
- [Project structure](docs/project-structure.md) -- directory layout, scripts, CLI
- [Access requests](docs/access-requests.md) -- self-service access request flow for the dashboard
- [Deployment](docs/deploy.md) -- Docker Compose and CI/CD overview
- [Resilience](docs/resilience.md) -- zombie cleanup and worker self-healing
- [Postgres](docs/postgres.md) -- health checks, SQL shell, queries
- [Redis](docs/redis.md) -- health checks, debugging
- [Tests](docs/tests.md) -- test coverage and details
- [Examples](examples/) -- reference implementations (Spotify integration, deploy configs)
