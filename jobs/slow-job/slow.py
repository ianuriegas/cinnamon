"""
Long-running job for testing cancel and live log streaming.

Prints a line every second for 30 seconds. Trigger from the dashboard
and cancel mid-run to verify partial output is preserved.
"""

import time

TOTAL = 30

for i in range(1, TOTAL + 1):
    print(f"[{i}/{TOTAL}] Working...", flush=True)
    time.sleep(1)

print("Done!")
