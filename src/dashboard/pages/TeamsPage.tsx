import { useCallback, useEffect, useState } from "react";
import { TimeAgo } from "../components/TimeAgo";
import { usePolling } from "../hooks/usePolling";
import { createTeam, deleteTeam, fetchTeams, updateTeamName } from "../lib/api";
import type { TeamRow } from "../lib/types";

export function TeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetchTeams();
    setTeams(res.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 10000);

  function startEdit(team: TeamRow) {
    setEditingId(team.id);
    setEditName(team.name);
  }

  async function saveName(id: number) {
    if (!editName.trim()) return;
    await updateTeamName(id, editName.trim());
    setEditingId(null);
    await load();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await deleteTeam(confirmDelete.id);
    setConfirmDelete(null);
    await load();
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Teams</h1>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreateModal(true)}
        >
          Create Team
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-0">
          {isLoading ? (
            <SkeletonTable />
          ) : teams.length === 0 ? (
            <div className="text-center py-12 text-base-content/60">
              <p className="text-lg">No teams</p>
              <p className="text-sm mt-1">Create one to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.id} className="hover:bg-base-300">
                      <td>
                        {editingId === team.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              className="input input-xs input-bordered w-48"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveName(team.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => saveName(team.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="font-semibold">{team.name}</span>
                        )}
                      </td>
                      <td>
                        <TimeAgo date={team.createdAt} />
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            title="Rename"
                            onClick={() => startEdit(team)}
                          >
                            <svg
                              role="img"
                              aria-label="Rename"
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error"
                            title="Delete"
                            onClick={() => setConfirmDelete({ id: team.id, name: team.name })}
                          >
                            <svg
                              role="img"
                              aria-label="Delete"
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
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

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            load();
          }}
        />
      )}

      {confirmDelete && (
        <DeleteTeamModal
          name={confirmDelete.name}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

function SkeletonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Name</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 3 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
            <tr key={i}>
              <td>
                <div className="skeleton h-4 w-36" />
              </td>
              <td>
                <div className="skeleton h-4 w-16" />
              </td>
              <td>
                <div className="skeleton h-6 w-16" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await createTeam(name.trim());
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Create Team</h3>
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="form-control">
            <label className="label" htmlFor="team-name">
              <span className="label-text">Name</span>
            </label>
            <input
              id="team-name"
              type="text"
              className="input input-bordered w-full"
              placeholder="e.g. Engineering, Operations"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className="text-error text-sm mt-2">{error}</p>}
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || isSubmitting}
            >
              {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Create"}
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

function DeleteTeamModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    setIsSubmitting(true);
    await onConfirm();
    setIsSubmitting(false);
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Delete Team</h3>
        <p className="py-4 text-sm">
          This will permanently delete the team "{name}" and revoke all its API keys. Job run
          history will be kept but no longer linked to a team.
        </p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Delete"}
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
