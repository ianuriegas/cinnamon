import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";

import { isDashboardAuthEnabled } from "@/config/env.ts";
import { db } from "@/db/index.ts";
import { jobTeams } from "@/db/schema/job-teams.ts";

import type { UserTeamEntry } from "./dashboard-middleware.ts";
import {
  highestRole,
  type PermissionValue,
  roleHasPermission,
  type TeamRoleValue,
} from "./permissions.ts";

/**
 * Middleware factory that checks if the current user has a specific permission.
 *
 * When `getJobName` is provided, the check is scoped to the job's teams:
 * the user must have the permission via a role on at least one of the job's teams.
 *
 * When `getJobName` is omitted, the check is unscoped:
 * the user must have the permission via any of their team roles.
 */
export function requirePermission(
  perm: PermissionValue,
  getJobName?: (c: Context) => string | null,
) {
  return async (c: Context, next: Next) => {
    if (!isDashboardAuthEnabled()) return next();

    if (c.get("isSuperAdmin")) return next();

    const userTeamList: UserTeamEntry[] | undefined = c.get("userTeams");
    if (!userTeamList?.length) return c.json({ error: "Forbidden" }, 403);

    if (!getJobName) {
      const hasIt = userTeamList.some((t) => roleHasPermission(t.role as TeamRoleValue, perm));
      if (!hasIt) return c.json({ error: "Forbidden" }, 403);
      return next();
    }

    const jobName = getJobName(c);
    if (!jobName) return c.json({ error: "Forbidden" }, 403);

    const jobTeamRows = await db
      .select({ teamId: jobTeams.teamId })
      .from(jobTeams)
      .where(eq(jobTeams.jobName, jobName));
    const jobTeamIds = new Set(jobTeamRows.map((r) => r.teamId));

    const matchingRoles = userTeamList
      .filter((t) => jobTeamIds.has(t.teamId))
      .map((t) => t.role as TeamRoleValue);

    const best = highestRole(matchingRoles);
    if (!best || !roleHasPermission(best, perm)) {
      const email = c.get("session")?.email ?? "unknown";
      console.warn(`RBAC denied: ${email} needs ${perm} on ${jobName}`);
      return c.json({ error: "Forbidden" }, 403);
    }

    return next();
  };
}
