import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Duration } from "../components/Duration";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { TimeAgo } from "../components/TimeAgo";
import { usePolling } from "../hooks/usePolling";
import { fetchRuns } from "../lib/api";
import type { PaginationInfo, RunRow, RunsFilters } from "../lib/types";

const DEFAULT_LIMIT = 25;

export function RunsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filterName = searchParams.get("name") ?? "";
  const filterStatus = searchParams.get("status") ?? "";
  const filterSince = searchParams.get("since") ?? "";
  const filters: RunsFilters = useMemo(
    () => ({ name: filterName, status: filterStatus, since: filterSince }),
    [filterName, filterStatus, filterSince],
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

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("offset");
    setSearchParams(next);
  }

  function clearFilters() {
    setSearchParams({});
  }

  function handlePageChange(newOffset: number) {
    const next = new URLSearchParams(searchParams);
    next.set("offset", String(newOffset));
    setSearchParams(next);
  }

  const hasFilters = filters.name || filters.status || filters.since;

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Job Runs</h1>
        <span className="text-sm text-base-content/60">{pagination.total} total runs</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <select
          className="select select-sm"
          value={filters.name}
          onChange={(e) => updateFilter("name", e.target.value)}
        >
          <option value="">All jobs</option>
          {jobNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          className="select select-sm"
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          <option value="">All statuses</option>
          {["queued", "processing", "completed", "failed", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input input-sm"
          value={filters.since}
          onChange={(e) => updateFilter("since", e.target.value)}
        />
        {hasFilters && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-0">
          {isLoading ? (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Job Name</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Started</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
                    <tr key={i}>
                      <td>
                        <div className="skeleton h-4 w-32" />
                        <div className="skeleton h-3 w-20 mt-1" />
                      </td>
                      <td>
                        <div className="skeleton h-5 w-16 rounded-full" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-12" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-20" />
                      </td>
                      <td>
                        <div className="skeleton h-6 w-10" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-12 text-base-content/60">
              <p className="text-lg">No job runs found</p>
              <p className="text-sm mt-1">Try adjusting your filters or trigger a job</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Job Name</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Started</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-base-300">
                      <td>
                        <span className="font-mono font-semibold">{run.jobName}</span>
                        <br />
                        <span className="text-xs text-base-content/50">{run.jobId}</span>
                      </td>
                      <td>
                        <StatusBadge status={run.status} />
                      </td>
                      <td>
                        <Duration startedAt={run.startedAt} finishedAt={run.finishedAt} />
                      </td>
                      <td>
                        <TimeAgo date={run.startedAt ?? run.createdAt} />
                      </td>
                      <td>
                        <Link to={`/runs/${run.jobId}`} className="btn btn-ghost btn-xs">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
