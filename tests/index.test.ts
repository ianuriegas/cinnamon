import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parsePayloadArg } from "@/src/payload.ts";

describe("parsePayloadArg", () => {
  test("returns empty payload when no argument is provided", () => {
    assert.deepEqual(parsePayloadArg(undefined), {});
  });

  test("maps positive integers to a start payload", () => {
    assert.deepEqual(parsePayloadArg("10"), { start: 10 });
  });

  test("parses valid JSON objects", () => {
    assert.deepEqual(parsePayloadArg('{"dryRun":true}'), { dryRun: true });
    assert.deepEqual(parsePayloadArg('{"spotifyUserId":"abc","afterMs":100}'), {
      spotifyUserId: "abc",
      afterMs: 100,
    });
  });

  test("rejects JSON arrays and falls back to string payload", () => {
    assert.deepEqual(parsePayloadArg("[1,2,3]"), { value: "[1,2,3]" });
  });

  test("keeps non-numeric values as a string payload", () => {
    assert.deepEqual(parsePayloadArg("cinnamon"), { value: "cinnamon" });
  });
});
