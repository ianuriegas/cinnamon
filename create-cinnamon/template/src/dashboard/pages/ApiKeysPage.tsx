import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];

import { TimeAgo } from "../components/TimeAgo";
import { usePolling } from "../hooks/usePolling";
import {
  createApiKey,
  fetchApiKeys,
  fetchTeams,
  revokeApiKey,
  rotateApiKey,
  updateApiKeyLabel,
} from "../lib/api";
import type { ApiKeyRow, TeamRow } from "../lib/types";

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    type: "revoke" | "rotate";
    id: number;
    label: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetchApiKeys();
    setKeys(res.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 10000);

  function startEdit(key: ApiKeyRow) {
    setEditingId(key.id);
    setEditLabel(key.label ?? "");
  }

  async function saveLabel(id: number) {
    if (!editLabel.trim()) return;
    await updateApiKeyLabel(id, editLabel.trim());
    setEditingId(null);
    await load();
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    if (confirmAction.type === "revoke") {
      await revokeApiKey(confirmAction.id);
      setConfirmAction(null);
      await load();
    } else if (confirmAction.type === "rotate") {
      const res = await rotateApiKey(confirmAction.id);
      setConfirmAction(null);
      setRevealedKey(res.plainKey);
      await load();
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreateModal(true)}
        >
          Create Key
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-0">
          {isLoading ? (
            <SkeletonTable />
          ) : keys.length === 0 ? (
            <div className="text-center py-12 text-base-content/60">
              <p className="text-lg">No API keys</p>
              <p className="text-sm mt-1">Create one to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Team</th>
                    <th>Key</th>
                    <th>Status</th>
                    <th>Last Used</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} className="hover:bg-base-300">
                      <td>
                        {editingId === key.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              className="input input-xs input-bordered w-36"
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveLabel(key.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => saveLabel(key.id)}
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
                          <span className="font-semibold">
                            {key.label || <span className="text-base-content/40">unlabeled</span>}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-sm">{key.teamName}</span>
                      </td>
                      <td>
                        <code className="text-xs bg-base-200 px-1.5 py-0.5 rounded">
                          cin_...{key.keyHint}
                        </code>
                      </td>
                      <td>
                        {key.revoked ? (
                          <span className="badge badge-error badge-sm">Revoked</span>
                        ) : (
                          <span className="badge badge-success badge-sm">Active</span>
                        )}
                      </td>
                      <td>
                        <TimeAgo date={key.lastUsedAt} />
                      </td>
                      <td>
                        <TimeAgo date={key.createdAt} />
                      </td>
                      <td>
                        {key.revoked ? (
                          <span className="text-xs text-base-content/40">—</span>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              title="Rename"
                              onClick={() => startEdit(key)}
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
                              className="btn btn-ghost btn-xs"
                              title="Rotate"
                              onClick={() =>
                                setConfirmAction({ type: "rotate", id: key.id, label: key.label })
                              }
                            >
                              <svg
                                role="img"
                                aria-label="Rotate"
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
                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                <path d="M21 3v5h-5" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-error"
                              title="Revoke"
                              onClick={() =>
                                setConfirmAction({ type: "revoke", id: key.id, label: key.label })
                              }
                            >
                              <svg
                                role="img"
                                aria-label="Revoke"
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
                                <circle cx="12" cy="12" r="10" />
                                <path d="m4.9 4.9 14.2 14.2" />
                              </svg>
                            </button>
                          </div>
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

      {showCreateModal && (
        <CreateKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(plainKey) => {
            setShowCreateModal(false);
            setRevealedKey(plainKey);
            load();
          }}
        />
      )}

      {revealedKey && (
        <RevealKeyModal plainKey={revealedKey} onClose={() => setRevealedKey(null)} />
      )}

      {confirmAction && (
        <ConfirmModal
          type={confirmAction.type}
          label={confirmAction.label}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
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
            <th>Label</th>
            <th>Team</th>
            <th>Key</th>
            <th>Status</th>
            <th>Last Used</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }, (_, i) => (
            <tr key={i}>
              <td>
                <div className="skeleton h-4 w-28" />
              </td>
              <td>
                <div className="skeleton h-4 w-20" />
              </td>
              <td>
                <div className="skeleton h-4 w-24" />
              </td>
              <td>
                <div className="skeleton h-5 w-14 rounded-full" />
              </td>
              <td>
                <div className="skeleton h-4 w-16" />
              </td>
              <td>
                <div className="skeleton h-4 w-16" />
              </td>
              <td>
                <div className="skeleton h-6 w-20" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateKeyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (plainKey: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>();
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams().then((res) => {
      setTeams(res.data);
      if (res.data.length > 0) setSelectedTeamId(res.data[0].id);
      setIsLoadingTeams(false);
    });
  }, []);

  async function handleSubmit(e: FormSubmitEvent) {
    e.preventDefault();
    if (!label.trim() || !selectedTeamId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await createApiKey(label.trim(), selectedTeamId);
      onCreated(res.plainKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setIsSubmitting(false);
    }
  }

  const noTeams = !isLoadingTeams && teams.length === 0;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Create API Key</h3>
        {noTeams ? (
          <div className="mt-4">
            <p className="text-sm text-base-content/60">
              No teams exist yet. Create a team first before generating API keys.
            </p>
            <div className="modal-action">
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
              <a href="/admin/teams" className="btn btn-primary">
                Go to Teams
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4">
            <div className="form-control">
              <label className="label" htmlFor="key-label">
                <span className="label-text">Label</span>
              </label>
              <input
                id="key-label"
                type="text"
                className="input input-bordered w-full"
                placeholder="e.g. production, staging"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="form-control mt-3">
              <label className="label" htmlFor="key-team">
                <span className="label-text">Team</span>
              </label>
              {isLoadingTeams ? (
                <div className="skeleton h-12 w-full rounded-lg" />
              ) : (
                <select
                  id="key-team"
                  className="select select-bordered w-full"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {error && <p className="text-error text-sm mt-2">{error}</p>}
            <div className="modal-action">
              <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!label.trim() || !selectedTeamId || isSubmitting}
              >
                {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Create"}
              </button>
            </div>
          </form>
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

function RevealKeyModal({ plainKey, onClose }: { plainKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleCopy() {
    await navigator.clipboard.writeText(plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Your New API Key</h3>
        <div className="alert alert-warning mt-4">
          <svg
            role="img"
            aria-label="Warning"
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <span className="text-sm">Copy this key now. It will not be shown again.</span>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <input
            ref={inputRef}
            type="text"
            readOnly
            value={plainKey}
            className="input input-bordered input-sm font-mono w-full text-xs"
            onClick={() => inputRef.current?.select()}
          />
          <button type="button" className="btn btn-sm btn-outline" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            I've saved this key
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ConfirmModal({
  type,
  label,
  onConfirm,
  onCancel,
}: {
  type: "revoke" | "rotate";
  label: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = type === "revoke" ? "Revoke API Key" : "Rotate API Key";
  const description =
    type === "revoke"
      ? `This will permanently revoke the key "${label ?? "unlabeled"}". Any requests using it will be rejected.`
      : `This will revoke the current key "${label ?? "unlabeled"}" and generate a new one. Update your applications with the new key.`;

  async function handleConfirm() {
    setIsSubmitting(true);
    await onConfirm();
    setIsSubmitting(false);
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-4 text-sm">{description}</p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${type === "revoke" ? "btn-error" : "btn-warning"}`}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : type === "revoke" ? (
              "Revoke"
            ) : (
              "Rotate"
            )}
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
