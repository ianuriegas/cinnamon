# Tests

Uses Bun's built-in test runner. Run with `bun test`.

## Current coverage

- `src/payload.ts` -- payload parsing (`parsePayloadArg`)
- `config/redis.ts` -- Redis URL parsing (`parseRedisConnection`)
- `jobs/cinnamon/` -- start value parsing (`parseStart`)
- `jobs/shell/` -- shell job execution, timeout, error handling (`runShellJob`)
- `jobs/_shared/` -- direct execution detection (`isDirectExecution`)
- `jobs/spotify/recently-played/` -- `afterMs` cursor validation (`toValidAfterMs`)
- `db/schema/` -- multi-tenant schema (teams, api_keys, jobs_log with team_id)
- `src/server.ts` -- API server endpoints (health, auth, enqueue validation)

## Test details

### Shell job tests (`tests/shell-job.test.ts`)

- Runs a Python script and captures stdout
- Runs an inline echo command
- Rejects missing or empty command
- Handles non-existent scripts (non-zero exit)
- Enforces timeout with SIGKILL

### Schema tests (`tests/schema.test.ts`)

- Inserts and queries a team
- Inserts an API key with valid team FK
- Rejects API key with nonexistent team_id
- Inserts a jobs_log entry with team_id
- Backward compatibility with null team_id

### API server tests (`tests/server.test.ts`)

- `GET /health` returns 200
- `POST /v1/enqueue` without auth returns 401
- `POST /v1/enqueue` with invalid key returns 401
- `POST /v1/enqueue` with revoked key returns 401
- `POST /v1/enqueue` with missing jobName returns 400
- `POST /v1/enqueue` with unknown jobName returns 400
- `POST /v1/enqueue` with valid key enqueues a job and returns jobId

## Recommended next tests

- Worker integration: enqueue a job and verify `jobs_log` transitions to `completed`
- Failure path: verify `jobs_log` transitions to `failed`
- Queue retention: confirm completed/failed jobs are removed after retention age
