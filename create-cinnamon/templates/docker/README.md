# {{PROJECT_NAME}} — Cinnamon (Docker mode)

Job orchestration powered by [Cinnamon](https://github.com/ianuriegas/cinnamon).

## Quick start

```bash
bun run dev           # starts all services (pulls latest image automatically)
```

Dashboard: http://localhost:3000/dashboard

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Start all services (Postgres, Redis, API, worker, scheduler) |
| `bun run db:migrate` | Run database migrations |
| `bun run seed:team` | Create a team + API key |
| `bun run worker` | Start only the worker |
| `bun run scheduler` | Start only the scheduler |
| `bun run server` | Start only the API server |
| `bun run logs` | Tail logs from all services |
| `bun run down` | Stop all services |
| `bun run pull` | Pull latest cinnamon image |

## Adding jobs

1. Add an entry to `cinnamon.config.ts`
2. Create the script in `jobs/` (Python, Bash, Node — anything that runs in a shell)
3. Trigger via CLI (`cinnamon trigger <name>`) or API

The `jobs/` directory is volume-mounted into the container, so changes take effect immediately.

## Updating cinnamon

Set `CINNAMON_VERSION` in `.env` to a specific tag, or run `bun run pull` to fetch the latest image.

## Configuration

Edit `.env` for database credentials, webhooks, OAuth settings, and more. See `.env.example` for all options.
