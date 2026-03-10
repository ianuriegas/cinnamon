# Project Structure

```
cinnamon.config.ts  Job definitions (shell demo jobs)
config/
  define-config.ts    JobDefinition and CinnamonConfig types
  dynamic-registry.ts Builds the handler registry from native + config jobs
  env.ts              Environment and Redis connection config
  redis.ts            Redis URL parsing (parseRedisConnection)
  redis-pubsub.ts     Redis pub-sub helpers for log streaming and cancel signals
  load-config.ts      Config loader with validation
db/
  connection.ts       Shared Postgres pool
  schema/             Drizzle table definitions (cinnamon.jobs_log, cinnamon.teams, cinnamon.api_keys)
  migrations/         Generated SQL migrations (single 0000 creates cinnamon schema + tables)
jobs/
  _shared/            Shared utilities (isDirectExecution)
  cinnamon/           Countdown demo job (config-driven)
  shell/              Shell/process executor (run any command/script)
    scripts/          Example scripts (hello.py, example-json.py, slow.py)
  native-handlers.ts  Shell executor registration (framework internal)
examples/             Reference implementations (not part of core)
  jobs/spotify/       Spotify integration example
  deploy/docker/         Docker Compose override for submodule usage
  deploy/github-actions/ Reference CI/CD deploy workflow
  deploy/kubernetes/     Minimal K8s manifests (preview)
cli/
  index.ts            CLI entrypoint (arg parsing, command dispatch)
  config.ts           Load ~/.cinnamon/config.json + env var / flag overrides
  client.ts           Thin HTTP client wrapping fetch() with Bearer auth
  format.ts           Table formatting, ANSI status colors
  commands/
    trigger.ts        POST /v1/jobs/:name/trigger
    status.ts         GET /v1/jobs?name=<name> (formatted table)
    logs.ts           GET /v1/jobs/:id (stdout, stderr, exit code)
    jobs.ts           GET /v1/jobs/definitions (table)
    schedules.ts      GET /v1/jobs/schedules (table)
    validate.ts       Validate cinnamon.config.ts locally (no server)
    init.ts           Scaffold ~/.cinnamon/config.json
scripts/              Dev tools (seed team, migration drop, DB reset)
src/
  index.ts            Trigger CLI entrypoint
  server.ts           Hono HTTP API server
  worker.ts           BullMQ worker process
  queue.ts            Queue configuration
  scheduler.ts        Cron schedule registration
  auth.ts             API key verification (SHA-256 hash lookup)
  job-types.ts        Shared job type definitions
  notifications.ts    Webhook dispatcher (Discord, Slack, generic) with retry
  payload.ts          CLI payload parsing
  auth/               Dashboard OAuth (Google) and session management
    dashboard-auth.ts   PKCE, token exchange, JWT session create/verify
    routes.ts           /auth/login, /auth/google, /auth/callback, /auth/logout, /auth/me
    dashboard-middleware.ts  Session cookie guard for /api/dashboard/*
    csrf.ts             Origin/Referer validation on mutating endpoints
  middleware/
    auth.ts           Bearer token auth middleware for Hono
  routes/
    jobs.ts           Jobs observability API routes
  dashboard/          React SPA (Vite + Tailwind + DaisyUI)
    index.html        Vite HTML entry point
    main.tsx          React entry (mounts <App /> into #root)
    App.tsx           React Router routes
    styles.css        Tailwind v4 + DaisyUI v5 + Gruvbox themes
    api.ts            Server-side Hono JSON API (mounted at /api/dashboard, includes cancel + SSE stream)
    layouts/
      BaseLayout.tsx  Shell layout (navbar, theme toggle, <Outlet />)
    pages/            Full-page views (RunsPage, RunDetailPage, etc.)
    components/       Shared UI (StatusBadge, Pagination, TriggerButton, CopyButton, Duration, TimeAgo, ProfileDropdown)
    contexts/         React contexts (TimezoneContext)
    hooks/            usePolling (interval + visibility), useTheme (toggle), useLogStream (SSE), useAuth, useTimezone
    lib/
      api.ts          Client-side fetch wrapper for /api/dashboard/*
      types.ts        Shared TypeScript types
vite.config.js        Vite config (React plugin, Tailwind, API proxy)
tsconfig.dashboard.json  TypeScript config for React JSX (separate from server)
tests/                Unit and integration tests
docs/                 Documentation
```

## Scripts

