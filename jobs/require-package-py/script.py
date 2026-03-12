#!/usr/bin/env python3
"""
Python job that requires an external package (humanize).
Used to test uv package loading in the job runner.

Usage: uv run --project ./jobs/require-package-py ./jobs/require-package-py/script.py [count]
"""

import json
import sys

import humanize


def main() -> None:
    count = 3
    if len(sys.argv) > 1:
        try:
            count = min(max(int(sys.argv[1]), 1), 10)
        except ValueError:
            pass

    numbers = [42, 1_000_000, 1_234_567_890]
    print(f"Generated {count} humanized number(s):")
    for i, n in enumerate(numbers[:count], 1):
        print(f"  {i}. {n} -> {humanize.intcomma(n)}")

    result = [humanize.intcomma(n) for n in numbers[:count]]
    print(f"Done: {json.dumps({'values': result, 'count': len(result)})}")


if __name__ == "__main__":
    main()
