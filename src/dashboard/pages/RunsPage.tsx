import { Check, ChevronDown, Eye, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Duration } from "../components/Duration";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { TimeAgo } from "../components/TimeAgo";
import { usePolling } from "../hooks/usePolling";
import { fetchRuns } from "../lib/api";
import type { PaginationInfo, RunRow, RunsFilters } from "../lib/types";

const DEFAULT_LIMIT = 25;

const STATUS_OPTIONS = [
  { value: "queued", label: "Queued", color: "var(--gruvbox-yellow)" },
  { value: "processing", label: "Processing", color: "var(--gruvbox-blue-bright)" },
  { value: "completed", label: "Completed", color: "var(--gruvbox-green)" },
  { value: "failed", label: "Failed", color: "var(--gruvbox-red-bright)" },
  { value: "cancelled", label: "Cancelled", color: "var(--gruvbox-bg4)" },
  { value: "interrupted", label: "Interrupted", color: "var(--gruvbox-orange)" },
] as const;

export function RunsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const searchQuery = searchParams.get("q") ?? "";
  const filterName = searchParams.get("name") ?? "";
  const filterStatus = searchParams.get("status") ?? "";
  const filtersOpen = searchParams.get("filters") === "1" || !!(filterName || filterStatus);

  const filters: RunsFilters = useMemo(
    () => ({ q: searchQuery, name: filterName, status: filterStatus }),
    [searchQuery, filterName, filterStatus],
  );
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const limit = Number(searchParams.get("limit")) || DEFAULT_LIMIT;

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit,
    offset,
  });
  const [jobNames, setJobNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetchRuns(filters, { limit, offset });
    setRuns(res.data);
    setPagination(res.pagination);
    setJobNames(res.jobNames);
    setIsLoading(false);
  }, [filters, limit, offset]);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 5000);

  function updateParam(key: string, value: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== "offset") next.delete("offset");
        return next;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      const q = prev.get("q");
      if (q) next.set("q", q);
      return next;
    });
  }

  function handlePageChange(newOffset: number) {
    const next = new URLSearchParams(searchParams);
    next.set("offset", String(newOffset));
    setSearchParams(next);
  }

  const activeFilterCount = [filterName, filterStatus].filter(Boolean).length;

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-foreground mb-2">Job Runs</h1>
        <p className="text-muted-foreground mb-6">Monitor and inspect your job executions.</p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by job name or ID..."
            value={searchQuery}
            onChange={(e) => updateParam("q", e.target.value || null)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
          />
        </div>

        {/* Filters toggle */}
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
              {/* Job name filter dropdown */}
              <JobFilterDropdown
                jobNames={jobNames}
                selected={filterName}
                onSelect={(j) => updateParam("name", filterName === j ? null : j)}
              />

              {/* Status filter pills */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Status</span>
                {STATUS_OPTIONS.map((s) => {
                  const isActive = filterStatus === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => updateParam("status", isActive ? null : s.value)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all flex items-center gap-1.5 capitalize ${
                        isActive
                          ? "border-transparent"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                      }`}
                      style={
                        isActive
                          ? { backgroundColor: s.color, color: "var(--gruvbox-bg0)" }
                          : undefined
                      }
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: isActive ? "var(--gruvbox-bg0)" : s.color,
                        }}
                      />
                      {s.label}
                    </button>
                  );
                })}
              </div>

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
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden backdrop-blur-sm">
        {isLoading ? (
          <SkeletonTable />
        ) : runs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No runs match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 md:px-6 py-4 text-sm font-medium text-muted-foreground">
                    Job Name
                  </th>
                  <th className="text-left px-4 md:px-6 py-4 text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 md:px-6 py-4 text-sm font-medium text-muted-foreground">
                    Duration
                  </th>
                  <th className="text-left px-4 md:px-6 py-4 text-sm font-medium text-muted-foreground">
                    Started
                  </th>
                  <th className="text-left px-4 md:px-6 py-4 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-border/50 hover:bg-accent/50 transition-colors group"
                  >
                    <td className="px-4 md:px-6 py-4">
                      <div>
                        <div className="text-foreground font-medium">{run.jobName}</div>
                        <div className="text-sm text-muted-foreground">#{run.jobId}</div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className="text-foreground text-sm font-mono">
                        <Duration startedAt={run.startedAt} finishedAt={run.finishedAt} />
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className="text-muted-foreground text-sm">
                        <TimeAgo date={run.startedAt ?? run.createdAt} />
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <Link
                        to={`/runs/${run.jobId}`}
                        className="px-3 md:px-4 py-2 text-sm font-medium text-card-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-all inline-flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">View</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        total={pagination.total}
        limit={pagination.limit}
        offset={pagination.offset}
        onPageChange={handlePageChange}
      />
    </>
  );
}

function SkeletonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 md:px-6 py-4 text-sm font-medium text-muted-foreground">
              Job Name
            </th>
            <th className="text-left px-4 md:px-6 py-4 text-sm font-medium text-muted-foreground">
              Status
            </th>
            <th className="text-left px-4 md:px-6 py-4 text-sm font-medium text-muted-foreground">
              Duration
            </th>
            <th className="text-left px-4 md:px-6 py-4 text-sm font-medium text-muted-foreground">
              Started
            </th>
            <th className="text-left px-4 md:px-6 py-4 text-sm font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="px-4 md:px-6 py-4">
                <div className="bg-muted animate-pulse rounded h-4 w-32" />
                <div className="bg-muted animate-pulse rounded h-3 w-16 mt-1.5" />
              </td>
              <td className="px-4 md:px-6 py-4">
                <div className="bg-muted animate-pulse rounded-full h-6 w-16" />
              </td>
              <td className="px-4 md:px-6 py-4">
                <div className="bg-muted animate-pulse rounded h-4 w-14" />
              </td>
              <td className="px-4 md:px-6 py-4">
                <div className="bg-muted animate-pulse rounded h-4 w-20" />
              </td>
              <td className="px-4 md:px-6 py-4">
                <div className="bg-muted animate-pulse rounded-lg h-8 w-16" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Job Name Filter Dropdown ─── */

function JobFilterDropdown({
  jobNames,
  selected,
  onSelect,
}: {
  jobNames: string[];
  selected: string | null;
  onSelect: (job: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setJobSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = jobNames.filter((j) => j.toLowerCase().includes(jobSearch.toLowerCase()));

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Job</span>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`px-2.5 py-1 rounded-full text-xs border transition-all flex items-center gap-1.5 font-mono ${
            selected
              ? "border-transparent"
              : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
          }`}
          style={
            selected
              ? { backgroundColor: "var(--gruvbox-yellow)", color: "var(--gruvbox-bg0)" }
              : undefined
          }
        >
          {selected || "Select..."}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-52 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search jobs..."
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No jobs found</p>
              ) : (
                filtered.map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => {
                      onSelect(j);
                      setOpen(false);
                      setJobSearch("");
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono flex items-center justify-between hover:bg-accent transition-colors ${
                      selected === j ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {j}
                    {selected === j && (
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
