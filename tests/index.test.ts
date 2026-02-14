import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parsePayloadArg } from "../src/payload.ts";

describe("parsePayloadArg", () => {
  test("returns empty payload when no argument is provided", () => {
    assert.deepEqual(parsePayloadArg(undefined), {});
  });

  test("maps positive integers to a start payload", () => {
    assert.deepEqual(parsePayloadArg("10"), { start: 10 });
  });

  test("keeps non-numeric values as a string payload", () => {
    assert.deepEqual(parsePayloadArg("cinnamon"), { value: "cinnamon" });
  });
});
