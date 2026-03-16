# {{PROJECT_NAME}} — Cinnamon (Full Source)

Job orchestration powered by [Cinnamon](https://github.com/ianuriegas/cinnamon). This project contains the full cinnamon source — you own it and can modify anything.

## Quick start

```bash
docker compose up -d postgres redis    # start infra
bun run db:migrate
bun run seed:team                      # save the cin_... API key
bun run dev                            # starts API + worker + scheduler + dashboard
```

Dashboard: http://localhost:5173/dashboard (dev) or http://localhost:3000/dashboard (production)

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Start all services with hot reload + Vite dashboard |
| `bun run worker` | Start only the worker |
| `bun run scheduler` | Start only the scheduler |
| `bun run server` | Start only the API server |
| `bun run db:migrate` | Run database migrations |
| `bun run seed:team` | Create a team + API key |
| `bun run generate:secret` | Generate a session secret for dashboard auth |
| `bun run build:dashboard` | Build the dashboard for production |
| `bun test` | Run the test suite |

## Adding jobs

1. Add an entry to `cinnamon.config.ts`
2. Create the script in `jobs/` (Python, Bash, Node — anything that runs in a shell)
3. Trigger via CLI (`cinnamon trigger <name>`) or API

## Pulling upstream changes

This is a full copy of the cinnamon source. To incorporate upstream updates, add the original repo as a remote and merge:

```bash
git remote add upstream https://github.com/ianuriegas/cinnamon.git
git fetch upstream
git merge upstream/main
```

## Configuration

Edit `.env` for database credentials, webhooks, OAuth settings, and more. See `.env.example` for all options.
