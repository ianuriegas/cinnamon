import {
  AlertTriangle,
  Ban,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Key,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  X,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { FilterPills } from "../components/FilterPills";
import { SearchInput } from "../components/SearchInput";
import { TeamFilterDropdown } from "../components/TeamFilterDropdown";
import { TimeAgo } from "../components/TimeAgo";
import { usePolling } from "../hooks/usePolling";
import { useUrlFilters } from "../hooks/useUrlFilters";
import {
  createApiKey,
  fetchApiKeys,
  fetchTeams,
  revokeApiKey,
  rotateApiKey,
  updateApiKeyLabel,
} from "../lib/api";
import type { ApiKeyRow, TeamRow } from "../lib/types";

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];
type KeyStatus = "active" | "revoked" | "expired";

const STATUS_CONFIG: Record<KeyStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: "var(--gruvbox-green)", fg: "var(--gruvbox-bg0)", label: "Active" },
  revoked: { bg: "var(--gruvbox-red)", fg: "var(--gruvbox-bg0)", label: "Revoked" },
  expired: { bg: "var(--gruvbox-bg4)", fg: "var(--gruvbox-bg0)", label: "Expired" },
};

const KEY_STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "var(--gruvbox-green)" },
  { value: "revoked", label: "Revoked", color: "var(--gruvbox-red)" },
  { value: "expired", label: "Expired", color: "var(--gruvbox-bg4)" },
] as const;

const FILTER_KEYS = ["q", "status", "team"] as const;

