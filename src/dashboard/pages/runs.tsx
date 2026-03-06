import type { FC } from "hono/jsx";

import { Pagination } from "../components/pagination.tsx";
import { BaseLayout } from "../layouts/base.tsx";
import { RunsTable } from "../partials/runs-table.tsx";

interface RunRow {
  id: number;
  jobId: string;
  jobName: string;
  status: string;
  error: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

interface RunsPageProps {
  runs: RunRow[];
  pagination: { total: number; limit: number; offset: number };
  filters: { name: string; status: string; since: string };
  jobNames: string[];
}

export const RunsTableFragment: FC<{
  runs: RunRow[];
  pagination: { total: number; limit: number; offset: number };
  activeQs: string;
}> = ({ runs, pagination, activeQs }) => {
  const { limit, offset } = pagination;
  const pollQs = [activeQs, `limit=${limit}`, `offset=${offset}`]
    .filter(Boolean)
    .join("&");

  return (
    <div
      id="runs-table-poll"
      hx-get={`/dashboard/partials/runs-table?${pollQs}`}
      hx-trigger="every 5s"
      hx-swap="outerHTML"
    >
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-0">
          <RunsTable runs={runs} />
        </div>
      </div>

      <Pagination
        total={pagination.total}
        limit={limit}
        offset={offset}
        baseUrl="/dashboard"
        queryParams={activeQs}
      />
    </div>
  );
};

export const RunsPage: FC<RunsPageProps> = ({ runs, pagination, filters, jobNames }) => {
  const activeQs = [
    filters.name && `name=${encodeURIComponent(filters.name)}`,
    filters.status && `status=${encodeURIComponent(filters.status)}`,
    filters.since && `since=${encodeURIComponent(filters.since)}`,
  ]
    .filter(Boolean)
    .join("&");

  return (
    <BaseLayout title="Runs" currentPath="/dashboard">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 class="text-2xl font-bold">Job Runs</h1>
        <span class="text-sm text-base-content/60">{pagination.total} total runs</span>
      </div>

      <form method="get" action="/dashboard" class="flex flex-wrap gap-2 mb-6">
        <select name="name" class="select select-bordered select-sm">
          <option value="">All jobs</option>
          {jobNames.map((n) => (
            <option key={n} value={n} selected={filters.name === n}>
              {n}
            </option>
          ))}
        </select>
        <select name="status" class="select select-bordered select-sm">
          <option value="">All statuses</option>
          {["completed", "failed", "processing"].map((s) => (
            <option key={s} value={s} selected={filters.status === s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="since"
          class="input input-bordered input-sm"
          value={filters.since}
        />
        <button type="submit" class="btn btn-sm btn-primary">
          Filter
        </button>
        {activeQs && (
          <a href="/dashboard" class="btn btn-sm btn-ghost">
            Clear
          </a>
        )}
      </form>

      <RunsTableFragment runs={runs} pagination={pagination} activeQs={activeQs} />
    </BaseLayout>
  );
};
