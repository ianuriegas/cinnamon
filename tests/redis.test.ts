import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseRedisConnection } from "@/config/redis.ts";

describe("parseRedisConnection", () => {
  test("parses a valid redis url", () => {
    const connection = parseRedisConnection("redis://localhost:6380");
    assert.equal(connection.host, "localhost");
    assert.equal(connection.port, 6380);
    assert.equal(connection.username, undefined);
    assert.equal(connection.password, undefined);
  });

  test("throws for invalid protocol", () => {
    assert.throws(
      () => parseRedisConnection("http://localhost:6379"),
      /Invalid REDIS_URL protocol/,
    );
  });

  test("throws for invalid port", () => {
    assert.throws(() => parseRedisConnection("redis://localhost:abc"), /cannot be parsed as a URL/);
  });

  test("enables tls for rediss urls", () => {
    const connection = parseRedisConnection("rediss://localhost:6379");
    assert.deepEqual(connection.tls, {});
  });
});
