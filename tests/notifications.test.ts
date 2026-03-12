import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { _validateConfig } from "@/config/load-config.ts";
import {
  detectPlatform,
  fireNotifications,
  formatDiscordPayload,
  formatDuration,
  formatGenericPayload,
  formatSlackPayload,
  interpolateUrl,
  type JobEvent,
} from "@/src/notifications.ts";

const baseEvent: JobEvent = {
  jobName: "data-cleanup",
  jobId: "42",
  status: "failed",
  durationMs: 12_500,
  error: "Script exited with code 1",
};

const successEvent: JobEvent = {
  jobName: "data-cleanup",
  jobId: "43",
  status: "completed",
  durationMs: 3_200,
};

// --- Platform detection ---

describe("detectPlatform", () => {
  test("detects Discord webhook URL", () => {
    assert.equal(detectPlatform("https://discord.com/api/webhooks/123/abc"), "discord");
  });

  test("detects Slack webhook URL", () => {
    assert.equal(detectPlatform("https://hooks.slack.com/services/T00/B00/xxx"), "slack");
  });

  test("returns generic for unknown URLs", () => {
    assert.equal(detectPlatform("https://example.com/webhook"), "generic");
  });

  test("returns generic for empty string", () => {
    assert.equal(detectPlatform(""), "generic");
  });
});

// --- Discord formatter ---

describe("formatDiscordPayload", () => {
  test("builds a red embed for failed jobs", () => {
    const payload = formatDiscordPayload(baseEvent) as {
      embeds: { title: string; color: number; fields: { name: string; value: string }[] }[];
    };

    assert.equal(payload.embeds.length, 1);
    const embed = payload.embeds[0];
    assert.equal(embed.color, 0xed4245);
    assert.ok(embed.title.includes("failed"));
    assert.ok(embed.title.includes("data-cleanup"));

    const errorField = embed.fields.find((f) => f.name === "Error");
    assert.ok(errorField);
    assert.ok(errorField.value.includes("Script exited with code 1"));
  });

  test("builds a green embed for completed jobs", () => {
    const payload = formatDiscordPayload(successEvent) as {
      embeds: { color: number; fields: { name: string }[] }[];
    };

    assert.equal(payload.embeds[0].color, 0x57f287);
    const errorField = payload.embeds[0].fields.find((f) => f.name === "Error");
    assert.equal(errorField, undefined);
  });

  test("includes duration field", () => {
    const payload = formatDiscordPayload(baseEvent) as {
      embeds: { fields: { name: string; value: string }[] }[];
    };
    const durationField = payload.embeds[0].fields.find((f) => f.name === "Duration");
    assert.ok(durationField);
    assert.equal(durationField.value, "12.5s");
  });

  test("handles null duration", () => {
    const event: JobEvent = { ...baseEvent, durationMs: null };
    const payload = formatDiscordPayload(event) as {
      embeds: { fields: { name: string }[] }[];
    };
    const durationField = payload.embeds[0].fields.find((f) => f.name === "Duration");
    assert.equal(durationField, undefined);
  });

  test("truncates long error messages", () => {
    const longError = "x".repeat(2000);
    const event: JobEvent = { ...baseEvent, error: longError };
    const payload = formatDiscordPayload(event) as {
      embeds: { fields: { name: string; value: string }[] }[];
    };
    const errorField = payload.embeds[0].fields.find((f) => f.name === "Error");
    assert.ok(errorField);
    assert.ok(errorField.value.length <= 1030 + 6); // 1024 content limit + backtick wrapper
  });
});

// --- Slack formatter ---

describe("formatSlackPayload", () => {
  test("builds blocks with mrkdwn fields for failure", () => {
    const payload = formatSlackPayload(baseEvent) as { blocks: { type: string }[] };

    assert.ok(payload.blocks.length >= 2);
    assert.equal(payload.blocks[0].type, "section");

    const errorBlock = payload.blocks.find(
      (b) =>
        b.type === "section" && (b as { text?: { text?: string } }).text?.text?.includes("Error"),
    );
    assert.ok(errorBlock);
  });

  test("omits error block for successful jobs", () => {
    const payload = formatSlackPayload(successEvent) as { blocks: { type: string }[] };
    const errorBlock = payload.blocks.find(
      (b) =>
        b.type === "section" && (b as { text?: { text?: string } }).text?.text?.includes("Error"),
    );
    assert.equal(errorBlock, undefined);
  });
});

// --- Generic formatter ---

describe("formatGenericPayload", () => {
  test("returns a flat JSON structure", () => {
    const payload = formatGenericPayload(baseEvent) as Record<string, unknown>;

    assert.equal(payload.job_name, "data-cleanup");
    assert.equal(payload.job_id, "42");
    assert.equal(payload.status, "failed");
    assert.equal(payload.duration_ms, 12_500);
    assert.equal(payload.error, "Script exited with code 1");
    assert.ok(payload.timestamp);
  });

  test("sets error to null for successful jobs", () => {
    const payload = formatGenericPayload(successEvent) as Record<string, unknown>;
    assert.equal(payload.error, null);
  });
});

// --- formatDuration ---

