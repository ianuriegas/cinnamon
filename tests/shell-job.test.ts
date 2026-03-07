import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runShellJob } from "@/jobs/shell/index.ts";

describe("runShellJob", () => {
  test("runs a python script and captures stdout", async () => {
    const result = await runShellJob({
      command: "python3",
      args: ["./jobs/shell/scripts/hello.py"],
    });

    assert.ok(result.stdout.includes("██"), "expected ASCII art output");
    assert.equal(result.stderr, "");
    assert.equal(result.exitCode, 0);
  });

  test("runs an inline echo command", async () => {
    const result = await runShellJob({
      command: "echo",
      args: ["polyglot"],
    });

    assert.equal(result.stdout, "polyglot\n");
    assert.equal(result.exitCode, 0);
  });

  test("throws when command is missing", async () => {
    await assert.rejects(() => runShellJob({}), {
      message: "Shell job requires a non-empty 'command' string in the payload",
    });
  });

  test("throws when command is an empty string", async () => {
    await assert.rejects(() => runShellJob({ command: "" }), {
      message: "Shell job requires a non-empty 'command' string in the payload",
    });
  });

  test("throws on non-existent script with non-zero exit code", async () => {
    await assert.rejects(() =>
      runShellJob({
        command: "python3",
        args: ["./does-not-exist.py"],
      }),
    );
  });

  test("throws on timeout", async () => {
    await assert.rejects(
      () =>
        runShellJob({
          command: "sleep",
          args: ["10"],
          timeoutMs: 200,
        }),
      (error: Error) => {
        assert.ok(error.message.length > 0);
        return true;
      },
    );
  });
});
