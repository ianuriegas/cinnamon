import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseStart } from "../jobs/cinnamon.ts";

describe("parseStart", () => {
  test("uses a positive integer start value", () => {
    assert.equal(parseStart(5), 5);
    assert.equal(parseStart("7"), 7);
  });

  test("falls back to default for invalid values", () => {
    assert.equal(parseStart(undefined), 10);
    assert.equal(parseStart(0), 10);
    assert.equal(parseStart(-1), 10);
    assert.equal(parseStart("cinnamon"), 10);
  });
});
