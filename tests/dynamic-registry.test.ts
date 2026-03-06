import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CinnamonConfig } from "@/config/define-config.ts";
import { buildRegistry } from "@/config/dynamic-registry.ts";

describe("buildRegistry", () => {
  test("includes native handlers when config has no jobs", () => {
    const config: CinnamonConfig = { jobs: {} };
    const registry = buildRegistry(config);

    assert.ok("cinnamon" in registry, "should have cinnamon native handler");
    assert.ok("shell" in registry, "should have shell native handler");
    assert.ok("spotify-recently-played" in registry, "should have spotify-recently-played");
    assert.ok("spotify-top-tracks" in registry, "should have spotify-top-tracks");
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
    assert.ok("cinnamon" in registry, "native handlers preserved");
    assert.ok("shell" in registry, "native handlers preserved");
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

    assert.equal(result.stdout, "Hello World\n");
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

  test("throws on collision with cinnamon native handler", () => {
    const config: CinnamonConfig = {
      jobs: {
        cinnamon: {
          command: "echo",
        },
      },
    };

    assert.throws(() => buildRegistry(config), /collides with a native handler/);
  });
});
