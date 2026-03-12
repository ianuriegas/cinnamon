import { useCallback, useEffect, useState } from "react";
import { TimeAgo } from "../components/TimeAgo";
import { usePolling } from "../hooks/usePolling";
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

type Tab = "users" | "requests";

export function UsersPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [usersList, setUsersList] = useState<UserRow[]>([]);
  const [requests, setRequests] = useState<AccessRequestRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [denyModal, setDenyModal] = useState<{ id: number; email: string } | null>(null);
  const [approveModal, setApproveModal] = useState<{ id: number; email: string } | null>(null);
  const [editTeamsModal, setEditTeamsModal] = useState<UserRow | null>(null);

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

  async function toggleDisabled(user: UserRow) {
    await updateUser(user.id, { disabled: !user.disabled });
    await load();
  }

  async function handleApprove(id: number, teamIds?: number[]) {
    await approveAccessRequest(id, teamIds);
    setApproveModal(null);
    await load();
  }

  async function handleEditTeams(user: UserRow, teamIds: number[]) {
    await updateUserTeams(user.id, teamIds);
    setEditTeamsModal(null);
    await load();
  }

  async function handleDeny(id: number, notes?: string) {
    await denyAccessRequest(id, notes);
    setDenyModal(null);
    await load();
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
      </div>

      <div role="tablist" className="tabs tabs-bordered mb-4">
        <button
          type="button"
          role="tab"
          className={`tab ${tab === "users" ? "tab-active" : ""}`}
          onClick={() => setTab("users")}
        >
          Users
          <span className="badge badge-warning badge-sm ml-2">{usersList.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${tab === "requests" ? "tab-active" : ""}`}
          onClick={() => setTab("requests")}
        >
          Access Requests
          {pendingCount > 0 && (
            <span className="badge badge-warning badge-sm ml-2">{pendingCount}</span>
          )}
        </button>
      </div>

      {tab === "users" && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-0">
            {isLoading ? (
              <SkeletonTable cols={7} />
            ) : usersList.length === 0 ? (
              <div className="text-center py-12 text-base-content/60">
                <p className="text-lg">No users</p>
                <p className="text-sm mt-1">Users are created when they sign in via Google OAuth</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Teams</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-base-300">
                        <td>
                          <div className="flex items-center gap-2">
                            {u.picture ? (
                              <img
                                src={u.picture}
                                alt=""
                                className="w-7 h-7 rounded-full"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-base-300 flex items-center justify-center text-xs font-bold">
                                {(u.name ?? u.email)[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="font-semibold">{u.name ?? "—"}</span>
                          </div>
                        </td>
                        <td className="text-sm">{u.email}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {(u.teams ?? []).map((t) => (
                              <span key={t.id} className="badge badge-ghost badge-sm">
                                {t.name}
                              </span>
                            ))}
                            {(!u.teams || u.teams.length === 0) && (
                              <span className="text-base-content/50 text-xs">—</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {u.isSuperAdmin && (
                            <span className="badge badge-primary badge-sm">Super Admin</span>
                          )}
                        </td>
                        <td>
                          {u.disabled ? (
                            <span className="badge badge-error badge-sm">Disabled</span>
                          ) : (
                            <span className="badge badge-success badge-sm">Active</span>
                          )}
                        </td>
                        <td className="text-sm">
                          {u.lastLoginAt ? <TimeAgo date={u.lastLoginAt} /> : "Never"}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            {!u.isSuperAdmin && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-ghost"
                                  onClick={() => setEditTeamsModal(u)}
                                  title="Edit teams"
                                >
                                  Teams
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-xs ${u.disabled ? "btn-success" : "btn-warning"}`}
                                  onClick={() => toggleDisabled(u)}
                                >
                                  {u.disabled ? "Enable" : "Disable"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "requests" && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-0">
            {isLoading ? (
              <SkeletonTable cols={5} />
            ) : requests.length === 0 ? (
              <div className="text-center py-12 text-base-content/60">
                <p className="text-lg">No access requests</p>
                <p className="text-sm mt-1">
                  Requests appear when users sign in and request dashboard access
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Requested</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id} className="hover:bg-base-300">
                        <td>
                          <div className="flex items-center gap-2">
                            {r.picture ? (
                              <img
                                src={r.picture}
                                alt=""
                                className="w-7 h-7 rounded-full"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-base-300 flex items-center justify-center text-xs font-bold">
                                {(r.name ?? r.email)[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="font-semibold">{r.name ?? "—"}</span>
                          </div>
                        </td>
                        <td className="text-sm">{r.email}</td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="text-sm">
                          <TimeAgo date={r.requestedAt} />
                        </td>
                        <td>
                          {r.status === "pending" ? (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="btn btn-xs btn-success"
                                onClick={() => setApproveModal({ id: r.id, email: r.email })}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-xs btn-error"
                                onClick={() => setDenyModal({ id: r.id, email: r.email })}
                              >
                                Deny
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-base-content/50">
                              {r.decidedAt && <TimeAgo date={r.decidedAt} />}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {denyModal && (
        <DenyModal
          email={denyModal.email}
          onConfirm={(notes) => handleDeny(denyModal.id, notes)}
          onCancel={() => setDenyModal(null)}
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
      {editTeamsModal && (
        <EditTeamsModal
          user={editTeamsModal}
          teams={teams}
          onConfirm={(teamIds) => handleEditTeams(editTeamsModal, teamIds)}
          onCancel={() => setEditTeamsModal(null)}
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "pending"
      ? "badge-warning"
      : status === "approved"
        ? "badge-success"
        : "badge-error";
  return <span className={`badge badge-sm ${variant}`}>{status}</span>;
}

function SkeletonTable({ cols }: { cols: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i}>
                <div className="skeleton h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 3 }, (_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }, (_, j) => (
                <td key={j}>
                  <div className="skeleton h-4 w-24" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

  function toggle(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    await onConfirm(selectedIds);
    setIsSubmitting(false);
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Approve Access Request</h3>
        <p className="py-2 text-sm">
          Approve access for <span className="font-semibold">{email}</span>?
        </p>
        <div className="form-control">
          <fieldset className="flex flex-col gap-2">
            <legend id="approve-teams-label" className="label-text">
              Assign to teams (optional)
            </legend>
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => (
                <label key={t.id} className="cursor-pointer flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedIds.includes(t.id)}
                    onChange={() => toggle(t.id)}
                  />
                  <span>{t.name}</span>
                </label>
              ))}
              {teams.length === 0 && (
                <span className="text-sm text-base-content/50">No teams exist yet</span>
              )}
            </div>
          </fieldset>
        </div>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Approve"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onCancel}>
          close
        </button>
      </form>
    </dialog>
  );
}

function EditTeamsModal({
  user,
  teams,
  onConfirm,
  onCancel,
}: {
  user: UserRow;
  teams: TeamRow[];
  onConfirm: (teamIds: number[]) => void;
  onCancel: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>((user.teams ?? []).map((t) => t.id));
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggle(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    await onConfirm(selectedIds);
    setIsSubmitting(false);
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Edit Teams</h3>
        <p className="py-2 text-sm">
          Assign teams for <span className="font-semibold">{user.name ?? user.email}</span>
        </p>
        <div className="form-control">
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <label key={t.id} className="cursor-pointer flex items-center gap-1">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={selectedIds.includes(t.id)}
                  onChange={() => toggle(t.id)}
                />
                <span>{t.name}</span>
              </label>
            ))}
            {teams.length === 0 && (
              <span className="text-sm text-base-content/50">No teams exist yet</span>
            )}
          </div>
        </div>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Save"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onCancel}>
          close
        </button>
      </form>
    </dialog>
  );
}

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
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Deny Access Request</h3>
        <p className="py-2 text-sm">
          Deny access for <span className="font-semibold">{email}</span>?
        </p>
        <div className="form-control">
          <label className="label" htmlFor="deny-notes">
            <span className="label-text">Reason (optional)</span>
          </label>
          <textarea
            id="deny-notes"
            className="textarea textarea-bordered w-full"
            placeholder="Optional reason shown to the user"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Deny"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onCancel}>
          close
        </button>
      </form>
    </dialog>
  );
}
