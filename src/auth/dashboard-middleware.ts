import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";

import { isDashboardAuthEnabled } from "@/config/env.ts";
import { db } from "@/db/index.ts";
import { teams } from "@/db/schema/teams.ts";
import { userTeams } from "@/db/schema/user-teams.ts";

import { SESSION_COOKIE, verifySession } from "./dashboard-auth.ts";

export interface UserTeamEntry {
  teamId: number;
  teamName: string;
  role: string;
}

export async function dashboardAuthMiddleware(c: Context, next: Next) {
  if (!isDashboardAuthEnabled()) return next();

  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifySession(token);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const memberships = await db
    .select({ teamId: teams.id, teamName: teams.name, role: userTeams.role })
    .from(userTeams)
    .innerJoin(teams, eq(userTeams.teamId, teams.id))
    .where(eq(userTeams.userId, session.userId));

  c.set("session", session);
  c.set("userTeams", memberships as UserTeamEntry[]);
  c.set("isSuperAdmin", session.isSuperAdmin);

  return next();
}
