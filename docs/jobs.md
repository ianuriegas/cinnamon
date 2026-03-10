# Jobs and Configuration

All jobs are defined in `cinnamon.config.ts` using `defineConfig`. Each job runs as a subprocess via the shell executor, which captures stdout, stderr, and exit code.

## Config-driven jobs

Define jobs in `cinnamon.config.ts` using `defineConfig`:

```ts
import { defineConfig } from "./config/define-config.ts";

export default defineConfig({
  jobs: {
    "hello-world": {
      command: "python3",
      script: "./jobs/shell/scripts/hello.py",
      timeout: "30s",
      description: "Demo Python script",
    },
    "data-cleanup": {
      command: "bash",
      args: ["-c", "echo 'cleaning up...'"],
      retries: 3,
      timeout: "5m",
      schedule: "0 2 * * *",
      description: "Nightly data cleanup",
    },
  },
});
```

### Job definition fields

| Field            | Type                  | Required | Description                                      |
| ---------------- | --------------------- | -------- | ------------------------------------------------ |
| `command`        | string                | Yes      | The executable to run (e.g. `python3`, `bash`)   |
| `script`         | string                | No       | Prepended as the first argument to `command`      |
| `args`           | string[]              | No       | Additional arguments                              |
| `timeout`        | string                | No       | Duration string: `30s`, `5m`, `1h`. Default: 30s |
| `retries`        | number                | No       | Number of retry attempts on failure               |
| `env`            | Record<string,string> | No       | Environment variables for the child process       |
| `cwd`            | string                | No       | Working directory for the child process           |
| `description`    | string                | No       | Human-readable description                        |
| `parseJsonOutput`| boolean               | No       | Parse last JSON line from stdout                  |
| `schedule`       | string                | No       | Cron expression (5 fields) for scheduled runs     |
| `notifications`  | NotificationConfig    | No       | Webhook notifications on success/failure          |

### Environment variable interpolation

Use `${VAR}` in `env` values to reference host environment variables:

```ts
"my-job": {
  command: "printenv",
  args: ["DB_HOST"],
  env: { DB_HOST: "${DATABASE_URL}" },
}
```

Unresolved variables become empty strings.

### Notifications

Jobs can send webhook notifications on success or failure. Each event supports multiple targets. Platform is auto-detected from the URL.

```ts
"data-cleanup": {
  command: "python3",
  script: "./scripts/cleanup.py",
  schedule: "0 2 * * *",
  notifications: {
    on_failure: [
      { url: "${DISCORD_WEBHOOK_URL}" },
      { url: "${SLACK_WEBHOOK_URL}" },
    ],
    on_success: [
      { url: "${DISCORD_WEBHOOK_URL}" },
    ],
  },
}
```

URLs support `${VAR}` interpolation from the host environment, so webhook secrets stay in `.env` (not in config).

**Supported platforms:**

| URL pattern                        | Format                    |
| ---------------------------------- | ------------------------- |
| `discord.com/api/webhooks/...`     | Discord rich embed        |
| `hooks.slack.com/...`              | Slack Block Kit message   |
| Anything else                      | Generic JSON POST         |

Notifications fire after the worker marks a job as completed or failed. Delivery retries up to 2 times with backoff. Webhook failures are logged but never block job execution.

## Shell jobs

The `shell` handler runs any command as a subprocess, capturing stdout, stderr, and exit code. Config-driven jobs use this handler automatically.

### Triggering via CLI

```bash
bun run trigger shell '{"command":"python3","args":["./jobs/shell/scripts/hello.py"]}'
```

### Triggering via API

```bash
curl -s -X POST http://localhost:3000/v1/jobs/shell/trigger \
  -H "Authorization: Bearer cin_<your_key>" \
  -H "Content-Type: application/json" \
  -d '{"data": {"command": "echo", "args": ["hello"]}}' | jq
```

Or use a config-defined job name directly:

```bash
curl -s -X POST http://localhost:3000/v1/jobs/hello-world/trigger \
  -H "Authorization: Bearer cin_<your_key>" | jq
```

### Structured JSON output

Scripts can return structured results by printing a JSON object on the last line of stdout. Set `parseJsonOutput: true` to have the worker parse it into `jobs_log.result.parsed`.

See [Writing scripts](writing-scripts.md) for the full output contract and examples.

## Scheduling

Jobs with a `schedule` field in `cinnamon.config.ts` are automatically registered as BullMQ repeatable jobs when the scheduler runs.

```bash
bun run scheduler
```

The scheduler reconciles active schedules on startup -- it registers desired schedules and removes any stale ones that are no longer in the config.

View active schedules via the API:

```bash
curl -s http://localhost:3000/v1/jobs/schedules \
  -H "Authorization: Bearer cin_<your_key>" | jq
```
