"""
Minimal shell job example — plain text output (no JSON parsing).

Enqueue without parseJsonOutput (or set it to false):

  POST /v1/enqueue
  { "jobName": "shell", "data": {
      "command": "uv",
      "args": ["run", "--project", "./jobs/hello-world", "hello.py"]
  }}

For structured JSON output, see example-json.
"""

import pyfiglet

print(pyfiglet.figlet_format("HELLO", font="ansi_shadow"))
print(pyfiglet.figlet_format("WORLD", font="ansi_shadow"))
