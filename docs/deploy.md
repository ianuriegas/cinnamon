# Deployment

Cinnamon ships as a Docker Compose stack. The base `docker-compose.yml` provides Postgres, Redis, migration runner, worker, scheduler, and API server.

## Worker requirements

- **Python jobs with packages** — Jobs that use `uv` (e.g. `require-package-py`) require `uv` in the worker's `PATH`. The Docker image includes Python and uv; for local dev, [install uv](https://docs.astral.sh/uv/getting-started/installation/).
- **Single worker per environment** — If you run multiple workers (e.g. one in Docker, one locally), ensure they have identical `PATH` and tooling. Otherwise failed runs on one worker can overwrite successful retries on another in the database.

## Running locally

### With Docker Compose

```bash
cp .env.example .env
docker compose up -d postgres redis
bun run db:migrate
```

See the [Quick start](../README.md#quick-start) for the full setup.

### Without Docker (Postgres + Redis on host)

Install Postgres and Redis via Homebrew (macOS) or your package manager, then:

```bash
cp .env.example .env
# Set DATABASE_URL and REDIS_URL to localhost (e.g. postgresql://cinnamon@localhost:5432/cinnamon, redis://localhost:6379)
bun run db:migrate
bun run scripts/seed-team.ts
bun run worker   # terminal 1
bun run dev      # terminal 2
```

For Python jobs that use `uv`, install [uv](https://docs.astral.sh/uv/getting-started/installation/) and ensure it's in your `PATH` before starting the worker.

## Running as a submodule

Use Docker Compose merge to layer your project's config on top of cinnamon:

```bash
docker compose -f cinnamon/docker-compose.yml -f docker-compose.override.yml up -d
```

See [`examples/deploy/docker/`](../examples/deploy/docker/) for a working override template.

## CI/CD

Cinnamon's checks workflow (`.github/workflows/checks.yml`) runs lint, typecheck, and tests on every push.

For automated deployment, see the reference templates in [`examples/deploy/`](../examples/deploy/):

- [`github-actions/`](../examples/deploy/github-actions/) — SSH-based deploy workflow
- [`kubernetes/`](../examples/deploy/kubernetes/) — minimal K8s manifests (preview)

Copy and adapt these for your own infrastructure.
