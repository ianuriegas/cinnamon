# Project Structure

```
cinnamon.config.ts  Job definitions (all jobs: shell, spotify, demo)
config/
  define-config.ts    JobDefinition and CinnamonConfig types
  dynamic-registry.ts Builds the handler registry from native + config jobs
  env.ts              Environment and Redis connection config
  load-config.ts      Config loader with validation
db/
  connection.ts       Shared Postgres pool
  schema/             Drizzle table definitions (jobs_log, teams, api_keys, spotify)
  migrations/         Generated SQL migrations
jobs/
  _shared/            Shared utilities (isDirectExecution)
  cinnamon/           Countdown demo job (config-driven)
  shell/              Shell/process executor (run any command/script)
    scripts/          Example scripts (hello.py, example-json.py)
  spotify/            Spotify job group (config-driven)
    auth.ts             Shared auth (token refresh, profile lookup)
    api.ts              Shared API client (fetchRecentlyPlayed, fetchTopTracks)
    types.ts            Shared Spotify types
    recently-played/    Ingest recently played tracks
    top-tracks/         Snapshot top tracks by time range
  native-handlers.ts  Shell executor registration (framework internal)
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
  middleware/
    auth.ts           Bearer token auth middleware for Hono
  routes/
    jobs.ts           Jobs observability API routes
tests/                Unit and integration tests
docs/                 Documentation
```

## Scripts

| Command                              | Description                                        |
| ------------------------------------ | -------------------------------------------------- |
| `cinnamon <command>`                 | CLI for the Cinnamon API (see below)               |
| `bun run cli`                        | Same as `cinnamon` if not globally linked          |
| `bun run server`                     | Start the HTTP API server                          |
| `bun run worker`                     | Process queued jobs                                |
| `bun run scheduler`                  | Register cron schedules                            |
| `bun run trigger <job-name> [data]`  | Enqueue a named BullMQ job                         |
| `bun run job`                        | Interactive menu to run a local script from `jobs/`|
| `bun run job:cinnamon -- 5`          | Run `jobs/cinnamon.ts` directly from 5             |
| `bun run job:dry`                    | Interactive menu; requests dry-run mode             |
| `bun run scripts/seed-team.ts [name] [label]` | Create a team and API key (default: "Default Team") |
| `bun run auth:spotify`               | Obtain a Spotify refresh token interactively       |
| `bun run db:migrate`                 | Apply pending Drizzle migrations                   |
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
cp .env.example .env   # then fill in credentials
docker compose up -d
```

This will:

1. Start Postgres and Redis
2. Run database migrations (one-shot `migrate` container)
3. Start the API server (HTTP + dashboard on port 3000), worker, and scheduler

Monitor logs:

```bash
docker compose logs -f api worker scheduler
```

Rebuild after code changes:

```bash
docker compose up -d --build
```

### Deploying to a remote machine

1. Install Docker and Docker Compose on the target machine.
2. Clone the repo and create `.env` from `.env.example`.
3. No changes needed for `DATABASE_URL` or `REDIS_URL` -- `docker-compose.yml` overrides them to use internal container hostnames (`postgres`, `redis`).
4. Fill in `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`, and any webhook URLs (`DISCORD_WEBHOOK_URL`, `SLACK_WEBHOOK_URL`).
5. Run `docker compose up -d`.

For CI/CD deployment, see [Deployment](deploy.md).

## Cinnamon CLI

The CLI wraps the HTTP API so engineers don't need to memorize curl commands.

### Setup

```bash
# Add bun's global bin to your PATH (one-time)
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Link the global binary
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
