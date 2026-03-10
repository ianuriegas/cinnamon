export const Permission = {
  RUNS_VIEW: "runs:view",
  RUNS_TRIGGER: "runs:trigger",
  RUNS_CANCEL: "runs:cancel",
  TEAMS_MANAGE: "teams:manage",
  USERS_MANAGE: "users:manage",
} as const;

export type PermissionValue = (typeof Permission)[keyof typeof Permission];

export const TeamRole = { admin: "admin", member: "member", viewer: "viewer" } as const;
export type TeamRoleValue = (typeof TeamRole)[keyof typeof TeamRole];

const ROLE_RANK: Record<TeamRoleValue, number> = { admin: 3, member: 2, viewer: 1 };

const ROLE_PERMISSIONS: Record<TeamRoleValue, PermissionValue[]> = {
  admin: [
    Permission.RUNS_VIEW,
    Permission.RUNS_TRIGGER,
    Permission.RUNS_CANCEL,
    Permission.TEAMS_MANAGE,
  ],
  member: [Permission.RUNS_VIEW, Permission.RUNS_TRIGGER, Permission.RUNS_CANCEL],
  viewer: [Permission.RUNS_VIEW],
};

export function roleHasPermission(role: TeamRoleValue, perm: PermissionValue): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function highestRole(roles: TeamRoleValue[]): TeamRoleValue | null {
  if (roles.length === 0) return null;
  return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
}
