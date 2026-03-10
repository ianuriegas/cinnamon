import type { AuthUser } from "../lib/api";

type Action = "view" | "trigger" | "cancel";

const ACTION_MIN_ROLE: Record<Action, number> = {
  view: 1, // viewer
  trigger: 2, // member
  cancel: 2, // member
};

const ROLE_RANK: Record<string, number> = {
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Check if a user has permission to perform an action on a job.
 *
 * When auth is disabled (user is null), returns true (open access).
 * Super-admins always have access.
 * Otherwise, the user must have a team role that meets the minimum for the action,
 * and that team must overlap with the job's teams.
 */
export function hasPermission(
  user: AuthUser | null,
  jobTeams: string[] | undefined,
  action: Action,
): boolean {
  if (!user) return true;
  if (user.isSuperAdmin) return true;

  const minRank = ACTION_MIN_ROLE[action];
  if (!jobTeams || jobTeams.length === 0) return false;

  const jobTeamSet = new Set(jobTeams);
  return user.teams.some((t) => jobTeamSet.has(t.name) && (ROLE_RANK[t.role] ?? 0) >= minRank);
}
