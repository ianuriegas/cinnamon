import type { FC } from "hono/jsx";

import { StatusBadge } from "../components/status-badge.tsx";
import { BaseLayout } from "../layouts/base.tsx";

interface ScheduleRow {
  name: string;
  pattern: string;
  next: string | null;
  stats: {
    total: number;
    completed: number;
    failed: number;
  };
}

function successRate(stats: ScheduleRow["stats"]): string {
  if (stats.total === 0) return "—";
  const rate = (stats.completed / stats.total) * 100;
  return `${rate.toFixed(0)}%`;
}

function formatNextRun(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs < 0) return "overdue";
  if (diffMs < 60_000) return `in ${Math.ceil(diffMs / 1000)}s`;
  if (diffMs < 3_600_000) return `in ${Math.ceil(diffMs / 60_000)}m`;
  if (diffMs < 86_400_000) return `in ${Math.floor(diffMs / 3_600_000)}h ${Math.ceil((diffMs % 3_600_000) / 60_000)}m`;
  return `in ${Math.floor(diffMs / 86_400_000)}d`;
}

export const SchedulesPage: FC<{ schedules: ScheduleRow[] }> = ({ schedules }) => {
  return (
    <BaseLayout title="Schedules" currentPath="/dashboard/schedules">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Schedules</h1>
        <span class="text-sm text-base-content/60">{schedules.length} scheduled jobs</span>
      </div>

      {schedules.length === 0 ? (
        <div class="text-center py-12 text-base-content/60">
          <p class="text-lg">No scheduled jobs</p>
          <p class="text-sm mt-1">Add a `schedule` field to a job definition in your config</p>
        </div>
      ) : (
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body p-0">
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Job Name</th>
                    <th>Cron Pattern</th>
                    <th>Next Run</th>
                    <th>Runs</th>
                    <th>Success Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr key={s.name} class="hover">
                      <td>
                        <a
                          href={`/dashboard?name=${encodeURIComponent(s.name)}`}
                          class="font-mono font-semibold link link-hover"
                        >
                          {s.name}
                        </a>
                      </td>
                      <td>
                        <code class="text-xs bg-base-200 px-2 py-0.5 rounded">{s.pattern}</code>
                      </td>
                      <td class="text-sm">{formatNextRun(s.next)}</td>
                      <td class="text-sm">
                        {s.stats.total}{" "}
                        <span class="text-base-content/50">
                          ({s.stats.completed}✓ {s.stats.failed}✗)
                        </span>
                      </td>
                      <td>
                        <span
                          class={`font-semibold text-sm ${
                            s.stats.total === 0
                              ? "text-base-content/40"
                              : s.stats.failed === 0
                                ? "text-success"
                                : s.stats.failed / s.stats.total > 0.5
                                  ? "text-error"
                                  : "text-warning"
                          }`}
                        >
                          {successRate(s.stats)}
                        </span>
                      </td>
                      <td>
                        {s.stats.total > 0 && s.stats.failed > 0 && (
                          <StatusBadge status="failed" />
                        )}
                        {s.stats.total > 0 && s.stats.failed === 0 && (
                          <StatusBadge status="completed" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </BaseLayout>
  );
};
