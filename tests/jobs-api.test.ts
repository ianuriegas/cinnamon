import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@/db/index.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import { teams } from "@/db/schema/teams.ts";
import { jobsQueue } from "@/src/queue.ts";
import { app } from "@/src/server.ts";

const TEST_TEAM_NAME = `__test_jobs_api_${Date.now()}`;
const OTHER_TEAM_NAME = `__test_jobs_api_other_${Date.now()}`;
let testTeamId: number;
let otherTeamId: number;
let testPlainKey: string;
let seededJobIds: number[];

function req(path: string, init?: RequestInit) {
  return app.request(path, init);
}

function authHeader(key = testPlainKey) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

describe("Jobs Observability API", () => {
  after(async () => {
    await db.delete(jobsLog).where(eq(jobsLog.teamId, testTeamId));
    await db.delete(jobsLog).where(eq(jobsLog.teamId, otherTeamId));
    await db.delete(apiKeys).where(eq(apiKeys.teamId, testTeamId));
    await db.delete(apiKeys).where(eq(apiKeys.teamId, otherTeamId));
    await db.delete(teams).where(eq(teams.id, testTeamId));
    await db.delete(teams).where(eq(teams.id, otherTeamId));
    await jobsQueue.close();
  });

  test("setup: seed test teams, API key, and job log rows", async () => {
    const [team] = await db.insert(teams).values({ name: TEST_TEAM_NAME }).returning();
    testTeamId = team.id;

    const [otherTeam] = await db.insert(teams).values({ name: OTHER_TEAM_NAME }).returning();
    otherTeamId = otherTeam.id;

    testPlainKey = `cin_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(testPlainKey).digest("hex");
    await db.insert(apiKeys).values({ teamId: testTeamId, keyHash, label: "test-jobs-api" });

    const rows = await db
      .insert(jobsLog)
      .values([
        {
          jobId: `test-job-1-${Date.now()}`,
          teamId: testTeamId,
          queueName: "jobs-queue",
          jobName: "hello-world",
          status: "completed",
          payload: { command: "echo", args: ["hi"] },
          result: { stdout: "hi\n", stderr: "", exitCode: 0 },
          error: false,
          startedAt: new Date("2025-01-01T00:00:00Z"),
          finishedAt: new Date("2025-01-01T00:00:01Z"),
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
        {
          jobId: `test-job-2-${Date.now()}`,
          teamId: testTeamId,
          queueName: "jobs-queue",
          jobName: "hello-world",
          status: "failed",
          payload: { command: "bad" },
          result: { message: "command not found" },
          error: true,
          startedAt: new Date("2025-01-02T00:00:00Z"),
          finishedAt: new Date("2025-01-02T00:00:01Z"),
          createdAt: new Date("2025-01-02T00:00:00Z"),
        },
        {
          jobId: `test-job-3-${Date.now()}`,
          teamId: testTeamId,
          queueName: "jobs-queue",
          jobName: "env-demo",
          status: "completed",
          payload: { command: "printenv" },
          result: { stdout: "hello\n", stderr: "", exitCode: 0 },
          error: false,
          startedAt: new Date("2025-01-03T00:00:00Z"),
          finishedAt: new Date("2025-01-03T00:00:01Z"),
          createdAt: new Date("2025-01-03T00:00:00Z"),
        },
        {
          jobId: `test-job-other-${Date.now()}`,
          teamId: otherTeamId,
          queueName: "jobs-queue",
          jobName: "hello-world",
          status: "completed",
          payload: { command: "echo" },
          result: { stdout: "secret\n" },
          error: false,
          startedAt: new Date("2025-01-01T00:00:00Z"),
          finishedAt: new Date("2025-01-01T00:00:01Z"),
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ])
      .returning();

    seededJobIds = rows.map((r) => r.id);
  });

  // --- GET /v1/jobs (list) ---

  test("GET /v1/jobs returns paginated list scoped to team", async () => {
    const res = await req("/v1/jobs", { headers: authHeader() });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(Array.isArray(body.data));
    assert.ok(body.pagination);
    assert.equal(body.pagination.total, 3);

    for (const row of body.data) {
      assert.equal(row.teamId, testTeamId);
    }
  });

  test("GET /v1/jobs respects limit and offset", async () => {
    const res = await req("/v1/jobs?limit=1&offset=0", { headers: authHeader() });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.data.length, 1);
    assert.equal(body.pagination.limit, 1);
    assert.equal(body.pagination.offset, 0);
    assert.equal(body.pagination.total, 3);

    const res2 = await req("/v1/jobs?limit=1&offset=1", { headers: authHeader() });
    const body2 = await res2.json();
    assert.equal(body2.data.length, 1);
    assert.notEqual(body2.data[0].id, body.data[0].id);
  });

  test("GET /v1/jobs filters by name", async () => {
    const res = await req("/v1/jobs?name=env-demo", { headers: authHeader() });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.pagination.total, 1);
    assert.equal(body.data[0].jobName, "env-demo");
  });

  test("GET /v1/jobs filters by status", async () => {
    const res = await req("/v1/jobs?status=failed", { headers: authHeader() });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.pagination.total, 1);
    assert.equal(body.data[0].status, "failed");
  });

  test("GET /v1/jobs filters by since", async () => {
    const res = await req("/v1/jobs?since=2025-01-02T00:00:00Z", { headers: authHeader() });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.pagination.total, 2);
  });

  test("GET /v1/jobs does not return other team's jobs", async () => {
    const res = await req("/v1/jobs?name=hello-world", { headers: authHeader() });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.pagination.total, 2);
    for (const row of body.data) {
      assert.equal(row.teamId, testTeamId);
    }
  });

  test("GET /v1/jobs without auth returns 401", async () => {
    const res = await req("/v1/jobs");
    assert.equal(res.status, 401);
  });

  // --- GET /v1/jobs/:id (detail) ---

  test("GET /v1/jobs/:id returns full job detail", async () => {
    const id = seededJobIds[0];
    const res = await req(`/v1/jobs/${id}`, { headers: authHeader() });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.data.id, id);
    assert.equal(body.data.teamId, testTeamId);
    assert.ok(body.data.result);
    assert.ok(body.data.payload);
  });

  test("GET /v1/jobs/:id returns 404 for unknown ID", async () => {
    const res = await req("/v1/jobs/999999", { headers: authHeader() });
    assert.equal(res.status, 404);
  });

  test("GET /v1/jobs/:id returns 404 for other team's job", async () => {
    const otherTeamJobId = seededJobIds[3];
    const res = await req(`/v1/jobs/${otherTeamJobId}`, { headers: authHeader() });
    assert.equal(res.status, 404);
  });

  test("GET /v1/jobs/:id returns 404 for non-existent string ID", async () => {
    const res = await req("/v1/jobs/abc", { headers: authHeader() });
    assert.equal(res.status, 404);
  });

  test("GET /v1/jobs/:id without auth returns 401", async () => {
    const res = await req(`/v1/jobs/${seededJobIds[0]}`);
    assert.equal(res.status, 401);
  });

  // --- GET /v1/jobs/definitions ---

  test("GET /v1/jobs/definitions returns config entries", async () => {
    const res = await req("/v1/jobs/definitions", { headers: authHeader() });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);

    const helloWorld = body.data.find((d: { name: string }) => d.name === "hello-world");
    assert.ok(helloWorld);
    assert.equal(helloWorld.command, "python3");
    assert.equal(helloWorld.description, "Demo Python script");
  });

  test("GET /v1/jobs/definitions without auth returns 401", async () => {
    const res = await req("/v1/jobs/definitions");
    assert.equal(res.status, 401);
  });

  // --- GET /v1/jobs/schedules ---

  test("GET /v1/jobs/schedules returns scheduler list", async () => {
    const res = await req("/v1/jobs/schedules", { headers: authHeader() });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(Array.isArray(body.data));
  });

  test("GET /v1/jobs/schedules without auth returns 401", async () => {
    const res = await req("/v1/jobs/schedules");
    assert.equal(res.status, 401);
  });

  // --- POST /v1/jobs/:name/trigger ---

  test("POST /v1/jobs/:name/trigger enqueues a job", async () => {
    const res = await req("/v1/jobs/shell/trigger", {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({ data: { command: "echo", args: ["triggered"] } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(body.jobId);
    assert.equal(body.jobName, "shell");
  });

  test("POST /v1/jobs/:name/trigger with empty body succeeds", async () => {
    const res = await req("/v1/jobs/hello-world/trigger", {
      method: "POST",
      headers: authHeader(),
    });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(body.jobId);
    assert.equal(body.jobName, "hello-world");
  });

  test("POST /v1/jobs/:name/trigger with unknown name returns 400", async () => {
    const res = await req("/v1/jobs/nonexistent-job/trigger", {
      method: "POST",
      headers: authHeader(),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("nonexistent-job"));
  });

  test("POST /v1/jobs/:name/trigger without auth returns 401", async () => {
    const res = await req("/v1/jobs/shell/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });
    assert.equal(res.status, 401);
  });
});
