import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";

import { isAccessRequestsEnabled, isDashboardAuthEnabled } from "@/config/env.ts";
import { db } from "@/db/index.ts";
import { userTeams } from "@/db/schema/user-teams.ts";
import { users } from "@/db/schema/users.ts";

import { SESSION_COOKIE, verifySession } from "./dashboard-auth.ts";

function isAllowedForDisabledUser(path: string, method: string): boolean {
  if (path === "/access-requests/mine" && method === "GET") return true;
  if (path === "/access-requests" && method === "POST") return true;
  return false;
}

function isAllowedForNoTeamsUser(path: string, method: string): boolean {
  if (path === "/access-requests/mine" && method === "GET") return true;
  if (path === "/access-requests" && method === "POST") return true;
  return false;
}

async function loadUserTeamIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ teamId: userTeams.teamId })
    .from(userTeams)
    .where(eq(userTeams.userId, userId));
  return rows.map((r) => r.teamId);
}

const ANONYMOUS_SUPER_ADMIN = {
  id: 0,
  email: "",
  googleSub: undefined,
  name: null as string | null,
  picture: null as string | null,
  isSuperAdmin: true,
  disabled: false,
};

export async function dashboardAuthMiddleware(c: Context, next: Next) {
  if (!isDashboardAuthEnabled()) {
    c.set("user", ANONYMOUS_SUPER_ADMIN);
    c.set("userTeamIds", []);
    return next();
  }

  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifySession(token);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const [dbUser] =
    session.userId > 0
      ? await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
      : [null];

  if (!dbUser) {
    const apiPath = c.req.path.replace(/^\/api\/dashboard/, "");
    if (isAllowedForDisabledUser(apiPath, c.req.method)) {
      c.set("user", {
        id: 0,
        email: session.email,
        googleSub: session.sub,
        name: session.name ?? null,
        picture: session.picture ?? null,
        isSuperAdmin: false,
        disabled: true,
      });
      c.set("userTeamIds", []);
      return next();
    }
    return c.json({ error: "Forbidden", accessRequestsEnabled: isAccessRequestsEnabled() }, 403);
  }

  c.set("user", dbUser);
  const teamIds = await loadUserTeamIds(dbUser.id);
  c.set("userTeamIds", teamIds);

  if (dbUser.disabled && !dbUser.isSuperAdmin) {
    const apiPath = c.req.path.replace(/^\/api\/dashboard/, "");
    if (isAllowedForDisabledUser(apiPath, c.req.method)) {
      return next();
    }
    return c.json({ error: "Forbidden", accessRequestsEnabled: isAccessRequestsEnabled() }, 403);
  }

  if (!dbUser.isSuperAdmin && teamIds.length === 0) {
    const apiPath = c.req.path.replace(/^\/api\/dashboard/, "");
    if (!isAllowedForNoTeamsUser(apiPath, c.req.method)) {
      return c.json({ error: "no_teams" }, 403);
    }
  }

  return next();
}
