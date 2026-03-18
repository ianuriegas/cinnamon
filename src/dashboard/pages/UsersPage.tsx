import { Check, Clock, Shield, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterPills } from "../components/FilterPills";
import { FiltersToggle } from "../components/FiltersToggle";
import { SearchInput } from "../components/SearchInput";
import { TeamFilterDropdown } from "../components/TeamFilterDropdown";
import { TimeAgo } from "../components/TimeAgo";
import { usePolling } from "../hooks/usePolling";
import { useUrlFilters } from "../hooks/useUrlFilters";
import {
  approveAccessRequest,
  denyAccessRequest,
  fetchAccessRequests,
  fetchTeams,
  fetchUsers,
  updateUser,
  updateUserTeams,
} from "../lib/api";
import type { AccessRequestRow, TeamRow, UserRow } from "../lib/types";

const AVATAR_COLORS = [
  "var(--gruvbox-orange-bright)",
  "var(--gruvbox-red-bright)",
  "var(--gruvbox-green-bright)",
  "var(--gruvbox-purple-bright)",
  "var(--gruvbox-blue-bright)",
  "var(--gruvbox-aqua-bright)",
  "var(--gruvbox-yellow-bright)",
];

function avatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const ROLE_OPTIONS = [
  { value: "Super Admin", label: "Super Admin", color: "var(--gruvbox-orange)" },
  { value: "Member", label: "Member", color: "var(--gruvbox-orange)" },
] as const;

const USER_STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "var(--gruvbox-green)" },
  { value: "inactive", label: "Inactive", color: "var(--gruvbox-bg4)" },
] as const;

type TabType = "users" | "access-requests";

const FILTER_KEYS = ["q", "tab", "role", "team", "status", "filters"] as const;

