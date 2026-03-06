"""
Minimal shell job example — plain text output (no JSON parsing).

Enqueue without parseJsonOutput (or set it to false):

  POST /v1/enqueue
  { "jobName": "shell", "data": {
      "command": "python3",
      "args": ["./jobs/shell/scripts/hello.py"]
  }}

For structured JSON output, see example-json.py.
"""

print("Hello World")
