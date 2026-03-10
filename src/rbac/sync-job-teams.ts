import type { CinnamonConfig } from "@/config/define-config.ts";
import { db } from "@/db/index.ts";
import { jobTeams } from "@/db/schema/job-teams.ts";
import { teams } from "@/db/schema/teams.ts";

/**
 * Reconcile the `teams` and `job_teams` tables with the current config.
 * Called once on server/worker startup after loadConfig().
 *
 * Strategy: full reconcile — upsert team names, then delete + reinsert job_teams.
 * Simple, idempotent, no drift.
 */
export async function syncJobTeams(config: CinnamonConfig): Promise<void> {
  const teamNamesFromConfig = new Set<string>();
  const jobTeamPairs: Array<{ jobName: string; teamName: string }> = [];

  for (const [jobName, def] of Object.entries(config.jobs)) {
    if (!def.teams?.length) continue;
    for (const teamName of def.teams) {
      teamNamesFromConfig.add(teamName);
      jobTeamPairs.push({ jobName, teamName });
    }
  }

  if (teamNamesFromConfig.size === 0) {
    await db.delete(jobTeams);
    return;
  }

  await db
    .insert(teams)
    .values([...teamNamesFromConfig].map((name) => ({ name })))
    .onConflictDoNothing({ target: teams.name });

  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const teamIdByName = new Map(allTeams.map((t) => [t.name, t.id]));

  await db.delete(jobTeams);

  if (jobTeamPairs.length > 0) {
    const rows = jobTeamPairs
      .map(({ jobName, teamName }) => {
        const teamId = teamIdByName.get(teamName);
        return teamId != null ? { jobName, teamId } : null;
      })
      .filter((r): r is { jobName: string; teamId: number } => r != null);

    if (rows.length > 0) {
      await db.insert(jobTeams).values(rows).onConflictDoNothing();
    }
  }

  console.log(
    `RBAC: synced ${teamNamesFromConfig.size} team(s), ${jobTeamPairs.length} job-team mapping(s)`,
  );
}
