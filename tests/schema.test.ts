import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@/db/index.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import { teams } from "@/db/schema/teams.ts";
import { userTeams } from "@/db/schema/user-teams.ts";
import { users } from "@/db/schema/users.ts";

const TEST_TEAM_NAME = `__test_team_${Date.now()}`;
const TEST_USER_EMAIL = `__test_user_${Date.now()}@test.local`;
const TEST_USER_SUB = `__test_user_sub_${Date.now()}`;

let testTeamId: number;
let testUserId: number | undefined;

describe("Phase 2 schema", () => {
  after(async () => {
    if (testUserId != null) {
      await db.delete(userTeams).where(eq(userTeams.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
    await db.delete(jobsLog).where(eq(jobsLog.teamId, testTeamId));
    await db.delete(apiKeys).where(eq(apiKeys.teamId, testTeamId));
    await db.delete(teams).where(eq(teams.id, testTeamId));
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

  test("can insert user_teams with valid user and team", async () => {
    const [insertedUser] = await db
      .insert(users)
      .values({
        email: TEST_USER_EMAIL,
        googleSub: TEST_USER_SUB,
        isSuperAdmin: false,
        disabled: false,
      })
      .returning();
    testUserId = insertedUser.id;

    const [inserted] = await db
      .insert(userTeams)
      .values({ userId: testUserId, teamId: testTeamId })
      .returning();
    assert.ok(inserted.id > 0);
    assert.equal(inserted.userId, testUserId);
    assert.equal(inserted.teamId, testTeamId);
    assert.ok(inserted.createdAt instanceof Date);
  });

  test("user_teams unique constraint rejects duplicate user_id + team_id", async () => {
    const uid = testUserId;
    if (uid == null) throw new Error("testUserId not set");
    await assert.rejects(() => db.insert(userTeams).values({ userId: uid, teamId: testTeamId }));
  });

  test("deleting user cascades user_teams", async () => {
    const [u] = await db
      .insert(users)
      .values({
        email: `__test_cascade_${Date.now()}@test.local`,
        googleSub: `__test_cascade_sub_${Date.now()}`,
        isSuperAdmin: false,
        disabled: false,
      })
      .returning();
    await db.insert(userTeams).values({ userId: u.id, teamId: testTeamId });
    const before = await db.select().from(userTeams).where(eq(userTeams.userId, u.id));
    assert.equal(before.length, 1);
    await db.delete(users).where(eq(users.id, u.id));
    const after = await db.select().from(userTeams).where(eq(userTeams.userId, u.id));
    assert.equal(after.length, 0);
  });
});
