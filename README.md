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

## Scripts

- `bun run trigger <job-name> [payload]`: enqueue a named BullMQ job (example: `bun run trigger cinnamon 10`).
- `bun run worker`: process queued jobs by dispatching to registered handlers.
- `bun run job`: interactive menu to run a local script from `jobs/`.
- `bun run job cinnamon -- 5`: run `jobs/cinnamon.ts` directly from 5.
- `bun run db:migrate`: apply pending Drizzle migrations.
- `bun run db:generate`: generate a migration from schema changes.
- `bun run typecheck`: run TypeScript checks.
- `bun run lint`: run Biome checks.

## Ops docs

- Postgres checks: `docs/postgres.md`
- Redis checks: `docs/redis.md`
- Tests guide: `docs/tests.md`