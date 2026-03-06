import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CinnamonConfig } from "@/config/define-config.ts";
import { buildRegistry, getJobOptions, interpolateEnv } from "@/config/dynamic-registry.ts";
import { runShellJob } from "@/jobs/shell/index.ts";

describe("interpolateEnv", () => {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${VAR} interpolation
  test("replaces ${VAR} with process.env value", () => {
    process.env.TEST_INTERP_VAR = "resolved-value";
    // biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${VAR} interpolation
    const result = interpolateEnv({ KEY: "${TEST_INTERP_VAR}" });
    assert.equal(result.KEY, "resolved-value");
    delete process.env.TEST_INTERP_VAR;
  });

  test("replaces multiple variables in one value", () => {
    process.env.PART_A = "hello";
    process.env.PART_B = "world";
    // biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${VAR} interpolation
    const result = interpolateEnv({ GREETING: "${PART_A}-${PART_B}" });
    assert.equal(result.GREETING, "hello-world");
    delete process.env.PART_A;
    delete process.env.PART_B;
  });

  test("unresolved variables become empty strings", () => {
    delete process.env.DOES_NOT_EXIST_XYZ;
    // biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${VAR} interpolation
    const result = interpolateEnv({ KEY: "prefix-${DOES_NOT_EXIST_XYZ}-suffix" });
    assert.equal(result.KEY, "prefix--suffix");
  });

  test("passes through values without variables unchanged", () => {
    const result = interpolateEnv({ PLAIN: "no-variables-here" });
    assert.equal(result.PLAIN, "no-variables-here");
  });
});

describe("shell job env injection", () => {
  test("child process receives injected env variables", async () => {
    const result = await runShellJob({
      command: "printenv",
      args: ["CINNAMON_TEST_VAR"],
      env: { CINNAMON_TEST_VAR: "injected-value" },
    });

    assert.equal(result.stdout.trim(), "injected-value");
    assert.equal(result.exitCode, 0);
  });

  test("child process inherits PATH when env is set", async () => {
    const result = await runShellJob({
      command: "echo",
      args: ["still-works"],
      env: { CUSTOM: "value" },
    });

    assert.equal(result.stdout.trim(), "still-works");
    assert.equal(result.exitCode, 0);
  });
});

describe("shell job cwd override", () => {
  test("child process runs in specified directory", async () => {
    const result = await runShellJob({
      command: "pwd",
      cwd: "/tmp",
    });

    assert.ok(
      result.stdout.trim() === "/tmp" || result.stdout.trim() === "/private/tmp",
      `expected /tmp or /private/tmp, got ${result.stdout.trim()}`,
    );
    assert.equal(result.exitCode, 0);
  });

  test("defaults to current directory when cwd is not set", async () => {
    const result = await runShellJob({ command: "pwd" });

    assert.equal(result.stdout.trim(), process.cwd());
    assert.equal(result.exitCode, 0);
  });
});

describe("getJobOptions", () => {
  test("returns attempts and backoff for job with retries", () => {
    const config: CinnamonConfig = {
      jobs: {
        "retry-job": { command: "echo", retries: 3 },
      },
    };
    const opts = getJobOptions("retry-job", config);

    assert.ok(opts);
    assert.equal(opts.attempts, 3);
    assert.deepEqual(opts.backoff, { type: "exponential", delay: 1000 });
  });

  test("returns undefined for job without retries", () => {
    const config: CinnamonConfig = {
      jobs: {
        "no-retry": { command: "echo" },
      },
    };
    const opts = getJobOptions("no-retry", config);
    assert.equal(opts, undefined);
  });

  test("returns undefined for job with retries: 0", () => {
    const config: CinnamonConfig = {
      jobs: {
        "zero-retry": { command: "echo", retries: 0 },
      },
    };
    const opts = getJobOptions("zero-retry", config);
    assert.equal(opts, undefined);
  });

  test("returns undefined for unknown job name", () => {
    const config: CinnamonConfig = { jobs: {} };
    const opts = getJobOptions("nonexistent", config);
    assert.equal(opts, undefined);
  });
});

describe("config handler threads env and cwd", () => {
  test("config with env passes variables to shell job", async () => {
    const config: CinnamonConfig = {
      jobs: {
        "env-test": {
          command: "printenv",
          args: ["MY_CONFIG_VAR"],
          env: { MY_CONFIG_VAR: "from-config" },
        },
      },
    };
    const registry = buildRegistry(config);
    const result = (await registry["env-test"]({})) as { stdout: string; exitCode: number };

    assert.equal(result.stdout.trim(), "from-config");
    assert.equal(result.exitCode, 0);
  });

  test("config with cwd runs in specified directory", async () => {
    const config: CinnamonConfig = {
      jobs: {
        "cwd-test": {
          command: "pwd",
          cwd: "/tmp",
        },
      },
    };
    const registry = buildRegistry(config);
    const result = (await registry["cwd-test"]({})) as { stdout: string; exitCode: number };

    assert.ok(
      result.stdout.trim() === "/tmp" || result.stdout.trim() === "/private/tmp",
      `expected /tmp or /private/tmp, got ${result.stdout.trim()}`,
    );
    assert.equal(result.exitCode, 0);
  });

  test("config with env interpolation resolves host variables", async () => {
    process.env.CINNAMON_HOST_TEST = "host-value";
    const config: CinnamonConfig = {
      jobs: {
        "interp-test": {
          command: "printenv",
          args: ["RESOLVED"],
          // biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${VAR} interpolation
          env: { RESOLVED: "${CINNAMON_HOST_TEST}" },
        },
      },
    };
    const registry = buildRegistry(config);
    const result = (await registry["interp-test"]({})) as { stdout: string; exitCode: number };

    assert.equal(result.stdout.trim(), "host-value");
    assert.equal(result.exitCode, 0);
    delete process.env.CINNAMON_HOST_TEST;
  });

  test("job without env or cwd behaves like before", async () => {
    const config: CinnamonConfig = {
      jobs: {
        "plain-echo": {
          command: "echo",
          args: ["unchanged"],
          timeout: "10s",
        },
      },
    };
    const registry = buildRegistry(config);
    const result = (await registry["plain-echo"]({})) as { stdout: string; exitCode: number };

    assert.equal(result.stdout.trim(), "unchanged");
    assert.equal(result.exitCode, 0);
  });
});
