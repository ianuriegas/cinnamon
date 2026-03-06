import type { FC } from "hono/jsx";

import { StatusBadge } from "../components/status-badge.tsx";
import { TimeAgo } from "../components/time-ago.tsx";
import { BaseLayout } from "../layouts/base.tsx";
import { TriggerButton } from "../partials/trigger-btn.tsx";

interface DefinitionRow {
  name: string;
  command: string;
  script?: string;
  schedule?: string;
  timeout?: string;
  retries?: number;
  description?: string;
  lastRun?: {
    status: string;
    createdAt: Date;
  } | null;
}

export const DefinitionsPage: FC<{ definitions: DefinitionRow[] }> = ({ definitions }) => {
  return (
    <BaseLayout title="Definitions" currentPath="/dashboard/definitions">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Job Definitions</h1>
        <span class="text-sm text-base-content/60">{definitions.length} jobs configured</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {definitions.map((def) => (
          <div key={def.name} class="card bg-base-100 shadow-sm">
            <div class="card-body">
              <div class="flex justify-between items-start">
                <div>
                  <h2 class="card-title text-base font-mono">{def.name}</h2>
                  {def.description && (
                    <p class="text-sm text-base-content/60 mt-1">{def.description}</p>
                  )}
                </div>
                <TriggerButton jobName={def.name} />
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                <div class="badge badge-outline badge-sm gap-1">
                  <span class="text-base-content/60">cmd:</span> {def.command}
                  {def.script ? ` ${def.script}` : ""}
                </div>
                {def.schedule && (
                  <div class="badge badge-outline badge-sm gap-1">
                    <span class="text-base-content/60">cron:</span> {def.schedule}
                  </div>
                )}
                {def.timeout && (
                  <div class="badge badge-outline badge-sm gap-1">
                    <span class="text-base-content/60">timeout:</span> {def.timeout}
                  </div>
                )}
                {def.retries !== undefined && def.retries > 0 && (
                  <div class="badge badge-outline badge-sm gap-1">
                    <span class="text-base-content/60">retries:</span> {def.retries}
                  </div>
                )}
              </div>

              {def.lastRun && (
                <div class="mt-3 flex items-center gap-2 text-sm">
                  <span class="text-base-content/60">Last run:</span>
                  <StatusBadge status={def.lastRun.status} />
                  <TimeAgo date={def.lastRun.createdAt} />
                </div>
              )}
              {!def.lastRun && (
                <div class="mt-3 text-sm text-base-content/40">No runs yet</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </BaseLayout>
  );
};
