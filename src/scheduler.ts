import { jobsQueue } from "./queue.ts";

interface ScheduleEntry {
  schedulerId: string;
  pattern: string;
  jobName: string;
  data: Record<string, unknown>;
}

const schedules: ScheduleEntry[] = [
  {
    schedulerId: "spotify-recently-played-every-30m",
    pattern: "0 * * * *", // Every hour (at :00 past each hour)
    jobName: "spotify-recently-played",
    data: {},
  },
  {
    schedulerId: "spotify-top-tracks-daily",
    pattern: "0 0 * * *", // Daily at 00:00 UTC
    jobName: "spotify-top-tracks",
    data: {},
  },
];

async function registerSchedules() {
  for (const { schedulerId, pattern, jobName, data } of schedules) {
    await jobsQueue.upsertJobScheduler(schedulerId, { pattern }, { name: jobName, data });
    console.log(`Registered schedule: ${schedulerId} (${pattern}) -> ${jobName}`);
  }
}

async function main() {
  console.log("Registering job schedules...");
  await registerSchedules();
  console.log(`Scheduler running. ${schedules.length} schedule(s) active.`);
}

const shutdown = async () => {
  console.log("Shutting down scheduler...");
  await jobsQueue.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  console.error("Scheduler failed:", error);
  process.exit(1);
});
