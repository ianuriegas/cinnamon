import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@/db/index.ts";
import { accessRequests } from "@/db/schema/access-requests.ts";
import { users } from "@/db/schema/users.ts";
import { app } from "@/src/server.ts";

const canRunAuthTests =
  Boolean(process.env.SESSION_SECRET) &&
  Boolean(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET);

const TEST_PREFIX = `__test_ar_${Date.now()}`;

const adminEmail = `${TEST_PREFIX}_admin@test.local`;
const adminSub = `${TEST_PREFIX}_admin_sub`;
const requesterEmail = `${TEST_PREFIX}_req@test.local`;
const requesterSub = `${TEST_PREFIX}_req_sub`;

let adminUserId: number;
let adminJwt: string;
let requesterJwt: string;
let pendingRequestId: number;

function req(path: string, init?: RequestInit) {
  return app.request(path, init);
}

function dashboardHeaders(jwt: string) {
  return { Cookie: `cinnamon_session=${jwt}`, "Content-Type": "application/json" };
}

describe("Access Requests", { skip: !canRunAuthTests && "Auth env not configured" }, () => {
  before(async () => {
    const { createSessionJwt } = await import("@/src/auth/dashboard-auth.ts");

    const [adminUser] = await db
      .insert(users)
      .values({
        email: adminEmail,
        name: "Test Admin",
        picture: "",
        googleSub: adminSub,
        isSuperAdmin: true,
        disabled: false,
      })
      .returning();
    adminUserId = adminUser.id;

    adminJwt = await createSessionJwt({
      id: adminUserId,
      googleSub: adminSub,
      email: adminEmail,
      name: "Test Admin",
      picture: "",
      isSuperAdmin: true,
    });

    requesterJwt = await createSessionJwt({
      id: 0,
      googleSub: requesterSub,
      email: requesterEmail,
      name: "Test Requester",
      picture: "",
      isSuperAdmin: false,
    });

    const [ar] = await db
      .insert(accessRequests)
      .values({
        email: requesterEmail,
        googleSub: requesterSub,
        name: "Test Requester",
        picture: "",
        status: "pending",
      })
      .returning();
    pendingRequestId = ar.id;
  });

  after(async () => {
    await db.delete(accessRequests).where(eq(accessRequests.email, requesterEmail));
    await db.delete(users).where(eq(users.email, requesterEmail));
    await db.delete(users).where(eq(users.id, adminUserId));
  });

  test("GET /access-requests/mine returns requester's request", async () => {
    const res = await req("/api/dashboard/access-requests/mine", {
      headers: dashboardHeaders(requesterJwt),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.email, requesterEmail);
    assert.equal(body.data.status, "pending");
  });

  test("GET /access-requests/mine requires auth", async () => {
    const res = await req("/api/dashboard/access-requests/mine");
    assert.equal(res.status, 401);
  });

  test("approve creates user and updates request status", async () => {
    const res = await req(`/api/dashboard/access-requests/${pendingRequestId}/approve`, {
      method: "POST",
      headers: dashboardHeaders(adminJwt),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "approved");

    const [createdUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, requesterEmail))
      .limit(1);
    assert.ok(createdUser, "User should be created after approval");
    assert.equal(createdUser.disabled, false);
    assert.equal(createdUser.googleSub, requesterSub);

    const [updatedRequest] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, pendingRequestId))
      .limit(1);
    assert.equal(updatedRequest.status, "approved");
    assert.equal(updatedRequest.decidedBy, adminUserId);
  });

  test("approve rejects already-decided request", async () => {
    const res = await req(`/api/dashboard/access-requests/${pendingRequestId}/approve`, {
      method: "POST",
      headers: dashboardHeaders(adminJwt),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("already"));
  });

  test("approve requires super-admin", async () => {
    const res = await req(`/api/dashboard/access-requests/${pendingRequestId}/approve`, {
      method: "POST",
      headers: dashboardHeaders(requesterJwt),
    });
    assert.equal(res.status, 403);
  });

  test("deny updates request status with notes", async () => {
    const [newReq] = await db
      .insert(accessRequests)
      .values({
        email: `${TEST_PREFIX}_deny@test.local`,
        googleSub: `${TEST_PREFIX}_deny_sub`,
        name: "Deny Test",
        picture: "",
        status: "pending",
      })
      .returning();

    const res = await req(`/api/dashboard/access-requests/${newReq.id}/deny`, {
      method: "POST",
      headers: dashboardHeaders(adminJwt),
      body: JSON.stringify({ notes: "Not authorized" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "denied");

    const [denied] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, newReq.id))
      .limit(1);
    assert.equal(denied.status, "denied");
    assert.equal(denied.notes, "Not authorized");
    assert.equal(denied.decidedBy, adminUserId);

    await db.delete(accessRequests).where(eq(accessRequests.id, newReq.id));
  });

  test("deny requires super-admin", async () => {
    const res = await req(`/api/dashboard/access-requests/${pendingRequestId}/deny`, {
      method: "POST",
      headers: dashboardHeaders(requesterJwt),
    });
    assert.equal(res.status, 403);
  });

  test("approve re-enables disabled user instead of creating duplicate", async () => {
    const [disabledUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, requesterEmail))
      .limit(1);

    await db.update(users).set({ disabled: true }).where(eq(users.id, disabledUser.id));

    const [newReq] = await db
      .insert(accessRequests)
      .values({
        email: requesterEmail,
        googleSub: requesterSub,
        name: "Test Requester",
        picture: "",
        status: "pending",
      })
      .returning();

    const res = await req(`/api/dashboard/access-requests/${newReq.id}/approve`, {
      method: "POST",
      headers: dashboardHeaders(adminJwt),
    });
    assert.equal(res.status, 200);

    const [reEnabled] = await db.select().from(users).where(eq(users.id, disabledUser.id)).limit(1);
    assert.equal(reEnabled.disabled, false, "User should be re-enabled");

    const allUsers = await db.select().from(users).where(eq(users.email, requesterEmail));
    assert.equal(allUsers.length, 1, "Should not create a duplicate user");

    await db.delete(accessRequests).where(eq(accessRequests.id, newReq.id));
  });
});
