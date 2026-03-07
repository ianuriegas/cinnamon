import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import { TimeAgo } from "../components/TimeAgo";
import { TriggerButton } from "../components/TriggerButton";
import { fetchDefinitions } from "../lib/api";
import type { DefinitionRow } from "../lib/types";

export function DefinitionsPage() {
  const [definitions, setDefinitions] = useState<DefinitionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetchDefinitions();
    setDefinitions(res.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Job Definitions</h1>
        <span className="text-sm text-base-content/60">{definitions.length} jobs configured</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading
          ? Array.from({ length: 6 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
              <div key={i} className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="skeleton h-5 w-36" />
                      <div className="skeleton h-3 w-48 mt-2" />
                    </div>
                    <div className="skeleton h-8 w-16 rounded" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="skeleton h-5 w-28 rounded-full" />
                    <div className="skeleton h-5 w-24 rounded-full" />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="skeleton h-4 w-40" />
                  </div>
                </div>
              </div>
            ))
          : definitions.map((def) => (
              <div key={def.name} className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="card-title text-base font-mono">{def.name}</h2>
                      {def.description && (
                        <p className="text-sm text-base-content/60 mt-1">{def.description}</p>
                      )}
                    </div>
                    <TriggerButton jobName={def.name} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="badge badge-outline badge-sm gap-1">
                      <span className="text-base-content/60">cmd:</span> {def.command}
                      {def.script ? ` ${def.script}` : ""}
                    </div>
                    {def.schedule && (
                      <div className="badge badge-outline badge-sm gap-1">
                        <span className="text-base-content/60">cron:</span> {def.schedule}
                      </div>
                    )}
                    {def.timeout && (
                      <div className="badge badge-outline badge-sm gap-1">
                        <span className="text-base-content/60">timeout:</span> {def.timeout}
                      </div>
                    )}
                    {def.retries !== undefined && def.retries > 0 && (
                      <div className="badge badge-outline badge-sm gap-1">
                        <span className="text-base-content/60">retries:</span> {def.retries}
                      </div>
                    )}
                  </div>

                  {def.lastRun ? (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <span className="text-base-content/60">Last run:</span>
                      <StatusBadge status={def.lastRun.status} />
                      <TimeAgo date={def.lastRun.createdAt} />
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-base-content/40">No runs yet</div>
                  )}
                </div>
              </div>
            ))}
      </div>
    </>
  );
}
