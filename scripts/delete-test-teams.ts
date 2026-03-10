#!/usr/bin/env bun
/**
 * One-off script to delete leftover test teams from jobs-api.test.ts.
 * Run with: bun run scripts/delete-test-teams.ts
 */
import { inArray, like } from "drizzle-orm";

import { db, pool } from "@/db/index.ts";
import { apiKeyTeams } from "@/db/schema/api-key-teams.ts";
import { jobTeams } from "@/db/schema/job-teams.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import { teams } from "@/db/schema/teams.ts";
import { userTeams } from "@/db/schema/user-teams.ts";

const PREFIX = "__test_jobs_api";

async function main() {
  const toDelete = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(like(teams.name, `${PREFIX}%`));

  if (toDelete.length === 0) {
    console.log(`No teams matching "${PREFIX}%" found.`);
    await pool.end();
    return;
  }

  const ids = toDelete.map((t) => t.id);
  console.log(
    `Deleting ${toDelete.length} test team(s): ${toDelete.map((t) => t.name).join(", ")}`,
  );

  await db.delete(jobTeams).where(inArray(jobTeams.teamId, ids));
  await db.delete(userTeams).where(inArray(userTeams.teamId, ids));
  await db.delete(apiKeyTeams).where(inArray(apiKeyTeams.teamId, ids));
  await db.delete(jobsLog).where(inArray(jobsLog.teamId, ids));
  await db.delete(teams).where(inArray(teams.id, ids));

  console.log("Done.");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
