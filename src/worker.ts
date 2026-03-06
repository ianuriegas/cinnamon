import { type Job, Worker } from "bullmq";
import { eq } from "drizzle-orm";

import { getJobHandlers } from "@/config/dynamic-registry.ts";
import { getRedisConnection } from "@/config/env.ts";
import { loadConfig } from "@/config/load-config.ts";
import { db, pool } from "@/db/index.ts";
import { jobsLog } from "@/db/schema/jobs-log.ts";
import { JOB_STATUS, type JobData } from "./job-types.ts";
import { captureConsoleLogs } from "./log-capture.ts";
import { fireNotifications, type JobEvent } from "./notifications.ts";
import { jobsQueueName } from "./queue.ts";

const jobHandlers = await getJobHandlers();
const config = await loadConfig();

async function upsertProcessingLog(job: Job<JobData>, jobId: string) {
  try {
    await db
      .insert(jobsLog)
      .values({
        jobId,
        teamId: (job.data.teamId as number) ?? null,
        queueName: jobsQueueName,
        jobName: job.name,
        status: JOB_STATUS.processing,
        payload: job.data,
        startedAt: new Date(),
        finishedAt: null,
        error: false,
        result: null,
      })
      .onConflictDoUpdate({
        target: jobsLog.jobId,
        set: {
          teamId: (job.data.teamId as number) ?? null,
          status: JOB_STATUS.processing,
          payload: job.data,
          startedAt: new Date(),
          finishedAt: null,
          error: false,
          result: null,
        },
      });
  } catch (error) {
    console.error(`Failed to upsert processing log for job ${jobId}:`, error);
  }
}

async function markCompleted(jobId: string, result: unknown, logs?: string) {
  try {
    await db
      .update(jobsLog)
      .set({
        status: JOB_STATUS.completed,
        result: result ?? null,
        logs: logs || null,
        error: false,
        finishedAt: new Date(),
      })
      .where(eq(jobsLog.jobId, jobId));
  } catch (error) {
    console.error(`Failed to mark job ${jobId} as completed:`, error);
  }
}

async function markFailed(jobId: string, error: Error, logs?: string) {
  try {
    await db
      .update(jobsLog)
      .set({
        status: JOB_STATUS.failed,
        error: true,
        result: { message: error.message },
        logs: logs || null,
        finishedAt: new Date(),
      })
      .where(eq(jobsLog.jobId, jobId));
  } catch (dbError) {
    console.error(`Failed to mark job ${jobId} as failed:`, dbError);
  }
}

const jobLogsMap = new Map<string, string>();

export const worker = new Worker<JobData>(
  jobsQueueName,
  async (job: Job<JobData>) => {
    const jobId = String(job.id ?? "");

    if (jobId) {
      await upsertProcessingLog(job, jobId);
    }

    const handler = jobHandlers[job.name];
    if (!handler) {
      throw new Error(`No handler registered for job '${job.name}'`);
    }

    const { result, logs } = await captureConsoleLogs(() => handler(job.data));
    if (jobId && logs) {
      jobLogsMap.set(jobId, logs);
    }
    return result;
  },
  { connection: getRedisConnection(), concurrency: 5 },
);

worker.on("completed", async (job, result) => {
  const jobId = String(job.id ?? "");
  const logs = jobLogsMap.get(jobId);
  jobLogsMap.delete(jobId);

  console.log(`Job ${job.id} completed.`);

  if (!job.id) {
    return;
  }

  await markCompleted(String(job.id), result, logs);

  const notifications = config.jobs[job.name]?.notifications;
  if (notifications?.on_success?.length) {
    const event: JobEvent = {
      jobName: job.name,
      jobId: String(job.id),
      status: "completed",
      durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null,
      result,
    };
    fireNotifications(notifications, event).catch((err) => {
      console.error(`[notifications] Error dispatching for job ${job.id}:`, err);
    });
  }
});

worker.on("failed", async (job, error) => {
  const jobId = String(job?.id ?? "");
  const logs = jobLogsMap.get(jobId);
  jobLogsMap.delete(jobId);

  console.error(`Job ${job?.id ?? "unknown"} failed:`, error);

  if (!job?.id || !error) {
    return;
  }

  await markFailed(String(job.id), error, logs);

  const notifications = config.jobs[job.name]?.notifications;
  if (notifications?.on_failure?.length) {
    const event: JobEvent = {
      jobName: job.name,
      jobId: String(job.id),
      status: "failed",
      durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null,
      error: error.message,
    };
    fireNotifications(notifications, event).catch((err) => {
      console.error(`[notifications] Error dispatching for job ${job.id}:`, err);
    });
  }
});

const shutdown = async () => {
  await worker.close();
  await pool.end();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
