import { useCallback, useEffect, useState } from "react";
import { TimeAgo } from "../components/TimeAgo";
import { usePolling } from "../hooks/usePolling";
import {
  approveAccessRequest,
  denyAccessRequest,
  fetchAccessRequests,
  fetchUsers,
  updateUser,
} from "../lib/api";
import type { AccessRequestRow, UserRow } from "../lib/types";

type Tab = "users" | "requests";

export function UsersPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [usersList, setUsersList] = useState<UserRow[]>([]);
  const [requests, setRequests] = useState<AccessRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [denyModal, setDenyModal] = useState<{ id: number; email: string } | null>(null);

  const load = useCallback(async () => {
    const [usersRes, requestsRes] = await Promise.all([fetchUsers(), fetchAccessRequests()]);
    setUsersList(usersRes.data);
    setRequests(requestsRes.data);
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

  async function handleApprove(id: number) {
    await approveAccessRequest(id);
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
          Users ({usersList.length})
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
              <SkeletonTable cols={6} />
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
                          {!u.isSuperAdmin && (
                            <button
                              type="button"
                              className={`btn btn-xs ${u.disabled ? "btn-success" : "btn-warning"}`}
                              onClick={() => toggleDisabled(u)}
                            >
                              {u.disabled ? "Enable" : "Disable"}
                            </button>
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
                                onClick={() => handleApprove(r.id)}
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
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
              <th key={i}>
                <div className="skeleton h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 3 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
            <tr key={i}>
              {Array.from({ length: cols }, (_, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
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
