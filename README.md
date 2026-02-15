# cinnamon

Backend-first BullMQ demo where queued countdown jobs are processed by a worker.

- Redis queue data auto-expires after 12 hours.
- Durable job history is stored in Postgres table `jobs_log`.

## Quick start

Requires Bun and Docker Compose.

1) Install dependencies:

```bash
bun install
```

2) Configure environment variables:

```bash
cp .env.example .env
```

Required values:

```bash
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://cinnamon:change-me@localhost:5432/cinnamon
```

3) Start services:

```bash
docker compose up -d postgres redis
```

4) Run database migrations:

```bash
bun run db:migrate
```

5) Run the worker (terminal 1):

```bash
bun run worker
```

6) Trigger the queue job (terminal 2):

```bash
bun run trigger cinnamon 10
```

Expected result: the worker runs the `cinnamon` job and prints a Cinnamon spinner finale.

Spotify recently played ingestion example:

```bash
bun run trigger spotify-recently-played '{"dryRun":true}'
```

There is currently no built-in cron scheduler in this repo; for now, enqueue `spotify-recently-played` manually or from external automation. A production 30-minute cron/repeat setup will be implemented later.

## Scripts

- `bun run clean`: remove `node_modules`.
- `bun run db:drop`: drop local database objects.
- `bun run db:generate`: generate a migration from schema changes.
- `bun run db:migrate`: apply pending Drizzle migrations.
- `bun run db:reset-local`: drop, recreate, and migrate local database.
- `bun run format`: apply Biome formatting.
- `bun run job`: interactive menu to run a local script from `jobs/`.
- `bun run job:cinnamon -- 5`: run `jobs/cinnamon.ts` directly from 5.
- `bun run job:dry`: interactive menu; requests dry-run mode for supported jobs.
- `bun run lint`: run Biome checks.
- `bun run lint:fix`: run Biome checks and auto-fix.
- `bun run test`: run test suite.
- `bun run trigger <job-name> [payload]`: enqueue a named BullMQ job (example: `bun run trigger cinnamon 10`).
- `bun run trigger spotify-recently-played '{"dryRun":true}'`: test Spotify ingestion without writing rows.
- `bun run typecheck`: run TypeScript checks.
- `bun run worker`: process queued jobs by dispatching to registered handlers.

## Ops docs

- [Postgres checks](docs/postgres.md)
- [Redis checks](docs/redis.md)
- [Spotify recently played ingestion](docs/spotify-recently-played.md)
- [Tests guide](docs/tests.md)
