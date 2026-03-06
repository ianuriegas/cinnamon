import type { CinnamonConfig } from "@/config/define-config.ts";
import { getJobOptions } from "@/config/dynamic-registry.ts";
import { getScheduledJobs, loadConfig, type ScheduleEntry } from "@/config/load-config.ts";
import { jobsQueue } from "./queue.ts";

/**
 * Native handler schedules — for jobs registered as native TypeScript handlers
 * rather than config-driven shell jobs. These will be removed once the
 * corresponding jobs are migrated to cinnamon.config.ts.
 */
const nativeSchedules: ScheduleEntry[] = [
  {
    jobName: "spotify-recently-played",
    pattern: "0 * * * *",
    data: {},
  },
  {
    jobName: "spotify-top-tracks",
    pattern: "0 0 * * *",
    data: {},
  },
];

async function registerSchedules(schedules: ScheduleEntry[], config: CinnamonConfig) {
  for (const { jobName, pattern, data } of schedules) {
    const opts = getJobOptions(jobName, config);
    await jobsQueue.upsertJobScheduler(jobName, { pattern }, { name: jobName, data, opts });
    console.log(`[scheduler] Registered: ${jobName} (${pattern})`);
  }
}

async function reconcileStaleSchedulers(desiredIds: Set<string>) {
  const existing = await jobsQueue.getJobSchedulers(0, -1);
  let removed = 0;

  for (const scheduler of existing) {
    if (!desiredIds.has(scheduler.key)) {
      await jobsQueue.removeJobScheduler(scheduler.key);
      console.log(`[scheduler] Removed stale schedule: ${scheduler.key}`);
      removed++;
    }
  }

  return removed;
}

async function main() {
  const config = await loadConfig();
  const configSchedules = getScheduledJobs(config);
  const allSchedules = [...nativeSchedules, ...configSchedules];

  console.log("[scheduler] Registering job schedules...");
  await registerSchedules(allSchedules, config);

  const desiredIds = new Set(allSchedules.map((s) => s.jobName));
  const removed = await reconcileStaleSchedulers(desiredIds);

  console.log(
    `[scheduler] Done. ${allSchedules.length} schedule(s) active${removed > 0 ? `, ${removed} stale removed` : ""}.`,
  );
}

const shutdown = async () => {
  console.log("[scheduler] Shutting down...");
  await jobsQueue.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  console.error("[scheduler] Failed:", error);
  process.exit(1);
});
