# Tests

This project uses Bun's test runner for unit-level checks.

## Run tests

```bash
bun run test
```

You can also run all quality checks before committing:

```bash
bun run typecheck
bun run lint
bun run test
```

## Current test coverage (areas)

- `src/index.ts`: payload parsing logic (`parsePayloadArg`)
- `config/redis.ts`: Redis connection URL parsing (`parseRedisConnection`)
- `jobs/cinnamon.ts`: start value parsing (`parseStart`)

## Next recommended tests

- Worker integration test that enqueues a job and verifies `jobs_log` transitions to `completed`
- Failure-path integration test that verifies `jobs_log` transitions to `failed`
- Queue retention integration test that confirms completed/failed jobs are removed after retention age
