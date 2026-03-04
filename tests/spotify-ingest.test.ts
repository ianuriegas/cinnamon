import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { toValidAfterMs } from "@/jobs/spotify/recently-played/ingest.ts";

describe("toValidAfterMs", () => {
  test("returns the value for a positive integer", () => {
    assert.equal(toValidAfterMs(1709000000000), 1709000000000);
    assert.equal(toValidAfterMs(1), 1);
  });

  test("returns undefined for zero", () => {
    assert.equal(toValidAfterMs(0), undefined);
  });

  test("returns undefined for negative numbers", () => {
    assert.equal(toValidAfterMs(-100), undefined);
  });

  test("returns undefined for floats", () => {
    assert.equal(toValidAfterMs(1.5), undefined);
  });

  test("returns undefined for non-number types", () => {
    assert.equal(toValidAfterMs("123"), undefined);
    assert.equal(toValidAfterMs(null), undefined);
    assert.equal(toValidAfterMs(undefined), undefined);
    assert.equal(toValidAfterMs({}), undefined);
  });
});
