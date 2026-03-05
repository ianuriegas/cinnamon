import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";

import { db, pool } from "@/db/index.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import { teams } from "@/db/schema/teams.ts";

const TEST_TEAM_NAME = `__test_team_${Date.now()}`;

let testTeamId: number;

describe("Phase 2 schema", () => {
  after(async () => {
    await db.delete(jobsLog).where(eq(jobsLog.teamId, testTeamId));
    await db.delete(apiKeys).where(eq(apiKeys.teamId, testTeamId));
    await db.delete(teams).where(eq(teams.id, testTeamId));
    await pool.end();
  });

  test("can insert and query a team", async () => {
    const [inserted] = await db.insert(teams).values({ name: TEST_TEAM_NAME }).returning();

    testTeamId = inserted.id;

    assert.ok(inserted.id > 0);
    assert.equal(inserted.name, TEST_TEAM_NAME);
    assert.ok(inserted.createdAt instanceof Date);
  });

  test("can insert an api_key with valid team_id", async () => {
    const keyHash = createHash("sha256").update(randomBytes(32)).digest("hex");

    const [inserted] = await db
      .insert(apiKeys)
      .values({ teamId: testTeamId, keyHash, label: "test-key" })
      .returning();

    assert.ok(inserted.id > 0);
    assert.equal(inserted.teamId, testTeamId);
    assert.equal(inserted.keyHash, keyHash);
    assert.equal(inserted.label, "test-key");
    assert.equal(inserted.revoked, false);
  });

  test("api_key FK rejects nonexistent team_id", async () => {
    const keyHash = createHash("sha256").update(randomBytes(32)).digest("hex");

    await assert.rejects(() =>
      db.insert(apiKeys).values({ teamId: 999999, keyHash, label: "bad-fk" }),
    );
  });

  test("can insert a jobs_log entry with team_id", async () => {
    const jobId = `test-${Date.now()}`;

    const [inserted] = await db
      .insert(jobsLog)
      .values({
        jobId,
        teamId: testTeamId,
        queueName: "test-queue",
        jobName: "test-job",
        status: "completed",
        payload: { foo: "bar" },
        result: { stdout: "ok" },
      })
      .returning();

    assert.equal(inserted.teamId, testTeamId);
    assert.equal(inserted.jobId, jobId);
    assert.equal(inserted.status, "completed");
  });

  test("jobs_log allows null team_id for backward compatibility", async () => {
    const jobId = `test-null-team-${Date.now()}`;

    const [inserted] = await db
      .insert(jobsLog)
      .values({
        jobId,
        queueName: "test-queue",
        jobName: "test-job",
        status: "completed",
      })
      .returning();

    assert.equal(inserted.teamId, null);

    await db.delete(jobsLog).where(eq(jobsLog.jobId, jobId));
  });
});
