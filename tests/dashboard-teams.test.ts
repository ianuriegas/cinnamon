import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@/db/index.ts";
import { teams } from "@/db/schema/teams.ts";
import { userTeams } from "@/db/schema/user-teams.ts";
import { users } from "@/db/schema/users.ts";
import { app } from "@/src/server.ts";

const canRunAuthTests =
  Boolean(process.env.SESSION_SECRET) &&
  Boolean(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET);

const TEST_PREFIX = `__test_dt_${Date.now()}`;

let adminUserId: number;
let adminJwt: string;
let regularUserId: number;
let regularJwt: string;
let teamAId: number;
let teamBId: number;

function req(path: string, init?: RequestInit) {
  return app.request(path, init);
}

function dashboardHeaders(jwt: string) {
  return { Cookie: `cinnamon_session=${jwt}`, "Content-Type": "application/json" };
}

describe("Dashboard teams", { skip: !canRunAuthTests && "Auth env not configured" }, () => {
  before(async () => {
    if (!canRunAuthTests) return;
    const { createSessionJwt } = await import("@/src/auth/dashboard-auth.ts");

    const [teamA] = await db
      .insert(teams)
      .values({ name: `${TEST_PREFIX}_team_a` })
      .returning();
    const [teamB] = await db
      .insert(teams)
      .values({ name: `${TEST_PREFIX}_team_b` })
      .returning();
    teamAId = teamA.id;
    teamBId = teamB.id;

    const [adminUser] = await db
      .insert(users)
      .values({
        email: `${TEST_PREFIX}_admin@test.local`,
        name: "Admin",
        picture: "",
        googleSub: `${TEST_PREFIX}_admin_sub`,
        isSuperAdmin: true,
        disabled: false,
      })
      .returning();
    adminUserId = adminUser.id;

    const [regularUser] = await db
      .insert(users)
      .values({
        email: `${TEST_PREFIX}_regular@test.local`,
        name: "Regular",
        picture: "",
        googleSub: `${TEST_PREFIX}_regular_sub`,
        isSuperAdmin: false,
        disabled: false,
      })
      .returning();
    regularUserId = regularUser.id;

    adminJwt = await createSessionJwt({
      id: adminUserId,
      googleSub: `${TEST_PREFIX}_admin_sub`,
      email: `${TEST_PREFIX}_admin@test.local`,
      name: "Admin",
      picture: "",
      isSuperAdmin: true,
    });

    regularJwt = await createSessionJwt({
      id: regularUserId,
      googleSub: `${TEST_PREFIX}_regular_sub`,
      email: `${TEST_PREFIX}_regular@test.local`,
      name: "Regular",
      picture: "",
      isSuperAdmin: false,
    });
  });

  after(async () => {
    if (!canRunAuthTests) return;
    await db.delete(userTeams).where(eq(userTeams.userId, regularUserId));
    await db.delete(userTeams).where(eq(userTeams.userId, adminUserId));
    await db.delete(users).where(eq(users.id, regularUserId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(teams).where(eq(teams.id, teamAId));
    await db.delete(teams).where(eq(teams.id, teamBId));
  });

  test("PUT /users/:id/teams sets teams", async () => {
    if (!canRunAuthTests) return;
    const res = await req(`/api/dashboard/users/${regularUserId}/teams`, {
      method: "PUT",
      headers: dashboardHeaders(adminJwt),
      body: JSON.stringify({ teamIds: [teamAId, teamBId] }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 2);
    const ids = body.data.map((t: { id: number }) => t.id).sort((a: number, b: number) => a - b);
    assert.deepEqual(
      ids,
      [teamAId, teamBId].sort((a, b) => a - b),
    );
  });

  test("GET /users/:id/teams returns user teams", async () => {
    if (!canRunAuthTests) return;
    const res = await req(`/api/dashboard/users/${regularUserId}/teams`, {
      headers: dashboardHeaders(adminJwt),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 2);
  });

  test("PUT /users/:id/teams replaces teams", async () => {
    if (!canRunAuthTests) return;
    const res = await req(`/api/dashboard/users/${regularUserId}/teams`, {
      method: "PUT",
      headers: dashboardHeaders(adminJwt),
      body: JSON.stringify({ teamIds: [teamAId] }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, teamAId);
  });

  test("GET /users includes teams in response", async () => {
    if (!canRunAuthTests) return;
    const res = await req("/api/dashboard/users", {
      headers: dashboardHeaders(adminJwt),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const regular = body.data.find((u: { id: number }) => u.id === regularUserId);
    assert.ok(regular, "Regular user should be in list");
    assert.ok(Array.isArray(regular.teams), "User should have teams array");
    assert.equal(regular.teams.length, 1);
    assert.equal(regular.teams[0].id, teamAId);
  });

  test("user with no teams gets 403 on /runs", async () => {
    if (!canRunAuthTests) return;
    await db.delete(userTeams).where(eq(userTeams.userId, regularUserId));
    const res = await req("/api/dashboard/runs", {
      headers: dashboardHeaders(regularJwt),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "no_teams");
    await db.insert(userTeams).values({ userId: regularUserId, teamId: teamAId });
  });
});
