import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isDirectExecution } from "@/jobs/_shared/is-direct-execution.ts";

describe("isDirectExecution", () => {
  test("returns false for a non-matching import.meta.url", () => {
    assert.equal(isDirectExecution("file:///some/other/path.ts"), false);
  });

  test("returns true when argv[1] matches the resolved file URL", () => {
    const originalArgv1 = process.argv[1];
    try {
      process.argv[1] = new URL(import.meta.url).pathname;
      assert.equal(isDirectExecution(import.meta.url), true);
    } finally {
      process.argv[1] = originalArgv1;
    }
  });
});
