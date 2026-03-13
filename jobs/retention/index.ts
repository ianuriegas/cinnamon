/**
 * Retention cleanup job — prunes old jobs_log rows.
 *
 * Usage: bun run jobs/retention/index.ts [days]
 * Example: bun run job retention 90
 * Default: 60 days
 */

import { and, isNotNull, lt } from "drizzle-orm";

import { db, pool } from "@/db/index.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import { isDirectExecution } from "../_shared/is-direct-execution.ts";

const DEFAULT_RETENTION_DAYS = 60;

function parseDays(arg: string | undefined): number {
  const n = Number(arg);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_RETENTION_DAYS;
}

async function runRetention() {
  const days = parseDays(process.argv[2]);
  const cutoff = new Date(Date.now() - days * 86_400_000);
  console.log(`Pruning job runs finished before ${cutoff.toISOString()} (${days}-day retention)`);

  const deleted = await db
    .delete(jobsLog)
    .where(and(isNotNull(jobsLog.finishedAt), lt(jobsLog.finishedAt, cutoff)))
    .returning({ id: jobsLog.id });

  console.log(`Deleted ${deleted.length} row(s)`);
}

if (isDirectExecution(import.meta.url)) {
  runRetention()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error("Retention job failed:", error);
      await pool.end();
      process.exit(1);
    });
}
