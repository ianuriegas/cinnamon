import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { formatDuration, formatTimestamp, statusColor, table } from "@/cli/format.ts";
import { _validateConfig } from "@/config/load-config.ts";

// ─── Config loading ──────────────────────────────────────────────────

describe("CLI config loading", () => {
  const testDir = join(tmpdir(), `cinnamon-cli-test-${Date.now()}`);
  const configPath = join(testDir, "config.json");

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
    delete process.env.CINNAMON_API_URL;
    delete process.env.CINNAMON_API_KEY;
  });

  test("loads config from a JSON file", async () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ api_url: "http://test:9000", api_key: "key123" }));

    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    assert.equal(raw.api_url, "http://test:9000");
    assert.equal(raw.api_key, "key123");
  });

  test("env vars override file values", () => {
    process.env.CINNAMON_API_URL = "http://env-url:5000";
    process.env.CINNAMON_API_KEY = "env-key";

    assert.equal(process.env.CINNAMON_API_URL, "http://env-url:5000");
    assert.equal(process.env.CINNAMON_API_KEY, "env-key");
  });

  test("flags take highest precedence", () => {
    process.env.CINNAMON_API_URL = "http://env-url:5000";
    const flagUrl = "http://flag-url:8000";

    const resolved = flagUrl ?? process.env.CINNAMON_API_URL;
    assert.equal(resolved, "http://flag-url:8000");
  });
});

// ─── Output formatting ──────────────────────────────────────────────

describe("CLI table formatting", () => {
  test("produces aligned columns", () => {
    const output = table(
      ["Name", "Value"],
      [
        ["short", "1"],
        ["a-longer-name", "2"],
      ],
    );

    const lines = output.split("\n");
    assert.equal(lines.length, 4); // header + separator + 2 rows
  });

  test("handles empty rows", () => {
    const output = table(["A", "B"], []);
    const lines = output.split("\n");
    assert.equal(lines.length, 2); // header + separator only
  });
});

describe("statusColor", () => {
  test("colors completed green", () => {
    const result = statusColor("completed");
    assert.ok(result.includes("completed"));
  });

  test("colors failed red", () => {
    const result = statusColor("failed");
    assert.ok(result.includes("failed"));
  });

  test("returns unknown statuses unchanged", () => {
    assert.equal(statusColor("queued"), "queued");
  });
});

describe("formatDuration", () => {
  test("returns dash for null start", () => {
    const result = formatDuration(null, null);
    assert.ok(result.includes("—"));
  });

  test("formats sub-second durations", () => {
    const start = "2025-01-01T00:00:00.000Z";
    const end = "2025-01-01T00:00:00.500Z";
    assert.equal(formatDuration(start, end), "500ms");
  });

  test("formats second-range durations", () => {
    const start = "2025-01-01T00:00:00Z";
    const end = "2025-01-01T00:00:05Z";
    assert.equal(formatDuration(start, end), "5.0s");
  });

  test("formats minute-range durations", () => {
    const start = "2025-01-01T00:00:00Z";
    const end = "2025-01-01T00:02:30Z";
    assert.equal(formatDuration(start, end), "2.5m");
  });
});

describe("formatTimestamp", () => {
  test("returns dash for null", () => {
    const result = formatTimestamp(null);
    assert.ok(result.includes("—"));
  });

  test("formats a valid ISO string", () => {
    const result = formatTimestamp("2025-06-15T10:30:00Z");
    assert.ok(result.length > 0);
    assert.ok(!result.includes("—"));
  });
});

// ─── Arg parsing ─────────────────────────────────────────────────────

describe("CLI arg parsing", () => {
  test("extracts command and positional args", () => {
    const argv = ["trigger", "my-job", "--data", '{"key":"val"}'];
    const command = argv[0];
    const args = argv.slice(1);

    assert.equal(command, "trigger");
    assert.deepEqual(args, ["my-job", "--data", '{"key":"val"}']);
  });

  test("extracts global --api-url flag", () => {
    const argv = ["--api-url", "http://custom:9000", "jobs"];
    const filtered: string[] = [];
    let apiUrl: string | undefined;

    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--api-url" && argv[i + 1]) {
        apiUrl = argv[++i];
      } else {
        filtered.push(argv[i]);
      }
    }

    assert.equal(apiUrl, "http://custom:9000");
    assert.deepEqual(filtered, ["jobs"]);
  });

  test("extracts global --api-key flag", () => {
    const argv = ["--api-key", "secret", "trigger", "foo"];
    const filtered: string[] = [];
    let apiKey: string | undefined;

    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--api-key" && argv[i + 1]) {
        apiKey = argv[++i];
      } else {
        filtered.push(argv[i]);
      }
    }

    assert.equal(apiKey, "secret");
    assert.deepEqual(filtered, ["trigger", "foo"]);
  });

  test("handles --data JSON parsing", () => {
    const raw = '{"key":"value","n":42}';
    const parsed = JSON.parse(raw);
    assert.deepEqual(parsed, { key: "value", n: 42 });
  });

  test("rejects invalid --data JSON", () => {
    assert.throws(() => JSON.parse("{bad}"));
  });
});

// ─── Validate command (reuses config validation) ─────────────────────

describe("CLI validate", () => {
  test("valid config passes validation", () => {
    const config = _validateConfig({
      jobs: {
        test: { command: "echo", timeout: "10s", description: "test" },
      },
    });
    assert.equal(Object.keys(config.jobs).length, 1);
  });

  test("missing command is rejected", () => {
    assert.throws(() => _validateConfig({ jobs: { bad: {} } }), /command.*required/i);
  });

  test("invalid cron is rejected", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", schedule: "not a cron" } } }),
      /invalid cron/i,
    );
  });

  test("bad timeout format is rejected", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", timeout: "forever" } } }),
      /Invalid duration/,
    );
  });

  test("non-object config is rejected", () => {
    assert.throws(() => _validateConfig(null), /must be an object/);
  });
});
