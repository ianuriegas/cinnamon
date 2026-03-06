# Writing scripts for Cinnamon

The `shell` job handler runs any command as a subprocess and captures its stdout, stderr, and exit code. This guide explains how to write scripts that return structured results.

## Output contract

1. **Exit code 0** on success. Any non-zero exit code marks the job as failed.
2. **Stdout** is captured in full and saved to `jobs_log.result.stdout`.
3. **Structured results** — if the job is enqueued with `parseJsonOutput: true`, the worker scans stdout (last line first) for a valid JSON object and saves it to `jobs_log.result.parsed`.

## Plain text (default)

Scripts that only need to report a pass/fail can print anything to stdout:

```python
print("Hello World")
```

Enqueue without `parseJsonOutput`:

```json
{
  "jobName": "shell",
  "data": {
    "command": "python3",
    "args": ["./jobs/shell/scripts/hello.py"]
  }
}
```

The full stdout string is stored in `jobs_log.result.stdout`.

## Structured JSON

For machine-readable results, print a single JSON object on the **last line** of stdout:

```python
import json

print("Starting work...")       # log lines are fine
print("Processing items...")

result = {
    "status": "ok",
    "items_processed": 42,
    "summary": "Processed 42 items successfully",
}
print(json.dumps(result))       # must be the last line
```

Enqueue with `parseJsonOutput: true`:

```json
{
  "jobName": "shell",
  "data": {
    "command": "python3",
    "args": ["./jobs/shell/scripts/example-json.py"],
    "parseJsonOutput": true
  }
}
```

The resulting `jobs_log.result` will look like:

```json
{
  "stdout": "Starting work...\nProcessing items...\n{\"status\": \"ok\", ...}\n",
  "stderr": "",
  "exitCode": 0,
  "parsed": {
    "status": "ok",
    "items_processed": 42,
    "summary": "Processed 42 items successfully"
  }
}
```

## Rules for JSON output

- The JSON must be a **single-line object** (starts with `{`).
- It should be the **last** JSON-like line in stdout. The parser scans from the bottom up and returns the first valid match.
- If no valid JSON is found, the job still succeeds but `parsed` will be `null`.
- Arrays are not supported as top-level output — wrap them in an object (e.g. `{"items": [...]}`).

## Timeout

Shell jobs default to a 30-second timeout. Override with `timeoutMs` in the payload:

```json
{
  "jobName": "shell",
  "data": {
    "command": "python3",
    "args": ["./long-running-script.py"],
    "timeoutMs": 120000
  }
}
```

## Example scripts

| Script | Description | JSON output |
| --- | --- | --- |
| `jobs/shell/scripts/hello.py` | Minimal hello world | No |
| `jobs/shell/scripts/example-json.py` | Structured JSON result | Yes |
| `jobs/shell/scripts/slow.py` | Long-running (30s) for testing cancel and live streaming | No |