export function UsersPage() {
  const { filters, setFilter, clearFilters, activeFilterCount } = useUrlFilters(FILTER_KEYS, {
    excludeFromCount: ["q", "tab", "filters"],
  });

  const activeTab = (filters.tab as TabType) || "users";
  const searchQuery = filters.q;
  const filterRole = filters.role;
  const filterTeam = filters.team;
  const filterStatus = filters.status;
  const filtersOpen = filters.filters === "1" || !!(filterRole || filterTeam || filterStatus);

  const [usersList, setUsersList] = useState<UserRow[]>([]);
  const [requests, setRequests] = useState<AccessRequestRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [manageModal, setManageModal] = useState<UserRow | null>(null);
  const [denyModal, setDenyModal] = useState<{ id: number; email: string } | null>(null);
  const [approveModal, setApproveModal] = useState<{ id: number; email: string } | null>(null);

  const load = useCallback(async () => {
    const [usersRes, requestsRes, teamsRes] = await Promise.all([
      fetchUsers(),
      fetchAccessRequests(),
      fetchTeams(),
    ]);
    setUsersList(usersRes.data);
    setRequests(requestsRes.data);
    setTeams(teamsRes.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 10000);

  async function handleApprove(id: number, teamIds?: number[]) {
    await approveAccessRequest(id, teamIds);
    setApproveModal(null);
    await load();
  }

  async function handleDeny(id: number, notes?: string) {
    await denyAccessRequest(id, notes);
    setDenyModal(null);
    await load();
  }

  async function handleManageSave(user: UserRow, teamIds: number[], disabled: boolean) {
    const promises: Promise<unknown>[] = [];
    promises.push(updateUserTeams(user.id, teamIds));
    if (user.disabled !== disabled) {
      promises.push(updateUser(user.id, { disabled }));
    }
    await Promise.all(promises);
    setManageModal(null);
    await load();
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const teamNames = useMemo(() => teams.map((t) => t.name).sort(), [teams]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...usersList]
      .filter((u) => {
        if (q) {
          const matchName = u.name?.toLowerCase().includes(q);
          const matchEmail = u.email.toLowerCase().includes(q);
          if (!matchName && !matchEmail) return false;
        }
        if (filterRole === "Super Admin" && !u.isSuperAdmin) return false;
        if (filterRole === "Member" && u.isSuperAdmin) return false;
        if (filterTeam) {
          const userTeamNames = (u.teams ?? []).map((t) => t.name);
          if (!userTeamNames.includes(filterTeam)) return false;
        }
        if (filterStatus === "active" && u.disabled) return false;
        if (filterStatus === "inactive" && !u.disabled) return false;
        return true;
      })
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
  }, [usersList, searchQuery, filterRole, filterTeam, filterStatus]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...requests]
      .filter((r) => r.name?.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
  }, [requests, searchQuery]);

  const isFiltering = searchQuery || activeFilterCount > 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="text-foreground mb-2">Users</h1>
        <p className="text-muted-foreground mb-6 md:mb-8">
          Manage users and access to your workspace.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            type="button"
            onClick={() => setFilter("tab", null)}
            className={`px-4 py-3 text-sm transition-all relative ${
              activeTab === "users"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users
              <span
                className="px-1.5 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: activeTab === "users" ? "var(--gruvbox-fg4)" : "var(--border)",
                  color: activeTab === "users" ? "var(--background)" : "var(--muted-foreground)",
                }}
              >
                {usersList.length}
              </span>
            </span>
            {activeTab === "users" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--gruvbox-orange-bright)" }}
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter("tab", "access-requests")}
            className={`px-4 py-3 text-sm transition-all relative ${
              activeTab === "access-requests"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Access Requests
              {pendingCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: "var(--gruvbox-yellow)",
                    color: "var(--gruvbox-bg0)",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </span>
            {activeTab === "access-requests" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--gruvbox-orange-bright)" }}
              />
            )}
          </button>
        </div>

        <SearchInput
          value={searchQuery}
          onChange={(v) => setFilter("q", v || null)}
          placeholder={
            activeTab === "users"
              ? "Search users by name or email..."
              : "Search requests by name or email..."
          }
          className="mb-4"
        />

        {/* Filters (Users tab only) */}
        {activeTab === "users" && (
          <div className="mb-6">
            <FiltersToggle
              open={filtersOpen}
              activeCount={activeFilterCount}
              onToggle={() => setFilter("filters", filtersOpen ? null : "1")}
            />

            {filtersOpen && (
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
                <FilterPills
                  label="Role"
                  options={ROLE_OPTIONS}
                  value={filterRole}
                  onChange={(v) => setFilter("role", v || null)}
                />

                <TeamFilterDropdown
                  teams={teamNames}
                  selected={filterTeam || null}
                  onSelect={(t) => setFilter("team", filterTeam === t ? null : t)}
                />

                <FilterPills
                  label="Status"
                  options={USER_STATUS_OPTIONS}
                  value={filterStatus}
                  onChange={(v) => setFilter("status", v || null)}
                  showDot
                />

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => clearFilters(["role", "team", "status"])}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Result count */}
        {activeTab === "users" && isFiltering && (
          <p className="text-xs text-muted-foreground mb-4">
            Showing {filteredUsers.length} of {usersList.length} users
          </p>
        )}
      </div>

      {/* Users tab content */}
      {activeTab === "users" &&
        (isLoading ? (
          <SkeletonCards />
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-foreground mb-1">No users found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-card border border-border rounded-xl p-4 md:p-5 hover:border-muted-foreground/30 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <UserAvatar user={user} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-foreground">{user.name ?? "—"}</span>
                          {user.isSuperAdmin && <RoleBadge label="Super Admin" />}
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: user.disabled
                                ? "var(--gruvbox-bg4)"
                                : "var(--gruvbox-green-bright)",
                            }}
                            title={user.disabled ? "Inactive" : "Active"}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setManageModal(user)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-accent text-foreground hover:bg-accent/70 transition-colors"
                        >
                          Manage
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {(user.teams ?? []).length > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          {(user.teams ?? []).map((t) => t.name).join(", ")}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {user.lastLoginAt ? (
                          <>
                            Last seen <TimeAgo date={user.lastLoginAt} />
                          </>
                        ) : (
                          "Never logged in"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* Access Requests tab content */}
      {activeTab === "access-requests" &&
        (isLoading ? (
          <SkeletonCards />
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-foreground mb-1">No pending requests</h3>
            <p className="text-sm text-muted-foreground">All access requests have been handled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => (
              <div key={request.id} className="bg-card border border-border rounded-xl p-4 md:p-5">
                <div className="flex items-start gap-4">
                  <RequestAvatar request={request} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-foreground">{request.name ?? "—"}</span>
                        <p className="text-sm text-muted-foreground truncate">{request.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        <TimeAgo date={request.requestedAt} />
                      </span>
                    </div>

                    {request.notes && (
                      <p className="text-sm text-muted-foreground mt-2 bg-background/50 rounded-lg px-3 py-2 border border-border/50">
                        &ldquo;{request.notes}&rdquo;
                      </p>
                    )}

                    {request.status === "pending" ? (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs transition-colors"
                          style={{
                            backgroundColor: "var(--gruvbox-green)",
                            color: "var(--gruvbox-bg0)",
                          }}
                          onClick={() => setApproveModal({ id: request.id, email: request.email })}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs transition-colors"
                          style={{
                            backgroundColor: "var(--destructive)",
                            color: "var(--destructive-foreground)",
                          }}
                          onClick={() => setDenyModal({ id: request.id, email: request.email })}
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <RequestStatusBadge status={request.status} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* Modals */}
      {manageModal && (
        <ManageUserModal
          user={manageModal}
          teams={teams}
          onSave={(teamIds, disabled) => handleManageSave(manageModal, teamIds, disabled)}
          onClose={() => setManageModal(null)}
        />
      )}
      {approveModal && (
        <ApproveModal
          email={approveModal.email}
          teams={teams}
          onConfirm={(teamIds) => handleApprove(approveModal.id, teamIds)}
          onCancel={() => setApproveModal(null)}
        />
      )}
      {denyModal && (
        <DenyModal
          email={denyModal.email}
          onConfirm={(notes) => handleDeny(denyModal.id, notes)}
          onCancel={() => setDenyModal(null)}
        />
      )}
    </div>
  );
}

/* ─── Avatar helpers ─── */

function UserAvatar({ user, size }: { user: UserRow; size: "md" | "lg" }) {
  const px = size === "lg" ? "w-12 h-12" : "w-10 h-10";
  const textSize = size === "lg" ? "text-base" : "text-sm";
  if (user.picture) {
    return (
      <img
        src={user.picture}
        alt=""
        className={`${px} rounded-full shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = (user.name ?? user.email)[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={`${px} rounded-full flex items-center justify-center ${textSize} shrink-0`}
      style={{ backgroundColor: avatarColor(user.email), color: "var(--gruvbox-bg0)" }}
    >
      {initial}
    </div>
  );
}

function RequestAvatar({ request }: { request: AccessRequestRow }) {
  if (request.picture) {
    return (
      <img
        src={request.picture}
        alt=""
        className="w-10 h-10 rounded-full shrink-0"
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = (request.name ?? request.email)[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-sm shrink-0"
      style={{ backgroundColor: avatarColor(request.email), color: "var(--gruvbox-bg0)" }}
    >
      {initial}
    </div>
  );
}

/* ─── Role Badge ─── */

function RoleBadge({ label }: { label: "Super Admin" | "Member" }) {
  const styles =
    label === "Super Admin"
      ? { backgroundColor: "var(--gruvbox-orange)", color: "var(--gruvbox-bg0)" }
      : { backgroundColor: "var(--border)", color: "var(--muted-foreground)" };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs" style={styles}>
      {label}
    </span>
  );
}

/* ─── Request Status Badge ─── */

function RequestStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    approved: { bg: "var(--gruvbox-green)", fg: "var(--gruvbox-bg0)" },
    denied: { bg: "var(--gruvbox-red-bright)", fg: "var(--gruvbox-bg0)" },
  };
  const c = colorMap[status] ?? { bg: "var(--muted)", fg: "var(--foreground)" };
  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs capitalize"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {status}
    </span>
  );
}

/* ─── Skeleton Cards ─── */

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="bg-muted rounded h-4 w-32 mb-2" />
              <div className="bg-muted rounded h-3 w-48 mb-3" />
              <div className="bg-muted rounded h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Manage User Modal ─── */

function ManageUserModal({
  user,
  teams,
  onSave,
  onClose,
}: {
  user: UserRow;
  teams: TeamRow[];
  onSave: (teamIds: number[], disabled: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>(
    (user.teams ?? []).map((t) => t.id),
  );
  const [disabled, setDisabled] = useState(user.disabled);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  function toggleTeam(id: number) {
    setSelectedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    setIsSubmitting(true);
    await onSave(selectedTeamIds, disabled);
    setIsSubmitting(false);
  }

  return (
    <div
      ref={backdropRef}
      role="dialog"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === backdropRef.current && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-4">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <h2 className="text-foreground">{user.name ?? "—"}</h2>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <div>
            <span className="text-sm text-muted-foreground mb-2 block">Role</span>
            <RoleBadge label={user.isSuperAdmin ? "Super Admin" : "Member"} />
          </div>

          {!user.isSuperAdmin && (
            <div>
              <span className="text-sm text-muted-foreground mb-2 block">Teams</span>
              <div className="flex flex-wrap gap-2">
                {teams.map((team) => {
                  const isSelected = selectedTeamIds.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => toggleTeam(team.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        isSelected
                          ? "border-transparent"
                          : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                      }`}
                      style={
                        isSelected
                          ? {
                              backgroundColor: "var(--gruvbox-blue)",
                              color: "var(--gruvbox-bg0)",
                            }
                          : undefined
                      }
                    >
                      {team.name}
                    </button>
                  );
                })}
                {teams.length === 0 && (
                  <p className="text-xs text-muted-foreground">No teams exist yet.</p>
                )}
              </div>
              {selectedTeamIds.length === 0 && teams.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">No teams assigned.</p>
              )}
            </div>
          )}

          {!user.isSuperAdmin && (
            <div>
              <span className="text-sm text-muted-foreground mb-2 block">Status</span>
              {!confirmDisable ? (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: disabled
                          ? "var(--gruvbox-bg4)"
                          : "var(--gruvbox-green-bright)",
                      }}
                    />
                    {disabled ? "Inactive" : "Active"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!disabled) {
                        setConfirmDisable(true);
                      } else {
                        setDisabled(false);
                      }
                    }}
                    className="ml-auto px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
                  >
                    {disabled ? "Enable User" : "Disable User"}
                  </button>
                </div>
              ) : (
                <div className="bg-background border border-border rounded-xl p-3">
                  <p className="text-sm text-foreground mb-3">
                    Are you sure you want to disable{" "}
                    <span className="font-semibold">{user.name ?? user.email}</span>? They will lose
                    access immediately.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmDisable(false)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-accent text-foreground hover:bg-accent/70 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDisabled(true);
                        setConfirmDisable(false);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                      style={{
                        backgroundColor: "var(--destructive)",
                        color: "var(--destructive-foreground)",
                      }}
                    >
                      Disable
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm bg-accent text-foreground hover:bg-accent/70 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--gruvbox-orange-bright)",
              color: "var(--gruvbox-bg0)",
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Approve Modal ─── */

function ApproveModal({
  email,
  teams,
  onConfirm,
  onCancel,
}: {
  email: string;
  teams: TeamRow[];
  onConfirm: (teamIds: number[]) => void;
  onCancel: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleTeam(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    await onConfirm(selectedIds);
    setIsSubmitting(false);
  }

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h3 className="font-bold text-lg text-foreground">Approve Access Request</h3>
          <p className="pt-2 text-sm text-muted-foreground">
            Approve access for <span className="font-semibold text-foreground">{email}</span>?
          </p>
        </div>
        <div className="border-t border-border" />
        <div className="px-6 py-4">
          <span className="text-sm text-muted-foreground mb-2 block">
            Assign to teams (optional)
          </span>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => {
              const isSelected = selectedIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTeam(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    isSelected
                      ? "border-transparent"
                      : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: "var(--gruvbox-blue)",
                          color: "var(--gruvbox-bg0)",
                        }
                      : undefined
                  }
                >
                  {t.name}
                </button>
              );
            })}
            {teams.length === 0 && (
              <span className="text-sm text-muted-foreground">No teams exist yet</span>
            )}
          </div>
        </div>
        <div className="border-t border-border" />
        <div className="px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm bg-accent text-foreground hover:bg-accent/70 transition-colors"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--gruvbox-green)", color: "var(--gruvbox-bg0)" }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            ) : (
              "Approve"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Deny Modal ─── */

function DenyModal({
  email,
  onConfirm,
  onCancel,
}: {
  email: string;
  onConfirm: (notes?: string) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    await onConfirm(notes.trim() || undefined);
    setIsSubmitting(false);
  }

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h3 className="font-bold text-lg text-foreground">Deny Access Request</h3>
          <p className="pt-2 text-sm text-muted-foreground">
            Deny access for <span className="font-semibold text-foreground">{email}</span>?
          </p>
        </div>
        <div className="border-t border-border" />
        <div className="px-6 py-4">
          <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="deny-notes">
            Reason (optional)
          </label>
          <textarea
            id="deny-notes"
            className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="Optional reason shown to the user"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
        <div className="border-t border-border" />
        <div className="px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm bg-accent text-foreground hover:bg-accent/70 transition-colors"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "var(--destructive)",
              color: "var(--destructive-foreground)",
            }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            ) : (
              "Deny"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
