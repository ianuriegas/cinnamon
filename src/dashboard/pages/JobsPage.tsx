import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { TimeAgo } from "../components/TimeAgo";
import { TriggerButton } from "../components/TriggerButton";
import { fetchDefinitions } from "../lib/api";
import type { DefinitionRow } from "../lib/types";

export function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const searchQuery = searchParams.get("q") ?? "";
  const filterTeam = searchParams.get("team") ?? "";
  const filterSchedule = searchParams.get("schedule") ?? "";
  const filtersOpen = searchParams.get("filters") === "1" || !!(filterTeam || filterSchedule);

  const [definitions, setDefinitions] = useState<DefinitionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [allTeams, setAllTeams] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await fetchDefinitions();
    setDefinitions(res.data);
    setAllTeams(res.teams ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return definitions
      .filter((j) => {
        if (q) {
          const matchName = j.name.toLowerCase().includes(q);
          const matchDesc = j.description?.toLowerCase().includes(q);
          if (!matchName && !matchDesc) return false;
        }
        if (filterTeam) {
          const jobTeams = j.teams ?? [];
          if (jobTeams.length > 0 && !jobTeams.includes(filterTeam)) return false;
        }
        if (filterSchedule === "scheduled" && !j.schedule) return false;
        if (filterSchedule === "on-demand" && j.schedule) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [definitions, searchQuery, filterTeam, filterSchedule]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("team");
        next.delete("schedule");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const activeFilterCount = [filterTeam, filterSchedule].filter(Boolean).length;
  const isFiltering = searchQuery || activeFilterCount > 0;

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-foreground mb-2">Jobs</h1>
        <p className="text-muted-foreground mb-6">
          Job definitions configured in your Cinnamon config.
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by job name or description..."
            value={searchQuery}
            onChange={(e) => updateParam("q", e.target.value || null)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => updateParam("filters", filtersOpen ? null : "1")}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              filtersOpen || activeFilterCount > 0
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: "var(--gruvbox-orange-bright)",
                  color: "var(--gruvbox-bg0)",
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {filtersOpen && (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
              {/* Schedule filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Schedule</span>
                {(["scheduled", "on-demand"] as const).map((s) => {
                  const active = filterSchedule === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateParam("schedule", active ? null : s)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all flex items-center gap-1.5 ${
                        active
                          ? "border-transparent"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                      }`}
                      style={
                        active
                          ? {
                              backgroundColor:
                                s === "scheduled" ? "var(--gruvbox-aqua)" : "var(--gruvbox-bg4)",
                              color: "var(--gruvbox-bg0)",
                            }
                          : undefined
                      }
                    >
                      {s === "scheduled" && <Calendar className="w-3 h-3" />}
                      {s === "scheduled" ? "Scheduled" : "On-demand"}
                    </button>
                  );
                })}
              </div>

              {/* Team filter */}
              <TeamFilterDropdown
                teams={allTeams}
                selected={filterTeam || null}
                onSelect={(t) => updateParam("team", filterTeam === t ? null : t)}
              />

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Result count */}
        {isFiltering && (
          <p className="text-xs text-muted-foreground mb-4">
            Showing {filteredJobs.length} of {definitions.length} jobs
          </p>
        )}
      </div>

      {/* Job Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="bg-muted rounded h-5 w-28" />
                  <div className="bg-muted rounded h-3 w-48 mt-2" />
                </div>
                <div className="bg-muted rounded-lg h-8 w-20" />
              </div>
              <div className="bg-muted rounded h-4 w-full mb-3" />
              <div className="space-y-2">
                <div className="bg-muted rounded h-4 w-32" />
                <div className="bg-muted rounded h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-foreground mb-1">No jobs found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          {filteredJobs.map((job) => (
            <JobCard key={job.name} job={job} />
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Job Card ─── */

function JobCard({ job }: { job: DefinitionRow }) {
  const cmdDisplay = job.commandDisplay ?? [job.command, job.script].filter(Boolean).join(" ");

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-muted-foreground/30 transition-colors flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="text-foreground font-mono truncate">{job.name}</h3>
          {job.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{job.description}</p>
          )}
        </div>
        <TriggerButton jobName={job.name} />
      </div>

      {/* Command */}
      <div className="mb-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--background)" }}>
        <p className="text-xs font-mono text-muted-foreground break-all">{cmdDisplay}</p>
      </div>

      {/* Config details */}
      <div className="space-y-2 mb-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Timeout: {job.timeout ?? "30s"}</span>
          {job.retries !== undefined && job.retries > 0 && (
            <>
              <span>&middot;</span>
              <span>Retries: {job.retries}</span>
            </>
          )}
        </div>

        {job.schedule && (
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs font-mono"
              style={{
                backgroundColor: "var(--gruvbox-aqua)",
                color: "var(--gruvbox-bg0)",
              }}
            >
              {job.schedule}
            </span>
            <span className="text-muted-foreground text-xs">schedule</span>
          </div>
        )}

        {job.teams && job.teams.length > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>{job.teams.join(", ")}</span>
          </div>
        )}
      </div>

      {/* Last run (pushed to bottom) */}
      {job.lastRun ? (
        <div className="mt-auto pt-3 border-t border-border flex items-center gap-2 text-sm">
          <RunStatusDot status={job.lastRun.status} />
          <span className="text-xs text-muted-foreground capitalize">
            {job.lastRun.status === "processing" ? "running" : job.lastRun.status}
          </span>
          <span className="text-xs text-muted-foreground">
            &middot; <TimeAgo date={job.lastRun.createdAt} />
          </span>
        </div>
      ) : (
        <div className="mt-auto pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">No runs yet</span>
        </div>
      )}
    </div>
  );
}

function RunStatusDot({ status }: { status: string }) {
  const displayStatus = status === "processing" ? "running" : status;
  const colors: Record<string, string> = {
    completed: "var(--gruvbox-green-bright)",
    running: "var(--gruvbox-blue-bright)",
    processing: "var(--gruvbox-blue-bright)",
    failed: "var(--gruvbox-red-bright)",
    queued: "var(--gruvbox-yellow)",
    cancelled: "var(--gruvbox-bg4)",
    interrupted: "var(--gruvbox-orange)",
  };
  const color = colors[displayStatus] ?? "var(--gruvbox-bg4)";
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${
        displayStatus === "running" || status === "processing" ? "animate-pulse" : ""
      }`}
      style={{ backgroundColor: color }}
    />
  );
}

/* ─── Team Filter Dropdown ─── */

function TeamFilterDropdown({
  teams,
  selected,
  onSelect,
}: {
  teams: string[];
  selected: string | null;
  onSelect: (team: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setTeamSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = teams.filter((t) => t.toLowerCase().includes(teamSearch.toLowerCase()));

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Team</span>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`px-2.5 py-1 rounded-full text-xs border transition-all flex items-center gap-1.5 ${
            selected
              ? "border-transparent"
              : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
          }`}
          style={
            selected
              ? { backgroundColor: "var(--gruvbox-purple)", color: "var(--gruvbox-bg0)" }
              : undefined
          }
        >
          {selected ?? "Select..."}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search teams..."
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No teams found</p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      onSelect(t);
                      setOpen(false);
                      setTeamSearch("");
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-accent transition-colors ${
                      selected === t ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {t}
                    {selected === t && (
                      <Check
                        className="w-3.5 h-3.5"
                        style={{ color: "var(--gruvbox-green-bright)" }}
                      />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
