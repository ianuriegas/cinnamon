# Tests

Uses Bun's built-in test runner. Run with `bun test`.

## Coverage

| File                          | Area                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `src/payload.ts`              | Payload parsing (`parsePayloadArg`)                           |
| `config/redis.ts`             | Redis URL parsing (`parseRedisConnection`)                    |
| `config/load-config.ts`       | Duration parsing, config validation, cron validation          |
| `config/dynamic-registry.ts`  | Registry building, collision detection, config handler wiring |
| `jobs/cinnamon/`              | Start value parsing (`parseStart`)                            |
| `jobs/shell/`                 | Shell job execution, timeout, error handling (`runShellJob`)  |
| `jobs/_shared/`               | Direct execution detection (`isDirectExecution`)              |
| `jobs/spotify/recently-played`| `afterMs` cursor validation (`toValidAfterMs`)                |
| `db/schema/`                  | Multi-tenant schema (teams, api_keys, jobs_log with team_id)  |
| `src/server.ts`               | API server endpoints (health, auth, enqueue validation)       |
| `src/routes/jobs.ts`          | Jobs observability API (list, detail, definitions, schedules, trigger) |
| `src/scheduler.ts`            | Scheduled job extraction from config                          |
| Execution policies            | Env injection, cwd override, env interpolation, job options   |

## Test details

### Config tests (`tests/config.test.ts`)

- Parses duration strings (ms, s, m, h)
- Rejects invalid/empty/unknown duration formats
- Accepts valid config with all optional fields
- Rejects missing or invalid config fields (command, retries, timeout)

### Dynamic registry tests (`tests/dynamic-registry.test.ts`)

- Includes native handlers when config has no jobs
- Adds config-driven jobs alongside native handlers
- Config-driven handler calls shell with correct payload
- Config-driven handler prepends script to args
- Throws on name collision with native handler

### Scheduler tests (`tests/scheduler.test.ts`)

- Extracts only jobs with a schedule field
- Returns empty array when no jobs have schedules
- Accepts valid cron expressions (5-field, steps, ranges)
- Rejects invalid cron expressions (wrong field count, non-cron strings)

### Execution policy tests (`tests/execution-policies.test.ts`)

- `interpolateEnv` replaces `${VAR}` with host env values
- Unresolved variables become empty strings
- Shell job receives injected env variables
- Shell job inherits PATH when env is set
- Shell job runs in specified cwd
- Defaults to current directory when cwd is not set
- `getJobOptions` returns attempts/backoff for jobs with retries
- `getJobOptions` returns undefined for jobs without retries

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
- `POST /v1/enqueue` with invalid/revoked key returns 401
- `POST /v1/enqueue` with missing/unknown jobName returns 400
- `POST /v1/enqueue` with valid key enqueues a job and returns jobId

### Jobs observability API tests (`tests/jobs-api.test.ts`)

- `GET /v1/jobs` returns paginated list scoped to team
- `GET /v1/jobs` respects limit and offset
- `GET /v1/jobs` filters by name, status, and since
- `GET /v1/jobs` does not return other team's jobs
- `GET /v1/jobs/:id` returns full job detail
- `GET /v1/jobs/:id` returns 404 for unknown ID or other team's job
- `GET /v1/jobs/:id` returns 400 for invalid ID
- `GET /v1/jobs/definitions` returns config entries
- `GET /v1/jobs/schedules` returns scheduler list
- `POST /v1/jobs/:name/trigger` enqueues a job
- `POST /v1/jobs/:name/trigger` with empty body succeeds
- `POST /v1/jobs/:name/trigger` with unknown name returns 400
- All endpoints return 401 without auth
