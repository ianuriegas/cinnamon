import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { StatusBadge } from "../components/StatusBadge";
import { useTimezoneContext } from "../contexts/TimezoneContext";
import { formatInTimezone } from "../hooks/useTimezone";
import { fetchSchedules } from "../lib/api";
import type { ScheduleRow } from "../lib/types";

function successRate(stats: ScheduleRow["stats"]): string {
  if (stats.total === 0) return "—";
  const rate = (stats.completed / stats.total) * 100;
  return `${rate.toFixed(0)}%`;
}

function formatNextRun(isoString: string | null): string {
  if (!isoString) return "—";
  const diffMs = new Date(isoString).getTime() - Date.now();

  if (diffMs < 0) return "overdue";
  if (diffMs < 60_000) return `in ${Math.ceil(diffMs / 1000)}s`;
  if (diffMs < 3_600_000) return `in ${Math.ceil(diffMs / 60_000)}m`;
  if (diffMs < 86_400_000)
    return `in ${Math.floor(diffMs / 3_600_000)}h ${Math.ceil((diffMs % 3_600_000) / 60_000)}m`;
  return `in ${Math.floor(diffMs / 86_400_000)}d`;
}

export function SchedulesPage() {
  const { timezone } = useTimezoneContext();
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetchSchedules();
    setSchedules(res.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Schedules</h1>
        <span className="text-sm text-base-content/60">{schedules.length} scheduled jobs</span>
      </div>

      {isLoading ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="table table-sm">
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
                  {Array.from({ length: 4 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
                    <tr key={i}>
                      <td>
                        <div className="skeleton h-4 w-28" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-24" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-16" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-20" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-10" />
                      </td>
                      <td>
                        <div className="skeleton h-5 w-16 rounded-full" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12 text-base-content/60">
          <p className="text-lg">No scheduled jobs</p>
          <p className="text-sm mt-1">
            Add a <code>schedule</code> field to a job definition in your config
          </p>
        </div>
      ) : (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="table table-sm">
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
                    <tr key={s.name} className="hover:bg-base-300">
                      <td>
                        <Link
                          to={`/?name=${encodeURIComponent(s.name)}`}
                          className="font-mono font-semibold link link-hover"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td>
                        <code className="text-xs bg-base-200 px-2 py-0.5 rounded">{s.pattern}</code>
                      </td>
                      <td className="text-sm" title={formatInTimezone(s.next, timezone)}>
                        {formatNextRun(s.next)}
                      </td>
                      <td className="text-sm">
                        {s.stats.total}{" "}
                        <span className="text-base-content/50">
                          ({s.stats.completed}✓ {s.stats.failed}✗)
                        </span>
                      </td>
                      <td>
                        <span
                          className={`font-semibold text-sm ${
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
                        {s.stats.total > 0 && s.stats.failed > 0 && <StatusBadge status="failed" />}
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
    </>
  );
}
