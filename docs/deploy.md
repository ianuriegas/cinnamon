# Deployment

Cinnamon ships as a Docker Compose stack. The base `docker-compose.yml` provides Postgres, Redis, migration runner, worker, scheduler, and API server.

## Worker requirements

- **Python jobs with packages** — Jobs that use `uv` (e.g. `require-package-py`) require `uv` in the worker's `PATH`. The Docker image includes Python and uv; for local dev, [install uv](https://docs.astral.sh/uv/getting-started/installation/).
- **Single worker per environment** — If you run multiple workers (e.g. one in Docker, one locally), ensure they have identical `PATH` and tooling. Otherwise failed runs on one worker can overwrite successful retries on another in the database.

## Running locally

For a new project, the fastest path is `bun create cinnamon my-app` -- see the [Quick start](../README.md#quick-start) guide. The sections below cover manual setup for existing clones.

### With Docker Compose

```bash
cp .env.example .env
docker compose up -d postgres redis
bun run db:migrate
```

See the [Quick start](../README.md#quick-start) guide for the full setup.

### Without Docker (Postgres + Redis on host)

Install Postgres and Redis via Homebrew (macOS) or your package manager, then:

```bash
cp .env.example .env
# Set DATABASE_URL and REDIS_URL to localhost (e.g. postgresql://cinnamon@localhost:5432/cinnamon, redis://localhost:6379)
bun run db:migrate
bun run seed:team
bun run worker   # terminal 1
bun run dev      # terminal 2
```

For Python jobs that use `uv`, install [uv](https://docs.astral.sh/uv/getting-started/installation/) and ensure it's in your `PATH` before starting the worker.

## Releases and Docker images

Cinnamon publishes Docker images to GHCR on every tagged release. To create a release:

```bash
bun run release 0.1.0
```

This bumps `package.json` versions, commits, tags, and pushes. The tag push triggers the release workflow (`.github/workflows/release.yml`) which:

1. Runs the full check suite (lint, typecheck, test)
2. Builds multi-arch Docker images (amd64 + arm64) and pushes to `ghcr.io/ianuriegas/cinnamon`
3. Publishes `create-cinnamon` to npm
4. Creates a GitHub Release with an auto-generated changelog

Pull a specific version:

```bash
docker pull ghcr.io/ianuriegas/cinnamon:0.1.0
```

Tags follow semver. The workflow produces `:{version}` (e.g. `:0.2.0`), `:{major}.{minor}` (e.g. `:0.2`), `:latest`, and `:{sha}` tags.

## CI/CD

Cinnamon's checks workflow (`.github/workflows/checks.yml`) runs lint, typecheck, and tests on every push and PR to `main`.

The release workflow (`.github/workflows/release.yml`) handles image builds and GitHub Releases on tag pushes.

For automated deployment, see the reference templates in [`examples/deploy/`](../examples/deploy/):

- [`github-actions/`](../examples/deploy/github-actions/) — SSH-based deploy workflow
- [`kubernetes/`](../examples/deploy/kubernetes/) — minimal K8s manifests (preview)

Copy and adapt these for your own infrastructure.
