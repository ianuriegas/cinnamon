import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { _validateConfig, parseDuration } from "@/config/load-config.ts";

describe("parseDuration", () => {
  test("parses milliseconds", () => {
    assert.equal(parseDuration("500ms"), 500);
  });

  test("parses seconds", () => {
    assert.equal(parseDuration("30s"), 30_000);
  });

  test("parses minutes", () => {
    assert.equal(parseDuration("5m"), 300_000);
  });

  test("parses hours", () => {
    assert.equal(parseDuration("1h"), 3_600_000);
  });

  test("throws on invalid format", () => {
    assert.throws(() => parseDuration("abc"), /Invalid duration/);
  });

  test("throws on missing unit", () => {
    assert.throws(() => parseDuration("30"), /Invalid duration/);
  });

  test("throws on unknown unit", () => {
    assert.throws(() => parseDuration("30d"), /Invalid duration/);
  });

  test("throws on empty string", () => {
    assert.throws(() => parseDuration(""), /Invalid duration/);
  });
});

describe("validateConfig", () => {
  test("accepts a valid config", () => {
    const config = _validateConfig({
      jobs: {
        "my-job": {
          command: "python3",
          script: "./test.py",
          timeout: "30s",
          description: "A test job",
        },
      },
    });

    assert.equal(Object.keys(config.jobs).length, 1);
    assert.equal(config.jobs["my-job"].command, "python3");
  });

  test("accepts a minimal config with only command", () => {
    const config = _validateConfig({
      jobs: {
        minimal: { command: "echo" },
      },
    });

    assert.equal(config.jobs.minimal.command, "echo");
  });

  test("accepts an empty jobs object", () => {
    const config = _validateConfig({ jobs: {} });
    assert.equal(Object.keys(config.jobs).length, 0);
  });

  test("throws when config is not an object", () => {
    assert.throws(() => _validateConfig("bad"), /must be an object/);
  });

  test("throws when jobs field is missing", () => {
    assert.throws(() => _validateConfig({}), /'jobs' field is required/);
  });

  test("throws when command is missing", () => {
    assert.throws(() => _validateConfig({ jobs: { bad: {} } }), /command.*required/i);
  });

  test("throws when command is empty string", () => {
    assert.throws(() => _validateConfig({ jobs: { bad: { command: "" } } }), /command.*required/i);
  });

  test("throws on invalid timeout", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", timeout: "nope" } } }),
      /Invalid duration/,
    );
  });

  test("throws when retries is negative", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", retries: -1 } } }),
      /non-negative integer/,
    );
  });

  test("throws when retries is not an integer", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", retries: 1.5 } } }),
      /non-negative integer/,
    );
  });

  test("accepts all optional fields", () => {
    const config = _validateConfig({
      jobs: {
        full: {
          command: "python3",
          script: "./script.py",
          args: ["--verbose"],
          timeout: "5m",
          retries: 3,
          env: { API_KEY: "secret" },
          cwd: "/tmp",
          description: "Full config",
          parseJsonOutput: true,
          schedule: "0 * * * *",
        },
      },
    });

    const job = config.jobs.full;
    assert.equal(job.command, "python3");
    assert.equal(job.script, "./script.py");
    assert.deepEqual(job.args, ["--verbose"]);
    assert.equal(job.timeout, "5m");
    assert.equal(job.retries, 3);
    assert.deepEqual(job.env, { API_KEY: "secret" });
    assert.equal(job.cwd, "/tmp");
    assert.equal(job.description, "Full config");
    assert.equal(job.parseJsonOutput, true);
    assert.equal(job.schedule, "0 * * * *");
  });
});
