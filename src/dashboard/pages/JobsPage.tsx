import { Clock, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterPills } from "../components/FilterPills";
import { FiltersToggle } from "../components/FiltersToggle";
import { SearchInput } from "../components/SearchInput";
import { TeamFilterDropdown } from "../components/TeamFilterDropdown";
import { TimeAgo } from "../components/TimeAgo";
import { TriggerButton } from "../components/TriggerButton";
import { useUrlFilters } from "../hooks/useUrlFilters";
import { fetchDefinitions } from "../lib/api";
import type { DefinitionRow } from "../lib/types";

const SCHEDULE_OPTIONS = [
  { value: "scheduled", label: "Scheduled", color: "var(--gruvbox-aqua)" },
  { value: "on-demand", label: "On-demand", color: "var(--gruvbox-bg4)" },
] as const;

const FILTER_KEYS = ["q", "team", "schedule", "filters"] as const;

export function JobsPage() {
  const { filters, setFilter, clearFilters, activeFilterCount } = useUrlFilters(FILTER_KEYS, {
    excludeFromCount: ["q", "filters"],
  });

  const searchQuery = filters.q;
  const filterTeam = filters.team;
  const filterSchedule = filters.schedule;
  const filtersOpen = filters.filters === "1" || !!(filterTeam || filterSchedule);

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

  const isFiltering = searchQuery || activeFilterCount > 0;

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-foreground mb-2">Jobs</h1>
        <p className="text-muted-foreground mb-6">
          Job definitions configured in your Cinnamon config.
        </p>

        <SearchInput
          value={searchQuery}
          onChange={(v) => setFilter("q", v || null)}
          placeholder="Search by job name or description..."
          className="mb-4"
        />

        <div className="mb-4">
          <FiltersToggle
            open={filtersOpen}
            activeCount={activeFilterCount}
            onToggle={() => setFilter("filters", filtersOpen ? null : "1")}
          />

          {filtersOpen && (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
              <FilterPills
                label="Schedule"
                options={SCHEDULE_OPTIONS}
                value={filterSchedule}
                onChange={(v) => setFilter("schedule", v || null)}
              />

              <TeamFilterDropdown
                teams={allTeams}
                selected={filterTeam || null}
                onSelect={(t) => setFilter("team", filterTeam === t ? null : t)}
              />

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => clearFilters(["team", "schedule"])}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

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
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="text-foreground font-mono truncate">{job.name}</h3>
          {job.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{job.description}</p>
          )}
        </div>
        <TriggerButton jobName={job.name} />
      </div>

      <div className="mb-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--background)" }}>
        <p className="text-xs font-mono text-muted-foreground break-all">{cmdDisplay}</p>
      </div>

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