export function ApiKeysPage() {
  const { filters, setFilter, clearFilters, activeFilterCount } = useUrlFilters(FILTER_KEYS, {
    excludeFromCount: ["q"],
  });

  const searchQuery = filters.q;
  const filterStatus = (filters.status as KeyStatus) || null;
  const filterTeam = filters.team || null;

  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<ApiKeyRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "revoke" | "rotate";
    id: number;
    label: string | null;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [revealedId, setRevealedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetchApiKeys();
    setKeys(res.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 10000);

  async function handleConfirmAction() {
    if (!confirmAction) return;
    if (confirmAction.type === "revoke") {
      await revokeApiKey(confirmAction.id);
      setConfirmAction(null);
      await load();
    } else {
      const res = await rotateApiKey(confirmAction.id);
      setConfirmAction(null);
      setRevealedKey(res.plainKey);
      await load();
    }
  }

  function handleCopy(id: number, hint: string) {
    navigator.clipboard?.writeText(`cin_...${hint}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filteredKeys = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return keys.filter((k) => {
      if (q) {
        const matchLabel = k.label?.toLowerCase().includes(q);
        const matchTeam = k.teamName.toLowerCase().includes(q);
        const matchKey = k.keyHint.toLowerCase().includes(q);
        if (!matchLabel && !matchTeam && !matchKey) return false;
      }
      if (filterStatus && k.status !== filterStatus) return false;
      if (filterTeam && k.teamName !== filterTeam) return false;
      return true;
    });
  }, [keys, searchQuery, filterStatus, filterTeam]);

  const activeCount = keys.filter((k) => k.status === "active").length;
  const teamNames = useMemo(() => [...new Set(keys.map((k) => k.teamName))].sort(), [keys]);
  const isFiltering = searchQuery || activeFilterCount > 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-foreground mb-1">API Keys</h1>
          <p className="text-muted-foreground text-sm">
            Manage API keys for programmatic access to Cinnamon.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-all hover:opacity-90 shrink-0 self-start sm:self-auto"
          style={{ backgroundColor: "var(--gruvbox-orange-bright)", color: "var(--gruvbox-bg0)" }}
        >
          <Plus className="w-4 h-4" />
          Create Key
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard
          icon={<Key className="w-4 h-4" />}
          label="Total Keys"
          value={keys.length}
          color="var(--gruvbox-blue-bright)"
        />
        <StatCard
          icon={<Shield className="w-4 h-4" />}
          label="Active"
          value={activeCount}
          color="var(--gruvbox-green-bright)"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Revoked / Expired"
          value={keys.length - activeCount}
          color="var(--gruvbox-red-bright)"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <SearchInput
        value={searchQuery}
        onChange={(v) => setFilter("q", v || null)}
        placeholder="Search by label, team, or key..."
        className="mb-4"
      />

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <FilterPills
          label="Status"
          options={KEY_STATUS_OPTIONS}
          value={filters.status}
          onChange={(v) => setFilter("status", v || null)}
        />

        {teamNames.length > 0 && (
          <TeamFilterDropdown
            teams={teamNames}
            selected={filterTeam}
            onSelect={(t) => setFilter("team", filterTeam === t ? null : t)}
          />
        )}

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => clearFilters(["status", "team"])}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 ml-2"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Result count */}
      {isFiltering && (
        <p className="text-xs text-muted-foreground mb-4">
          Showing {filteredKeys.length} of {keys.length} keys
        </p>
      )}

      {/* Key cards */}
      {isLoading ? (
        <SkeletonCards />
      ) : filteredKeys.length === 0 ? (
        <div className="text-center py-16">
          <Key className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-foreground mb-1">No API keys found</h3>
          <p className="text-sm text-muted-foreground">
            {isFiltering
              ? "Try adjusting your search or filters."
              : "Create your first API key to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredKeys.map((apiKey) => (
            <KeyCard
              key={apiKey.id}
              apiKey={apiKey}
              copiedId={copiedId}
              revealedId={revealedId}
              confirmAction={confirmAction}
              onCopy={handleCopy}
              onToggleReveal={(id) => setRevealedId(revealedId === id ? null : id)}
              onEdit={setEditingKey}
              onConfirmRevoke={(id, label) => setConfirmAction({ type: "revoke", id, label })}
              onConfirmRotate={(id, label) => setConfirmAction({ type: "rotate", id, label })}
              onExecuteAction={handleConfirmAction}
              onCancelAction={() => setConfirmAction(null)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
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
      {editingKey && (
        <EditKeyModal
          apiKey={editingKey}
          onClose={() => setEditingKey(null)}
          onSaved={() => {
            setEditingKey(null);
            load();
          }}
        />
      )}
      {revealedKey && (
        <RevealKeyModal plainKey={revealedKey} onClose={() => setRevealedKey(null)} />
      )}
    </div>
  );
}

/* ─── Stat Card ─── */

function StatCard({
  icon,
  label,
  value,
  color,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  className?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

/* ─── Key Card ─── */

function KeyCard({
  apiKey,
  copiedId,
  revealedId,
  confirmAction,
  onCopy,
  onToggleReveal,
  onEdit,
  onConfirmRevoke,
  onConfirmRotate,
  onExecuteAction,
  onCancelAction,
}: {
  apiKey: ApiKeyRow;
  copiedId: number | null;
  revealedId: number | null;
  confirmAction: { type: "revoke" | "rotate"; id: number; label: string | null } | null;
  onCopy: (id: number, hint: string) => void;
  onToggleReveal: (id: number) => void;
  onEdit: (k: ApiKeyRow) => void;
  onConfirmRevoke: (id: number, label: string | null) => void;
  onConfirmRotate: (id: number, label: string | null) => void;
  onExecuteAction: () => void;
  onCancelAction: () => void;
}) {
  const isInactive = apiKey.status !== "active";
  const sc = STATUS_CONFIG[apiKey.status];

  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 md:p-5 transition-colors group ${
        isInactive ? "opacity-60" : "hover:border-muted-foreground/30"
      }`}
    >
      <div className="flex flex-col gap-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: isInactive ? "var(--border)" : "var(--gruvbox-orange-bright)",
                color: "var(--gruvbox-bg0)",
              }}
            >
              <Key className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-foreground truncate">
                  {apiKey.label || <span className="text-muted-foreground/40">unlabeled</span>}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs shrink-0"
                  style={{ backgroundColor: sc.bg, color: sc.fg }}
                >
                  {sc.label}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{apiKey.teamName}</span>
            </div>
          </div>

          {!isInactive && (
            <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onEdit(apiKey)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onConfirmRotate(apiKey.id, apiKey.label)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Rotate"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onConfirmRevoke(apiKey.id, apiKey.label)}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                style={{ color: "var(--gruvbox-red-bright)" }}
                title="Revoke"
              >
                <Ban className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Key value row */}
        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border">
          <code className="text-sm text-muted-foreground flex-1 font-mono truncate">
            {revealedId === apiKey.id
              ? `cin_sk_${apiKey.keyHint}${"•".repeat(20)}`
              : `cin_...${apiKey.keyHint}`}
          </code>
          <button
            type="button"
            onClick={() => onToggleReveal(apiKey.id)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {revealedId === apiKey.id ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onCopy(apiKey.id, apiKey.keyHint)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {copiedId === apiKey.id ? (
              <Check className="w-3.5 h-3.5" style={{ color: "var(--gruvbox-green-bright)" }} />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Created <TimeAgo date={apiKey.createdAt} />
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {apiKey.lastUsedAt ? (
              <>
                Used <TimeAgo date={apiKey.lastUsedAt} />
              </>
            ) : (
              "Never used"
            )}
          </span>
          {apiKey.expiresAt && (
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              {new Date(apiKey.expiresAt) < new Date() ? (
                "Expired"
              ) : (
                <>
                  Expires <TimeAgo date={apiKey.expiresAt} />
                </>
              )}
            </span>
          )}
        </div>

        {/* Inline confirm */}
        {confirmAction?.id === apiKey.id && (
          <div className="bg-background border border-border rounded-xl p-3 mt-1">
            <p className="text-sm text-foreground mb-3">
              {confirmAction.type === "revoke" ? (
                <>
                  Revoke <strong>{apiKey.label ?? "unlabeled"}</strong>? Any requests using this key
                  will be rejected.
                </>
              ) : (
                <>
                  Rotate <strong>{apiKey.label ?? "unlabeled"}</strong>? The current key will be
                  revoked and a new one generated.
                </>
              )}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancelAction}
                className="px-3 py-1.5 rounded-lg text-xs bg-accent text-foreground hover:bg-accent/70 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onExecuteAction}
                className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={
                  confirmAction.type === "revoke"
                    ? { backgroundColor: "var(--gruvbox-red)", color: "var(--gruvbox-bg0)" }
                    : { backgroundColor: "var(--gruvbox-yellow)", color: "var(--gruvbox-bg0)" }
                }
              >
                {confirmAction.type === "revoke" ? "Revoke Key" : "Rotate Key"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Skeleton Cards ─── */

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-muted" />
            <div className="flex-1">
              <div className="bg-muted rounded h-4 w-32 mb-1.5" />
              <div className="bg-muted rounded h-3 w-20" />
            </div>
          </div>
          <div className="bg-muted rounded-lg h-9 w-full mb-3" />
          <div className="bg-muted rounded h-3 w-48" />
        </div>
      ))}
    </div>
  );
}

/* ─── Create Key Modal ─── */

const EXPIRATION_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
] as const;

function expirationToDate(value: string): string | undefined {
  if (value === "never") return undefined;
  const now = new Date();
  if (value === "30d") now.setDate(now.getDate() + 30);
  else if (value === "90d") now.setDate(now.getDate() + 90);
  else if (value === "1y") now.setFullYear(now.getFullYear() + 1);
  return now.toISOString();
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
  const [expiresIn, setExpiresIn] = useState("never");
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTeams().then((res) => {
      setTeams(res.data);
      if (res.data.length > 0) setSelectedTeamId(res.data[0].id);
      setIsLoadingTeams(false);
    });
  }, []);

  useEffect(() => {
    if (!teamDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (teamRef.current && !teamRef.current.contains(e.target as Node))
        setTeamDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [teamDropdownOpen]);

  async function handleSubmit(e: FormSubmitEvent) {
    e.preventDefault();
    if (!label.trim() || !selectedTeamId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await createApiKey(label.trim(), selectedTeamId, expirationToDate(expiresIn));
      onCreated(res.plainKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setIsSubmitting(false);
    }
  }

  const noTeams = !isLoadingTeams && teams.length === 0;
  const selectedTeamName = teams.find((t) => t.id === selectedTeamId)?.name;

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
          <h2 className="text-foreground">Create API Key</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="border-t border-border" />

        {noTeams ? (
          <>
            <div className="px-6 py-5">
              <p className="text-sm text-muted-foreground">
                No teams exist yet. Create a team first before generating API keys.
              </p>
            </div>
            <div className="border-t border-border" />
            <div className="px-6 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-sm bg-accent text-foreground hover:bg-accent/70 transition-colors"
                onClick={onClose}
              >
                Cancel
              </button>
              <Link
                to="/admin/teams"
                className="px-4 py-2 rounded-xl text-sm transition-all hover:opacity-90 inline-flex items-center"
                style={{
                  backgroundColor: "var(--gruvbox-orange-bright)",
                  color: "var(--gruvbox-bg0)",
                }}
              >
                Go to Teams
              </Link>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-5 space-y-5">
              <div>
                <span className="text-sm text-muted-foreground mb-2 block">Label</span>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                  placeholder="e.g. production, staging"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div>
                <span className="text-sm text-muted-foreground mb-2 block">Team</span>
                {isLoadingTeams ? (
                  <div className="bg-muted animate-pulse rounded-xl h-[42px] w-full" />
                ) : (
                  <div className="relative" ref={teamRef}>
                    <button
                      type="button"
                      onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm hover:border-muted-foreground/50 transition-colors"
                    >
                      {selectedTeamName ?? "Select team..."}
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${teamDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {teamDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg py-1 z-10 max-h-48 overflow-y-auto">
                        {teams.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setSelectedTeamId(t.id);
                              setTeamDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-accent transition-colors ${
                              selectedTeamId === t.id ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {t.name}
                            {selectedTeamId === t.id && (
                              <Check
                                className="w-4 h-4"
                                style={{ color: "var(--gruvbox-green-bright)" }}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <span className="text-sm text-muted-foreground mb-2 block">Expiration</span>
                <div className="flex flex-wrap gap-2">
                  {EXPIRATION_OPTIONS.map((opt) => {
                    const active = expiresIn === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setExpiresIn(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                          active
                            ? "border-transparent"
                            : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                        }`}
                        style={
                          active
                            ? {
                                backgroundColor: "var(--gruvbox-orange)",
                                color: "var(--gruvbox-bg0)",
                              }
                            : undefined
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
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
                disabled={!label.trim() || !selectedTeamId || isSubmitting}
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─── Edit Key Modal ─── */

function EditKeyModal({
  apiKey,
  onClose,
  onSaved,
}: {
  apiKey: ApiKeyRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(apiKey.label ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function handleSave() {
    if (!label.trim()) return;
    setIsSubmitting(true);
    await updateApiKeyLabel(apiKey.id, label.trim());
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
          <h2 className="text-foreground">Edit API Key</h2>
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
          <span className="text-sm text-muted-foreground mb-2 block">Label</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
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
            disabled={!label.trim() || isSubmitting}
            className="px-4 py-2 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--gruvbox-orange-bright)", color: "var(--gruvbox-bg0)" }}
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

/* ─── Reveal Key Modal ─── */

function RevealKeyModal({ plainKey, onClose }: { plainKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function handleCopy() {
    await navigator.clipboard.writeText(plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      ref={backdropRef}
      role="dialog"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      onClick={(e) => e.target === backdropRef.current && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "var(--gruvbox-green)", color: "var(--gruvbox-bg0)" }}
            >
              <Check className="w-5 h-5" />
            </div>
            <h2 className="text-foreground">Key Created!</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Copy your API key now. You won't be able to see it again.
          </p>
        </div>
        <div className="px-6 pb-3">
          <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-3 border border-border">
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={plainKey}
              onClick={() => inputRef.current?.select()}
              className="flex-1 bg-transparent text-foreground font-mono text-sm border-none focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {copied ? (
                <Check className="w-4 h-4" style={{ color: "var(--gruvbox-green-bright)" }} />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ backgroundColor: "var(--gruvbox-yellow)", color: "var(--gruvbox-bg0)" }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-xs">Store this key securely. It will not be shown again.</p>
        </div>
        <div className="px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--gruvbox-orange-bright)", color: "var(--gruvbox-bg0)" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
