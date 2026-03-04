# Tests

Uses Bun's built-in test runner. Run with `bun test`.

## Current coverage

- `src/payload.ts` -- payload parsing (`parsePayloadArg`)
- `config/redis.ts` -- Redis URL parsing (`parseRedisConnection`)
- `jobs/cinnamon/` -- start value parsing (`parseStart`)
- `jobs/spotify/recently-played/` -- `afterMs` cursor validation (`toValidAfterMs`)
- `jobs/_shared/` -- direct execution detection (`isDirectExecution`)

## Recommended next tests

- Worker integration: enqueue a job and verify `jobs_log` transitions to `completed`
- Failure path: verify `jobs_log` transitions to `failed`
- Queue retention: confirm completed/failed jobs are removed after retention age
