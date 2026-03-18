import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];

import { TimeAgo } from "../components/TimeAgo";
import { usePolling } from "../hooks/usePolling";
import { createTeam, deleteTeam, fetchTeams, updateTeamName } from "../lib/api";
import type { TeamRow } from "../lib/types";

export function TeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
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

  async function handleDelete() {
    if (!confirmDelete) return;
    await deleteTeam(confirmDelete.id);
    setConfirmDelete(null);
    await load();
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-foreground mb-1">Teams</h1>
          <p className="text-muted-foreground text-sm">Manage teams and organize access control.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-all hover:opacity-90 shrink-0 self-start sm:self-auto"
          style={{
            backgroundColor: "var(--gruvbox-orange-bright)",
            color: "var(--gruvbox-bg0)",
          }}
        >
          <Plus className="w-4 h-4" />
          Create Team
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <SkeletonTable />
        ) : teams.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-foreground mb-1">No teams yet</h3>
            <p className="text-sm text-muted-foreground">Create your first team to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-4 text-sm text-muted-foreground text-left font-medium">
                    Name
                  </th>
                  <th className="px-6 py-4 text-sm text-muted-foreground text-left font-medium">
                    Created
                  </th>
                  <th className="px-6 py-4 text-sm text-muted-foreground text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr
                    key={team.id}
                    className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="text-foreground">{team.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      <TimeAgo date={team.createdAt} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Rename"
                          onClick={() => setEditingTeam(team)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-lg hover:bg-accent transition-colors"
                          style={{ color: "var(--gruvbox-red-bright)" }}
                          title="Delete"
                          onClick={() => setConfirmDelete({ id: team.id, name: team.name })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modals */}
      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            load();
          }}
        />
      )}

      {editingTeam && (
        <EditTeamModal
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSaved={() => {
            setEditingTeam(null);
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
    </div>
  );
}

/* ─── Skeleton Table ─── */

function SkeletonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-6 py-4 text-sm text-muted-foreground text-left font-medium">Name</th>
            <th className="px-6 py-4 text-sm text-muted-foreground text-left font-medium">
              Created
            </th>
            <th className="px-6 py-4 text-sm text-muted-foreground text-right font-medium">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 3 }, (_, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="px-6 py-4">
                <div className="bg-muted animate-pulse rounded h-4 w-36" />
              </td>
              <td className="px-6 py-4">
                <div className="bg-muted animate-pulse rounded h-4 w-16" />
              </td>
              <td className="px-6 py-4">
                <div className="bg-muted animate-pulse rounded h-6 w-16 ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Create Team Modal ─── */

function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: FormSubmitEvent) {
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
    <div
      ref={backdropRef}
      role="dialog"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === backdropRef.current && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <h2 className="text-foreground">Create Team</h2>
        </div>
        <div className="border-t border-border" />
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            <div>
              <span className="text-sm text-muted-foreground mb-2 block">Name</span>
              <input
                type="text"
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                placeholder="e.g. Engineering, Operations"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm" style={{ color: "var(--gruvbox-red-bright)" }}>
                {error}
              </p>
            )}
          </div>
          <div className="border-t border-border" />
          <div className="px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm bg-accent text-foreground hover:bg-accent/70 transition-colors"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: "var(--gruvbox-orange-bright)",
                color: "var(--gruvbox-bg0)",
              }}
              disabled={!name.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Edit Team Modal ─── */

function EditTeamModal({
  team,
  onClose,
  onSaved,
}: {
  team: TeamRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(team.name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setIsSubmitting(true);
    await updateTeamName(team.id, name.trim());
    setIsSubmitting(false);
    onSaved();
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
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <h2 className="text-foreground">Edit Team</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="border-t border-border" />
        <div className="px-6 py-5">
          <span className="text-sm text-muted-foreground mb-2 block">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
          />
        </div>
        <div className="border-t border-border" />
        <div className="px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm bg-accent text-foreground hover:bg-accent/70 transition-colors"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || isSubmitting}
            className="px-4 py-2 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "var(--gruvbox-orange-bright)",
              color: "var(--gruvbox-bg0)",
            }}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Team Modal ─── */

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
  const backdropRef = useRef<HTMLDivElement>(null);

  async function handleConfirm() {
    setIsSubmitting(true);
    await onConfirm();
    setIsSubmitting(false);
  }

  return (
    <div
      ref={backdropRef}
      role="dialog"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === backdropRef.current && onCancel()}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-foreground">Delete Team</h2>
        </div>
        <div className="border-t border-border" />
        <div className="px-6 py-5">
          <p className="text-sm text-foreground">
            Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
          </p>
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
            className="px-4 py-2 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--gruvbox-red)", color: "var(--gruvbox-bg0)" }}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            ) : (
              "Delete Team"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
