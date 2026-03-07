import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CinnamonConfig } from "@/config/define-config.ts";
import { buildRegistry } from "@/config/dynamic-registry.ts";

describe("buildRegistry", () => {
  test("includes shell native handler when config has no jobs", () => {
    const config: CinnamonConfig = { jobs: {} };
    const registry = buildRegistry(config);

    assert.ok("shell" in registry, "should have shell native handler");
    assert.ok(!("cinnamon" in registry), "cinnamon is now config-driven");
    assert.ok(!("spotify-recently-played" in registry), "spotify jobs are now config-driven");
    assert.ok(!("spotify-top-tracks" in registry), "spotify jobs are now config-driven");
  });

  test("adds config-driven jobs alongside native handlers", () => {
    const config: CinnamonConfig = {
      jobs: {
        "my-script": {
          command: "echo",
          args: ["hello"],
          timeout: "10s",
        },
      },
    };
    const registry = buildRegistry(config);

    assert.ok("my-script" in registry, "should have config-driven job");
    assert.ok("shell" in registry, "native handler preserved");
  });

  test("config-driven handler calls shell with correct payload", async () => {
    const config: CinnamonConfig = {
      jobs: {
        "echo-test": {
          command: "echo",
          args: ["from-config"],
          timeout: "10s",
        },
      },
    };
    const registry = buildRegistry(config);
    const handler = registry["echo-test"];

    const result = (await handler({})) as { stdout: string; exitCode: number };
    assert.equal(result.stdout, "from-config\n");
    assert.equal(result.exitCode, 0);
  });

  test("config-driven handler prepends script to args", async () => {
    const config: CinnamonConfig = {
      jobs: {
        "hello-py": {
          command: "python3",
          script: "./jobs/shell/scripts/hello.py",
          timeout: "10s",
        },
      },
    };
    const registry = buildRegistry(config);
    const result = (await registry["hello-py"]({})) as { stdout: string; exitCode: number };

    assert.ok(result.stdout.includes("██"), "expected ASCII art output");
    assert.equal(result.exitCode, 0);
  });

  test("throws on name collision with native handler", () => {
    const config: CinnamonConfig = {
      jobs: {
        shell: {
          command: "echo",
          args: ["collision"],
        },
      },
    };

    assert.throws(() => buildRegistry(config), /collides with a native handler/);
  });

  test("allows config-driven jobs with previously native names", () => {
    const config: CinnamonConfig = {
      jobs: {
        cinnamon: {
          command: "echo",
          args: ["hello"],
          timeout: "5s",
        },
        "spotify-recently-played": {
          command: "echo",
          args: ["test"],
          timeout: "5s",
        },
      },
    };
    const registry = buildRegistry(config);

    assert.ok("cinnamon" in registry, "cinnamon registered as config job");
    assert.ok("spotify-recently-played" in registry, "spotify registered as config job");
    assert.ok("shell" in registry, "shell native handler still present");
  });
});