| Command                              | Description                                        |
| ------------------------------------ | -------------------------------------------------- |
| `cinnamon <command>`                 | CLI for the Cinnamon API (see below)               |
| `bun run cli`                        | Same as `cinnamon` if not globally linked          |
| `bun run dev`                        | Start API server + Vite dashboard (dev mode, HMR)  |
| `bun run server`                     | Start the HTTP API server (serves built dashboard) |
| `bun run dev:dashboard`              | Start Vite dashboard dev server only               |
| `bun run build:dashboard`            | Build dashboard to `dist/client/`                  |
| `bun run worker`                     | Process queued jobs                                |
| `bun run scheduler`                  | Register cron schedules                            |
| `bun run trigger <job-name> [data]`  | Enqueue a named BullMQ job                         |
| `bun run job`                        | Interactive menu to run a local script from `jobs/`|
| `bun run job:cinnamon -- 5`          | Run `jobs/cinnamon.ts` directly from 5             |
| `bun run job:dry`                    | Interactive menu; requests dry-run mode             |
| `bun run scripts/seed-team.ts [name] [label]` | Create a team and API key (default: "Default Team") |
| `bun run generate:secret`            | Generate a random `SESSION_SECRET` for dashboard auth |
| `bun run db:migrate`                 | Apply pending Drizzle migrations                   |
| `bun run cinnamon:migrate`           | Alias for `db:migrate` (for submodule users)       |
| `bun run db:generate`                | Generate a migration from schema changes           |
| `bun run db:drop`                    | Interactively drop the latest migration            |
| `bun run db:reset-local`             | Drop, recreate, and migrate local database         |
| `bun run test`                       | Run test suite                                     |
| `bun run typecheck`                  | Run TypeScript checks                              |
| `bun run lint`                       | Run Biome checks                                   |
| `bun run lint:fix`                   | Run Biome checks and auto-fix                      |
| `bun run format`                     | Apply Biome formatting                             |
| `bun run clean`                      | Remove `node_modules`                              |

## Docker deployment

Run the full stack (Postgres, Redis, API server, worker, scheduler) with a single command:

```bash
cp .env.example .env
docker compose up -d
```

Fill in credentials in `.env` before running.

This will:

1. Start Postgres and Redis
2. Run database migrations (one-shot `migrate` container)
3. Build the dashboard and start the API server (port 3000), worker, and scheduler

Monitor logs:

```bash
docker compose logs -f api worker scheduler
```

Rebuild after code changes:

```bash
docker compose up -d --build --force-recreate
```

> **Note:** `--force-recreate` ensures the scheduler re-runs and reconciles any schedule changes. Without it, Docker may reuse an existing container if the image hash hasn't changed.

### Deploying to a remote machine

1. Install Docker and Docker Compose on the target machine.
2. Clone the repo and create `.env` from `.env.example`.
3. No changes needed for `DATABASE_URL` or `REDIS_URL` -- `docker-compose.yml` overrides them to use internal container hostnames (`postgres`, `redis`).
4. Fill in any webhook URLs (`DISCORD_WEBHOOK_URL`, `SLACK_WEBHOOK_URL`) and other secrets.
5. Run `docker compose up -d`.

For CI/CD deployment, see [Deployment](deploy.md) and the reference templates in [`examples/deploy/`](../examples/deploy/).

## Cinnamon CLI

The CLI wraps the HTTP API so engineers don't need to memorize curl commands.

### Setup

Add bun's global bin to your PATH (one-time), then link the binary:

```bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
bun link
```

Alternatively, run via `bun run cli` without global linking.

### Configuration

The CLI reads connection info from `~/.cinnamon/config.json`:

```json
{
  "api_url": "http://localhost:3000",
  "api_key": "cin_..."
}
```

Generate it interactively with `cinnamon init`, or set `CINNAMON_API_URL` and `CINNAMON_API_KEY` env vars. Flags `--api-url` and `--api-key` override everything.

### Commands

| Command | Description |
| --- | --- |
| `cinnamon trigger <name> [--data '{...}']` | Trigger a job by name |
| `cinnamon status <name> [--limit N]` | Show recent runs for a job |
| `cinnamon logs <id>` | Show full output for a run |
| `cinnamon jobs` | List registered job definitions |
| `cinnamon schedules` | List active cron schedules |
| `cinnamon validate [path]` | Validate `cinnamon.config.ts` locally (no server needed) |
| `cinnamon init` | Set up `~/.cinnamon/config.json` |
| `cinnamon help` | Show usage |
