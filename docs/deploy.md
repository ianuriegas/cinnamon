# Deployment

Cinnamon ships as a Docker Compose stack. The base `docker-compose.yml` provides Postgres, Redis, migration runner, worker, scheduler, and API server.

## Running locally

```bash
cp .env.example .env
docker compose up -d
```

See the [Quick start](../README.md#quick-start) for the full setup.

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