describe("formatDuration", () => {
  test("formats milliseconds", () => {
    assert.equal(formatDuration(500), "500ms");
  });

  test("formats seconds", () => {
    assert.equal(formatDuration(12_500), "12.5s");
  });

  test("formats minutes", () => {
    assert.equal(formatDuration(90_000), "1.5m");
  });

  test("edge case: exactly 1 second", () => {
    assert.equal(formatDuration(1_000), "1.0s");
  });
});

// --- URL interpolation ---

describe("interpolateUrl", () => {
  test("resolves ${VAR} from process.env", () => {
    process.env.TEST_WEBHOOK = "https://discord.com/api/webhooks/123/abc";
    assert.equal(interpolateUrl("${TEST_WEBHOOK}"), "https://discord.com/api/webhooks/123/abc");
    delete process.env.TEST_WEBHOOK;
  });

  test("returns empty string for unresolved variable", () => {
    delete process.env.NONEXISTENT_WEBHOOK_VAR;
    assert.equal(interpolateUrl("${NONEXISTENT_WEBHOOK_VAR}"), "");
  });

  test("passes through plain URLs unchanged", () => {
    assert.equal(interpolateUrl("https://example.com/hook"), "https://example.com/hook");
  });

  test("resolves variable embedded in a URL", () => {
    process.env.WEBHOOK_TOKEN = "secret123";
    assert.equal(
      interpolateUrl("https://example.com/${WEBHOOK_TOKEN}"),
      "https://example.com/secret123",
    );
    delete process.env.WEBHOOK_TOKEN;
  });
});

// --- Config validation ---

describe("notification config validation", () => {
  test("accepts valid notifications config", () => {
    const config = _validateConfig({
      jobs: {
        "my-job": {
          command: "echo",
          notifications: {
            on_failure: [{ url: "https://discord.com/api/webhooks/123/abc" }],
            on_success: [{ url: "https://hooks.slack.com/services/T/B/x" }],
          },
        },
      },
    });

    const job = config.jobs["my-job"];
    assert.ok(job.notifications);
    assert.equal(job.notifications.on_failure?.length, 1);
    assert.equal(job.notifications.on_success?.length, 1);
  });

  test("accepts multiple webhooks per event", () => {
    const config = _validateConfig({
      jobs: {
        "my-job": {
          command: "echo",
          notifications: {
            on_failure: [
              { url: "https://discord.com/api/webhooks/123/abc" },
              { url: "https://hooks.slack.com/services/T/B/x" },
              { url: "https://example.com/webhook" },
            ],
          },
        },
      },
    });

    assert.equal(config.jobs["my-job"].notifications?.on_failure?.length, 3);
  });

  test("accepts notifications with only on_failure", () => {
    const config = _validateConfig({
      jobs: {
        "my-job": {
          command: "echo",
          notifications: {
            on_failure: [{ url: "https://example.com/hook" }],
          },
        },
      },
    });

    assert.ok(config.jobs["my-job"].notifications);
    assert.equal(config.jobs["my-job"].notifications?.on_success, undefined);
  });

  test("accepts notifications with only on_success", () => {
    const config = _validateConfig({
      jobs: {
        "my-job": {
          command: "echo",
          notifications: {
            on_success: [{ url: "https://example.com/hook" }],
          },
        },
      },
    });

    assert.ok(config.jobs["my-job"].notifications);
    assert.equal(config.jobs["my-job"].notifications?.on_failure, undefined);
  });

  test("accepts job without notifications", () => {
    const config = _validateConfig({
      jobs: {
        "my-job": { command: "echo" },
      },
    });

    assert.equal(config.jobs["my-job"].notifications, undefined);
  });

  test("throws when notifications is not an object", () => {
    assert.throws(
      () =>
        _validateConfig({
          jobs: { bad: { command: "echo", notifications: "nope" } },
        }),
      /notifications.*must be an object/,
    );
  });

  test("throws when on_failure is not an array", () => {
    assert.throws(
      () =>
        _validateConfig({
          jobs: {
            bad: {
              command: "echo",
              notifications: { on_failure: { url: "https://example.com" } },
            },
          },
        }),
      /on_failure.*must be an array/,
    );
  });

  test("throws when webhook target is missing url", () => {
    assert.throws(
      () =>
        _validateConfig({
          jobs: {
            bad: {
              command: "echo",
              notifications: { on_failure: [{}] },
            },
          },
        }),
      /url.*must be a non-empty string/,
    );
  });

  test("throws when webhook target url is empty", () => {
    assert.throws(
      () =>
        _validateConfig({
          jobs: {
            bad: {
              command: "echo",
              notifications: { on_failure: [{ url: "" }] },
            },
          },
        }),
      /url.*must be a non-empty string/,
    );
  });

  test("throws when webhook target is not an object", () => {
    assert.throws(
      () =>
        _validateConfig({
          jobs: {
            bad: {
              command: "echo",
              notifications: { on_failure: ["https://example.com"] },
            },
          },
        }),
      /must be an object/,
    );
  });
});

// --- fireNotifications (no-op cases) ---

describe("fireNotifications", () => {
  test("does nothing when notifications is undefined", async () => {
    await fireNotifications(undefined, baseEvent);
  });

  test("does nothing when there are no matching targets for the event", async () => {
    await fireNotifications(
      { on_success: [{ url: "https://example.com/hook" }] },
      baseEvent, // status: "failed", so on_success targets shouldn't fire
    );
  });

  test("does nothing for empty target array", async () => {
    await fireNotifications({ on_failure: [] }, baseEvent);
  });
});
