import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CinnamonConfig } from "@/config/define-config.ts";
import { _validateConfig, getScheduledJobs } from "@/config/load-config.ts";

describe("getScheduledJobs", () => {
  test("returns only entries with a schedule field", () => {
    const config: CinnamonConfig = {
      jobs: {
        scheduled: { command: "echo", schedule: "0 * * * *" },
        unscheduled: { command: "echo" },
      },
    };
    const result = getScheduledJobs(config);

    assert.equal(result.length, 1);
    assert.equal(result[0].jobName, "scheduled");
    assert.equal(result[0].pattern, "0 * * * *");
    assert.deepEqual(result[0].data, {});
  });

  test("returns empty array when no jobs have schedules", () => {
    const config: CinnamonConfig = {
      jobs: {
        a: { command: "echo" },
        b: { command: "python3" },
      },
    };
    const result = getScheduledJobs(config);
    assert.equal(result.length, 0);
  });

  test("returns empty array for empty jobs object", () => {
    const config: CinnamonConfig = { jobs: {} };
    const result = getScheduledJobs(config);
    assert.equal(result.length, 0);
  });

  test("returns multiple scheduled jobs", () => {
    const config: CinnamonConfig = {
      jobs: {
        hourly: { command: "echo", schedule: "0 * * * *" },
        daily: { command: "echo", schedule: "0 0 * * *" },
        manual: { command: "echo" },
      },
    };
    const result = getScheduledJobs(config);

    assert.equal(result.length, 2);
    const names = result.map((r) => r.jobName);
    assert.ok(names.includes("hourly"));
    assert.ok(names.includes("daily"));
  });
});

describe("cron validation", () => {
  test("accepts valid 5-field cron expression", () => {
    assert.doesNotThrow(() =>
      _validateConfig({ jobs: { good: { command: "echo", schedule: "0 * * * *" } } }),
    );
  });

  test("accepts cron with step values", () => {
    assert.doesNotThrow(() =>
      _validateConfig({ jobs: { good: { command: "echo", schedule: "*/5 * * * *" } } }),
    );
  });

  test("accepts cron with ranges", () => {
    assert.doesNotThrow(() =>
      _validateConfig({ jobs: { good: { command: "echo", schedule: "0 9-17 * * MON-FRI" } } }),
    );
  });

  test("rejects cron with too few fields", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", schedule: "0 *" } } }),
      /invalid cron expression/i,
    );
  });

  test("rejects cron with too many fields (6 fields)", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", schedule: "0 0 * * * *" } } }),
      /invalid cron expression/i,
    );
  });

  test("rejects non-cron string", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", schedule: "every hour" } } }),
      /invalid cron expression/i,
    );
  });

  test("rejects single word", () => {
    assert.throws(
      () => _validateConfig({ jobs: { bad: { command: "echo", schedule: "midnight" } } }),
      /invalid cron expression/i,
    );
  });
});
