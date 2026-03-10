import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db/index.ts";
import { apiKeyTeams } from "@/db/schema/api-key-teams.ts";
import { apiKeys } from "@/db/schema/api-keys.ts";
import { teams } from "@/db/schema/teams.ts";
import { userTeams } from "@/db/schema/user-teams.ts";
import { users } from "@/db/schema/users.ts";
import { Permission } from "@/src/auth/permissions.ts";
import { requirePermission } from "@/src/auth/require-permission.ts";

function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function createAdminApi() {
  const router = new Hono();

  router.use("*", requirePermission(Permission.USERS_MANAGE));

  router.get("/users", async (c) => {
    const allUsers = await db.select().from(users).orderBy(users.email);

    const allUserTeams = await db
      .select({
        userId: userTeams.userId,
        teamId: teams.id,
        teamName: teams.name,
        role: userTeams.role,
      })
      .from(userTeams)
      .innerJoin(teams, eq(userTeams.teamId, teams.id));

    const teamsByUser = new Map<number, Array<{ teamId: number; name: string; role: string }>>();
    for (const row of allUserTeams) {
      const list = teamsByUser.get(row.userId) ?? [];
      list.push({ teamId: row.teamId, name: row.teamName, role: row.role });
      teamsByUser.set(row.userId, list);
    }

    const data = allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      picture: u.picture,
      isSuperAdmin: u.isSuperAdmin,
      createdAt: u.createdAt,
      teams: teamsByUser.get(u.id) ?? [],
    }));

    return c.json({ data });
  });

  router.post("/users/:id/teams", async (c) => {
    const userId = Number(c.req.param("id"));
    if (!Number.isInteger(userId) || userId <= 0) {
      return c.json({ error: "Invalid user ID" }, 400);
    }

    const body = await c.req.json<{ teamId?: number; role?: string }>();
    if (!body.teamId || !body.role) {
      return c.json({ error: "teamId and role are required" }, 400);
    }

    const validRoles = ["admin", "member", "viewer"];
    if (!validRoles.includes(body.role)) {
      return c.json({ error: `role must be one of: ${validRoles.join(", ")}` }, 400);
    }

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!user) return c.json({ error: "User not found" }, 404);

    const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, body.teamId));
    if (!team) return c.json({ error: "Team not found" }, 404);

    await db
      .insert(userTeams)
      .values({ userId, teamId: body.teamId, role: body.role })
      .onConflictDoUpdate({
        target: [userTeams.userId, userTeams.teamId],
        set: { role: body.role },
      });

    return c.json({ status: "ok" });
  });

  router.delete("/users/:userId/teams/:teamId", async (c) => {
    const userId = Number(c.req.param("userId"));
    const teamId = Number(c.req.param("teamId"));

    if (!Number.isInteger(userId) || !Number.isInteger(teamId)) {
      return c.json({ error: "Invalid IDs" }, 400);
    }

    await db
      .delete(userTeams)
      .where(and(eq(userTeams.userId, userId), eq(userTeams.teamId, teamId)));

    return c.json({ status: "ok" });
  });

  router.get("/teams", async (c) => {
    const allTeams = await db.select().from(teams).orderBy(teams.name);
    return c.json({ data: allTeams });
  });

  router.post("/teams", async (c) => {
    const body = await c.req.json<{ name?: string }>();
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return c.json({ error: "name is required and must be a non-empty string" }, 400);
    }

    const [team] = await db
      .insert(teams)
      .values({ name: body.name.trim().toLowerCase() })
      .onConflictDoNothing({ target: teams.name })
      .returning();

    if (!team) {
      const [existing] = await db
        .select()
        .from(teams)
        .where(eq(teams.name, body.name.trim().toLowerCase()));
      return c.json({ data: existing });
    }

    return c.json({ data: team }, 201);
  });

  // --- API Key Management ---

  router.get("/keys", async (c) => {
    const keyRows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        revoked: apiKeys.revoked,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .orderBy(apiKeys.createdAt);

    const keyIds = keyRows.map((r) => r.id);
    if (keyIds.length === 0) {
      return c.json({ data: [] });
    }

    const teamRows = await db
      .select({
        apiKeyId: apiKeyTeams.apiKeyId,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(apiKeyTeams)
      .innerJoin(teams, eq(apiKeyTeams.teamId, teams.id))
      .where(inArray(apiKeyTeams.apiKeyId, keyIds));

    const teamsByKey = new Map<number, Array<{ id: number; name: string }>>();
    for (const r of teamRows) {
      const list = teamsByKey.get(r.apiKeyId) ?? [];
      list.push({ id: r.teamId, name: r.teamName });
      teamsByKey.set(r.apiKeyId, list);
    }

    const data = keyRows.map((k) => ({
      id: k.id,
      teams: teamsByKey.get(k.id) ?? [],
      name: k.name,
      revoked: k.revoked,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    }));

    return c.json({ data });
  });

  router.get("/keys/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid key ID" }, 400);
    }

    const [key] = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        revoked: apiKeys.revoked,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.id, id));

    if (!key) return c.json({ error: "Key not found" }, 404);

    const teamRows = await db
      .select({ teamId: teams.id, teamName: teams.name })
      .from(apiKeyTeams)
      .innerJoin(teams, eq(apiKeyTeams.teamId, teams.id))
      .where(eq(apiKeyTeams.apiKeyId, id));

    return c.json({
      data: {
        ...key,
        teams: teamRows.map((r) => ({ id: r.teamId, name: r.teamName })),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      },
    });
  });

  router.post("/keys", async (c) => {
    const body = await c.req.json<{ teamIds?: number[]; name?: string }>();
    const rawIds = body.teamIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return c.json({ error: "teamIds is required and must be a non-empty array" }, 400);
    }

    const teamIds = rawIds.filter((id): id is number => Number.isInteger(id) && id > 0);
    if (teamIds.length === 0) {
      return c.json({ error: "teamIds must contain at least one valid team ID" }, 400);
    }

    const existingTeams = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArray(teams.id, teamIds));
    if (existingTeams.length !== teamIds.length) {
      return c.json({ error: "One or more team IDs are invalid" }, 404);
    }

    const plainKey = `cin_${randomBytes(32).toString("hex")}`;
    const keyHash = hashKey(plainKey);
    const name = body.name?.trim() || null;

    const [inserted] = await db.insert(apiKeys).values({ keyHash, name }).returning();

    await db
      .insert(apiKeyTeams)
      .values(teamIds.map((teamId) => ({ apiKeyId: inserted.id, teamId })));

    return c.json(
      {
        data: {
          id: inserted.id,
          teams: existingTeams.map((t) => ({ id: t.id, name: t.name })),
          name: inserted.name,
          revoked: inserted.revoked,
          createdAt: inserted.createdAt,
          lastUsedAt: inserted.lastUsedAt?.toISOString() ?? null,
        },
        key: plainKey,
      },
      201,
    );
  });

  router.patch("/keys/:id/teams", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid key ID" }, 400);
    }

    const body = await c.req.json<{ teamIds?: number[] }>();
    const rawIds = body.teamIds ?? [];
    const teamIds = Array.isArray(rawIds)
      ? rawIds.filter((tid): tid is number => Number.isInteger(tid) && tid > 0)
      : [];

    const [existing] = await db
      .select({ id: apiKeys.id, revoked: apiKeys.revoked })
      .from(apiKeys)
      .where(eq(apiKeys.id, id));
    if (!existing) return c.json({ error: "Key not found" }, 404);
    if (existing.revoked) return c.json({ error: "Cannot update teams on a revoked key" }, 400);

    if (teamIds.length > 0) {
      const validTeams = await db
        .select({ id: teams.id })
        .from(teams)
        .where(inArray(teams.id, teamIds));
      if (validTeams.length !== teamIds.length) {
        return c.json({ error: "One or more team IDs are invalid" }, 404);
      }
    } else {
      return c.json({ error: "teamIds must contain at least one team" }, 400);
    }

    await db.delete(apiKeyTeams).where(eq(apiKeyTeams.apiKeyId, id));
    await db.insert(apiKeyTeams).values(teamIds.map((teamId) => ({ apiKeyId: id, teamId })));

    const teamRows = await db
      .select({ teamId: teams.id, teamName: teams.name })
      .from(apiKeyTeams)
      .innerJoin(teams, eq(apiKeyTeams.teamId, teams.id))
      .where(eq(apiKeyTeams.apiKeyId, id));

    return c.json({
      data: { teams: teamRows.map((r) => ({ id: r.teamId, name: r.teamName })) },
    });
  });

  router.delete("/keys/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid key ID" }, 400);
    }

    const [existing] = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.id, id));
    if (!existing) return c.json({ error: "Key not found" }, 404);

    await db.update(apiKeys).set({ revoked: true }).where(eq(apiKeys.id, id));

    return c.json({ status: "ok" });
  });

  return router;
}
