"""
Example script demonstrating the Cinnamon JSON output contract.

Scripts that want structured results stored in jobs_log should print
a single JSON object on the last line of stdout.

Enqueue with parseJsonOutput: true to have the worker parse it:

  POST /v1/enqueue
  { "jobName": "shell", "data": {
      "command": "python3",
      "args": ["./jobs/example-json/example-json.py"],
      "parseJsonOutput": true
  }}
"""

import json
from datetime import datetime, timezone

print("Starting work...")
print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")

result = {
    "status": "ok",
    "items_processed": 42,
    "summary": "Processed 42 items successfully",
}

print(json.dumps(result))
