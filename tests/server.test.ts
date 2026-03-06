import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@/db/index.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import { teams } from "@/db/schema/teams.ts";
import { app } from "@/src/server.ts";

const TEST_TEAM_NAME = `__test_api_${Date.now()}`;
let testTeamId: number;
let testPlainKey: string;

function req(path: string, init?: RequestInit) {
  return app.request(path, init);
}

function authHeader(key = testPlainKey) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

describe("API server", () => {
  after(async () => {
    await db.delete(jobsLog).where(eq(jobsLog.teamId, testTeamId));
    await db.delete(apiKeys).where(eq(apiKeys.teamId, testTeamId));
    await db.delete(teams).where(eq(teams.id, testTeamId));
  });

  test("setup: seed test team and API key", async () => {
    const [team] = await db.insert(teams).values({ name: TEST_TEAM_NAME }).returning();
    testTeamId = team.id;

    testPlainKey = `cin_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(testPlainKey).digest("hex");
    await db.insert(apiKeys).values({ teamId: testTeamId, keyHash, label: "test-server" });
  });

  test("GET /health returns 200", async () => {
    const res = await req("/health");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { status: "ok" });
  });

  test("POST /v1/enqueue without auth returns 401", async () => {
    const res = await req("/v1/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobName: "shell" }),
    });
    assert.equal(res.status, 401);
  });

  test("POST /v1/enqueue with invalid key returns 401", async () => {
    const res = await req("/v1/enqueue", {
      method: "POST",
      headers: authHeader("cin_bogus_key_value"),
      body: JSON.stringify({ jobName: "shell" }),
    });
    assert.equal(res.status, 401);
  });

  test("POST /v1/enqueue with revoked key returns 401", async () => {
    const revokedPlain = `cin_${randomBytes(32).toString("hex")}`;
    const revokedHash = createHash("sha256").update(revokedPlain).digest("hex");
    await db.insert(apiKeys).values({
      teamId: testTeamId,
      keyHash: revokedHash,
      label: "revoked-key",
      revoked: true,
    });

    const res = await req("/v1/enqueue", {
      method: "POST",
      headers: authHeader(revokedPlain),
      body: JSON.stringify({ jobName: "shell" }),
    });
    assert.equal(res.status, 401);
  });

  test("POST /v1/enqueue with missing jobName returns 400", async () => {
    const res = await req("/v1/enqueue", {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({ data: {} }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("jobName"));
  });

  test("POST /v1/enqueue with unknown jobName returns 400", async () => {
    const res = await req("/v1/enqueue", {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({ jobName: "nonexistent-job" }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("nonexistent-job"));
  });

  test("POST /v1/enqueue with valid key enqueues a job", async () => {
    const res = await req("/v1/enqueue", {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({
        jobName: "shell",
        data: { command: "echo", args: ["phase3"] },
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.jobId);
    assert.equal(body.jobName, "shell");
  });
});
