import { inArray } from "drizzle-orm";

import { db } from "@/db/index.ts";
import { teams } from "@/db/schema/teams.ts";
import type { CinnamonConfig } from "./define-config.ts";

export interface ResolvedTeams {
  /** Job name -> resolved team IDs. Jobs not in map are visible to all teams. */
  jobTeamIds: Map<string, number[]>;
}

/**
 * Resolves team names from job config to team IDs. Skips names that don't exist
 * in the DB. If a job's entire teams list resolves to empty, the job is omitted
 * from jobTeamIds (treated as visible to all).
 */
export async function resolveTeams(config: CinnamonConfig): Promise<ResolvedTeams> {
  const uniqueNames = new Set<string>();
  const jobTeamNames = new Map<string, string[]>();

  for (const [jobName, def] of Object.entries(config.jobs)) {
    const names = def.teams;
    if (!names?.length) continue;
    jobTeamNames.set(jobName, names);
    for (const n of names) uniqueNames.add(n);
  }

  if (uniqueNames.size === 0) {
    return { jobTeamIds: new Map() };
  }

  const rows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.name, [...uniqueNames]));

  const nameToId = new Map<string, number>();
  for (const r of rows) {
    nameToId.set(r.name, r.id);
  }

  const jobTeamIds = new Map<string, number[]>();
  for (const [jobName, names] of jobTeamNames) {
    const ids = names.map((n) => nameToId.get(n)).filter((id): id is number => id != null);
    if (ids.length > 0) {
      jobTeamIds.set(jobName, ids);
    }
  }

  return { jobTeamIds };
}
