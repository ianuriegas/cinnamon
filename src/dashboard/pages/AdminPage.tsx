import { useCallback, useEffect, useRef, useState } from "react";
import { useTimezoneContext } from "../contexts/TimezoneContext";
import { formatInTimezone } from "../hooks/useTimezone";
import {
  assignUserTeam,
  createAdminKey,
  createAdminTeam,
  fetchAdminKey,
  fetchAdminKeys,
  fetchAdminTeams,
  fetchAdminUsers,
  removeUserTeam,
  revokeAdminKey,
  updateAdminKeyTeams,
} from "../lib/api";
import type { AdminApiKey, AdminTeam, AdminUser } from "../lib/types";

function useEscapeKey(handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handler]);
}

const ROLES = ["admin", "member", "viewer"] as const;
const ROLE_BADGE: Record<string, string> = {
  admin: "badge-primary",
  member: "badge-secondary",
  viewer: "badge-ghost",
};

function getInitials(str: string): string {
  return str
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* ──────────────────────── Users section ──────────────────── */

function UserCard({
  user,
  allTeams,
  onChanged,
}: {
  user: AdminUser;
  allTeams: AdminTeam[];
  onChanged: () => void;
}) {
  const existingTeamIds = new Set(user.teams.map((t) => t.teamId));
  const [assigning, setAssigning] = useState(false);
  const [teamId, setTeamId] = useState<number | "">("");
  const [role, setRole] = useState<string>("viewer");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = allTeams.filter((t) => !existingTeamIds.has(t.id));

  const handleAssign = async () => {
    if (teamId === "") return;
    setSaving(true);
    setError(null);
    try {
      await assignUserTeam(user.id, teamId, role);
      setAssigning(false);
      setTeamId("");
      setRole("viewer");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-5">
        <div className="flex items-center gap-3">
          {user.picture ? (
            <div className="avatar">
              <div className="w-10 rounded-full ring ring-base-300 ring-offset-base-100 ring-offset-1">
                <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
              </div>
            </div>
          ) : (
            <div className="avatar placeholder">
              <div className="bg-neutral text-neutral-content w-10 rounded-full">
                <span className="text-sm">{getInitials(user.name || user.email)}</span>
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{user.name}</div>
            <div className="text-xs text-base-content/50 truncate">{user.email}</div>
          </div>
          {user.isSuperAdmin && (
            <div className="badge badge-warning badge-sm gap-1 shrink-0">super-admin</div>
          )}
        </div>

        <div className="divider my-1" />

        <div className="flex flex-wrap gap-1.5 items-center min-h-[28px]">
          {user.teams.length === 0 && !assigning && (
            <span className="text-xs text-base-content/40">No teams assigned</span>
          )}
          {user.teams.map((team) => (
            <TeamBadge
              key={team.teamId}
              team={team}
              onRemove={async () => {
                await removeUserTeam(user.id, team.teamId);
                onChanged();
              }}
            />
          ))}
          {assigning ? (
            <div className="flex items-center gap-1 mt-1">
              <select
                className="select select-bordered select-xs"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Team...</option>
                {available.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered select-xs"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={handleAssign}
                disabled={saving || teamId === ""}
              >
                {saving ? <span className="loading loading-spinner loading-xs" /> : "Add"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => {
                  setAssigning(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
              {error && <span className="text-error text-xs">{error}</span>}
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setAssigning(true)}
              disabled={available.length === 0}
              title={available.length === 0 ? "All teams assigned" : "Assign a team"}
            >
              + Team
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamBadge({
  team,
  onRemove,
}: {
  team: { teamId: number; name: string; role: string };
  onRemove: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`badge ${ROLE_BADGE[team.role] ?? "badge-ghost"} badge-sm gap-1 ${failed ? "badge-error" : ""}`}
      title={failed ? "Failed to remove — click × to retry" : undefined}
    >
      {team.name}
      <span className="text-[0.6rem] opacity-60">({team.role})</span>
      <button
        type="button"
        className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
        onClick={async () => {
          setRemoving(true);
          setFailed(false);
          try {
            await onRemove();
          } catch {
            setFailed(true);
          } finally {
            setRemoving(false);
          }
        }}
        disabled={removing}
        aria-label={`Remove ${team.name}`}
      >
        {removing ? (
          <span className="loading loading-spinner" style={{ width: 10, height: 10 }} />
        ) : (
          "\u00d7"
        )}
      </button>
    </span>
  );
}

/* ──────────────────────── Teams section ──────────────────── */

function CreateTeamForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await createAdminTeam(trimmed);
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="join">
      <input
        type="text"
        className="input input-bordered input-sm join-item w-48"
        placeholder="New team name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="submit"
        className="btn btn-primary btn-sm join-item"
        disabled={saving || !name.trim()}
      >
        {saving ? <span className="loading loading-spinner loading-xs" /> : "Create"}
      </button>
      {error && <span className="text-error text-xs ml-2 self-center">{error}</span>}
    </form>
  );
}

/* ──────────────────────── API Keys section ───────────────── */

function TeamMultiSelect({
  allTeams,
  selectedIds,
  onToggle,
}: {
  allTeams: AdminTeam[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? allTeams.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : allTeams;

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Search teams..."
        className="input input-bordered input-sm w-full"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-40 overflow-y-auto border border-base-300 rounded-lg divide-y divide-base-200">
        {filtered.map((t) => (
          <label
            key={t.id}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-base-200/60 transition-colors"
          >
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={selectedIds.has(t.id)}
              onChange={() => onToggle(t.id)}
            />
            <span className="text-sm">{t.name}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="text-base-content/40 text-sm py-3 text-center">No teams match</p>
        )}
      </div>
    </div>
  );
}

function CreateKeyModal({
  allTeams,
  onClose,
  onCreated,
}: {
  allTeams: AdminTeam[];
  onClose: () => void;
  onCreated: (plainKey: string, keyName: string | null) => void;
}) {
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const toggleTeam = (id: number) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTeamIds.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createAdminKey(Array.from(selectedTeamIds), name.trim() || undefined);
      onCreated(res.key, res.data.name ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg">Create API Key</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="form-control">
            <span className="label-text text-sm font-medium mb-1">Name</span>
            <input
              ref={nameRef}
              type="text"
              className="input input-bordered input-sm w-full"
              placeholder="e.g. CI/CD pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-control">
            <span className="label-text text-sm font-medium mb-1">
              Teams <span className="text-base-content/50">({selectedTeamIds.size} selected)</span>
            </span>
            <TeamMultiSelect
              allTeams={allTeams}
              selectedIds={selectedTeamIds}
              onToggle={toggleTeam}
            />
          </div>

          {error && (
            <div className="alert alert-error py-2">
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="modal-action">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving || selectedTeamIds.size === 0}
            >
              {saving ? <span className="loading loading-spinner loading-sm" /> : "Create Key"}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}

function KeyDetailModal({
  keyId,
  allTeams,
  onClose,
  onSaved,
  onRotate,
}: {
  keyId: number;
  allTeams: AdminTeam[];
  onClose: () => void;
  onSaved: () => void;
  onRotate: (plainKey: string, keyName: string | null) => void;
}) {
  const [key, setKey] = useState<AdminApiKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { timezone } = useTimezoneContext();

  useEscapeKey(onClose);

  useEffect(() => {
    let cancelled = false;
    fetchAdminKey(keyId)
      .then((res) => {
        if (!cancelled) {
          setKey(res.data);
          setSelectedTeamIds(new Set(res.data.teams.map((t) => t.id)));
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load key");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [keyId]);

  const toggleTeam = (id: number) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const currentTeamIds = key ? new Set(key.teams.map((t) => t.id)) : new Set<number>();
  const hasChanges =
    key &&
    selectedTeamIds.size > 0 &&
    (selectedTeamIds.size !== currentTeamIds.size ||
      [...selectedTeamIds].some((id) => !currentTeamIds.has(id)));

  const handleSave = async () => {
    if (!hasChanges || selectedTeamIds.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      await updateAdminKeyTeams(keyId, Array.from(selectedTeamIds));
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update teams");
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    if (!key || key.revoked || key.teams.length === 0) return;
    setRotating(true);
    setError(null);
    try {
      const teamIds = key.teams.map((t) => t.id);
      const res = await createAdminKey(teamIds, key.name ?? undefined);
      await revokeAdminKey(keyId);
      onRotate(res.key, key.name ?? null);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate key");
    } finally {
      setRotating(false);
      setConfirmRotate(false);
    }
  };

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box max-w-md">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : !key ? (
          <p className="text-error text-center py-4">{error ?? "Key not found"}</p>
        ) : confirmRotate ? (
          <>
            <h3 className="font-bold text-lg">Rotate this key?</h3>
            <p className="text-sm text-base-content/70 mt-2">
              A new key will be created with the same teams and name. This key will be revoked
              immediately—update any systems using it before continuing.
            </p>
            {error && (
              <div className="alert alert-error py-2 mt-3">
                <span className="text-sm">{error}</span>
              </div>
            )}
            <div className="modal-action justify-end mt-6">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmRotate(false)}
                disabled={rotating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={rotating}
                onClick={handleRotate}
              >
                {rotating ? <span className="loading loading-spinner loading-sm" /> : "Yes, rotate"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-bold text-lg">
              {key.name ?? <span className="text-base-content/40">Unnamed key</span>}
            </h3>
            <p className="text-xs text-base-content/50 mt-0.5">
              Key values are hashed and cannot be shown after creation.
            </p>

            <div className="grid grid-cols-2 gap-y-3 gap-x-4 mt-5 text-sm">
              <span className="text-base-content/60">Status</span>
              <span>
                {key.revoked ? (
                  <span className="badge badge-error badge-sm">Revoked</span>
                ) : (
                  <span className="badge badge-success badge-sm">Active</span>
                )}
              </span>

              <span className="text-base-content/60">Created</span>
              <span className="text-xs">{formatInTimezone(key.createdAt, timezone)}</span>

              <span className="text-base-content/60">Last used</span>
              <span className="text-xs">
                {key.lastUsedAt ? formatInTimezone(key.lastUsedAt, timezone) : "Never"}
              </span>

              <span className="text-base-content/60">Teams</span>
              <div className="flex flex-wrap gap-1">
                {key.teams.map((t) => (
                  <span key={t.id} className="badge badge-outline badge-xs">
                    {t.name}
                  </span>
                ))}
                {key.teams.length === 0 && <span className="text-base-content/40">None</span>}
              </div>
            </div>

            {!key.revoked && (
              <div className="mt-5">
                <span className="text-sm font-medium block mb-2">Edit teams</span>
                <TeamMultiSelect
                  allTeams={allTeams}
                  selectedIds={selectedTeamIds}
                  onToggle={toggleTeam}
                />
              </div>
            )}

            {error && (
              <div className="alert alert-error py-2 mt-3">
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="modal-action justify-between">
              <div className="flex gap-2">
                {!key.revoked && key.teams.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={rotating}
                    onClick={() => setConfirmRotate(true)}
                  >
                    Rotate
                  </button>
                )}
                {!key.revoked && hasChanges && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={saving || selectedTeamIds.size === 0}
                    onClick={handleSave}
                  >
                    {saving ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      "Save teams"
                    )}
                  </button>
                )}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}

function KeyRevealBanner({
  plainKey,
  keyName,
  action,
  onDismiss,
}: {
  plainKey: string;
  keyName: string | null;
  action: "Created" | "Rotated";
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const label = keyName ? `"${keyName}"` : "Unnamed key";
  const heading = `Key ${label} ${action.toLowerCase()} — save it now, it won't be shown again.`;

  return (
    <div className="alert alert-warning shadow-md">
      <div className="flex flex-col gap-2 w-full">
        <span className="font-semibold text-sm">{heading}</span>
        <div className="flex items-center gap-2">
          <code className="bg-neutral text-neutral-content px-3 py-2 rounded-lg text-sm font-mono break-all flex-1 select-all">
            {plainKey}
          </code>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(plainKey);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyRow({
  apiKey,
  onRevoked,
  onOpenDetail,
}: {
  apiKey: AdminApiKey;
  onRevoked: () => void;
  onOpenDetail: () => void;
}) {
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const { timezone } = useTimezoneContext();

  return (
    <>
      <tr className={`hover:bg-base-200/50 ${apiKey.revoked ? "opacity-40" : ""}`}>
        <td>
          <span className={`font-medium ${apiKey.revoked ? "line-through" : ""}`}>
            {apiKey.name ?? <span className="text-base-content/40 font-normal">Unnamed</span>}
          </span>
        </td>
        <td>
          <div className="flex flex-wrap gap-1">
            {apiKey.teams.map((t) => (
              <span key={t.id} className="badge badge-outline badge-xs">
                {t.name}
              </span>
            ))}
            {apiKey.teams.length === 0 && <span className="text-base-content/40 text-xs">—</span>}
          </div>
        </td>
        <td className="text-xs text-base-content/60">
          {formatInTimezone(apiKey.createdAt, timezone)}
        </td>
        <td className="text-xs text-base-content/60">
          {apiKey.lastUsedAt ? formatInTimezone(apiKey.lastUsedAt, timezone) : "Never"}
        </td>
        <td>
          {apiKey.revoked ? (
            <span className="badge badge-error badge-xs">Revoked</span>
          ) : (
            <span className="badge badge-success badge-xs">Active</span>
          )}
        </td>
        <td>
          <div className="flex gap-1 items-center justify-end">
            <button type="button" className="btn btn-ghost btn-xs" onClick={onOpenDetail}>
              Details
            </button>
            {!apiKey.revoked && !confirmRevoke && (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-error"
                onClick={() => setConfirmRevoke(true)}
              >
                Revoke
              </button>
            )}
          </div>
        </td>
      </tr>
      {confirmRevoke && (
        <tr className="bg-base-200/30">
          <td colSpan={6}>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-base-content/70">
                Revoke {apiKey.name ? `"${apiKey.name}"` : "this key"}? This cannot be undone.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setConfirmRevoke(false)}
                  disabled={revoking}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-error btn-xs"
                  disabled={revoking}
                  onClick={async () => {
                    setRevoking(true);
                    try {
                      await revokeAdminKey(apiKey.id);
                      onRevoked();
                    } finally {
                      setRevoking(false);
                      setConfirmRevoke(false);
                    }
                  }}
                >
                  {revoking ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "Yes, revoke"
                  )}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ──────────────────────── Main page ─────────────────────── */

export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allTeams, setAllTeams] = useState<AdminTeam[]>([]);
  const [keys, setKeys] = useState<AdminApiKey[]>([]);
  const [mainTab, setMainTab] = useState<"users" | "teams" | "keys">("users");
  const [keysFilter, setKeysFilter] = useState<"active" | "revoked" | "all">("active");
  const [revealedKeyInfo, setRevealedKeyInfo] = useState<{
    plainKey: string;
    keyName: string | null;
    action: "Created" | "Rotated";
  } | null>(null);
  const [keyDetailId, setKeyDetailId] = useState<number | null>(null);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [usersRes, teamsRes, keysRes] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminTeams(),
        fetchAdminKeys(),
      ]);
      setUsers(usersRes.data);
      setAllTeams(teamsRes.data);
      setKeys(keysRes.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-error">{error}</p>
        <button type="button" className="btn btn-primary btn-sm mt-4" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const activeKeys = keys.filter((k) => !k.revoked);
  const revokedKeys = keys.filter((k) => k.revoked);
  const filteredKeys =
    keysFilter === "all" ? keys : keysFilter === "active" ? activeKeys : revokedKeys;

  return (
    <>
      {/* Header + tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Access Management</h1>
        <div role="tablist" className="tabs tabs-boxed w-fit">
          {(["users", "teams", "keys"] as const).map((tab) => {
            const count =
              tab === "users"
                ? users.length
                : tab === "teams"
                  ? allTeams.length
                  : activeKeys.length;
            const label = tab === "users" ? "Users" : tab === "teams" ? "Teams" : "API Keys";
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                className={`tab tab-sm ${mainTab === tab ? "tab-active" : ""}`}
                onClick={() => setMainTab(tab)}
              >
                {label}
                <span className="ml-1.5 badge badge-xs badge-neutral">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Users */}
      {mainTab === "users" && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Users</h2>
          </div>
          {users.length === 0 ? (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body text-center py-8">
                <p className="text-base-content/50">No users have logged in yet.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map((user) => (
                <UserCard key={user.id} user={user} allTeams={allTeams} onChanged={loadData} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Teams */}
      {mainTab === "teams" && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Teams</h2>
            <CreateTeamForm onCreated={loadData} />
          </div>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-5">
              {allTeams.length === 0 ? (
                <p className="text-base-content/50 text-sm text-center py-2">
                  No teams yet. Create one or add teams to jobs in your config.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allTeams.map((team) => (
                    <div key={team.id} className="badge badge-lg badge-outline gap-2 py-3">
                      <div className="w-2 h-2 rounded-full bg-primary" style={{ opacity: 0.6 }} />
                      {team.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Key reveal banner - always visible when there's a new/rotated key */}
      {revealedKeyInfo && (
        <div className="mb-4">
          <KeyRevealBanner
            plainKey={revealedKeyInfo.plainKey}
            keyName={revealedKeyInfo.keyName}
            action={revealedKeyInfo.action}
            onDismiss={() => setRevealedKeyInfo(null)}
          />
        </div>
      )}

      {/* API Keys */}
      {mainTab === "keys" && (
        <div>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold">API Keys</h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateKey(true)}
            >
              + New Key
            </button>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-0">
              <div className="px-5 pt-4 pb-2">
                <div role="tablist" className="tabs tabs-boxed w-fit">
                  {(["active", "revoked", "all"] as const).map((tab) => {
                    const count =
                      tab === "active"
                        ? activeKeys.length
                        : tab === "revoked"
                          ? revokedKeys.length
                          : keys.length;
                    return (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        className={`tab tab-sm ${keysFilter === tab ? "tab-active" : ""}`}
                        onClick={() => setKeysFilter(tab)}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        <span className="ml-1.5 badge badge-xs badge-neutral">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Teams</th>
                      <th>Created</th>
                      <th>Last used</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKeys.map((k) => (
                      <KeyRow
                        key={k.id}
                        apiKey={k}
                        onRevoked={loadData}
                        onOpenDetail={() => setKeyDetailId(k.id)}
                      />
                    ))}
                  </tbody>
                </table>
                {keys.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-base-content/50">No API keys yet.</p>
                    <p className="text-sm text-base-content/40 mt-1">
                      Create one to enable machine-to-machine access.
                    </p>
                  </div>
                )}
                {keys.length > 0 && filteredKeys.length === 0 && (
                  <p className="text-sm text-base-content/50 text-center py-6">
                    No {keysFilter} keys.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateKey && (
        <CreateKeyModal
          allTeams={allTeams}
          onClose={() => setShowCreateKey(false)}
          onCreated={(plainKey, keyName) => {
            setShowCreateKey(false);
            setRevealedKeyInfo({ plainKey, keyName, action: "Created" });
            loadData();
          }}
        />
      )}

      {keyDetailId != null && (
        <KeyDetailModal
          keyId={keyDetailId}
          allTeams={allTeams}
          onClose={() => setKeyDetailId(null)}
          onSaved={loadData}
          onRotate={(plainKey, keyName) => {
            setRevealedKeyInfo({ plainKey, keyName, action: "Rotated" });
            loadData();
          }}
        />
      )}
    </>
  );
}
