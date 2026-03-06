import type { FC } from "hono/jsx";

import { Duration } from "../components/duration.tsx";
import { StatusBadge } from "../components/status-badge.tsx";
import { TimeAgo } from "../components/time-ago.tsx";

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

export const RunsTable: FC<{ runs: RunRow[] }> = ({ runs }) => {
  if (runs.length === 0) {
    return (
      <div class="text-center py-12 text-base-content/60">
        <p class="text-lg">No job runs found</p>
        <p class="text-sm mt-1">Try adjusting your filters or trigger a job</p>
      </div>
    );
  }

  return (
    <div class="overflow-x-auto">
      <table class="table table-sm">
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
            <tr key={run.id} class="hover">
              <td>
                <span class="font-mono font-semibold">{run.jobName}</span>
                <br />
                <span class="text-xs text-base-content/50">{run.jobId}</span>
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
                <a href={`/dashboard/runs/${run.id}`} class="btn btn-ghost btn-xs">
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
