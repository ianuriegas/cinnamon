import { type Job, Worker } from "bullmq";
import { eq } from "drizzle-orm";

import { db } from "../db/index.ts";
import { jobsLog } from "../db/schema/jobs-log.ts";
import { runCinnamonJob } from "../jobs/cinnamon.ts";
import { jobsQueueName, redisConnection } from "./queue.ts";

type JobData = Record<string, unknown>;
type JobHandler = (payload: JobData) => Promise<unknown>;

const jobHandlers: Record<string, JobHandler> = {
  cinnamon: runCinnamonJob as JobHandler,
};

async function upsertProcessingLog(job: Job<JobData>, jobId: string) {
  try {
    await db
      .insert(jobsLog)
      .values({
        jobId,
        queueName: jobsQueueName,
        jobName: job.name,
        status: "processing",
        payload: job.data,
        startedAt: new Date(),
        finishedAt: null,
        error: false,
        result: null,
      })
      .onConflictDoUpdate({
        target: jobsLog.jobId,
        set: {
          status: "processing",
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

async function markCompleted(jobId: string, result: unknown) {
  try {
    await db
      .update(jobsLog)
      .set({
        status: "completed",
        result: result ?? null,
        error: false,
        finishedAt: new Date(),
      })
      .where(eq(jobsLog.jobId, jobId));
  } catch (error) {
    console.error(`Failed to mark job ${jobId} as completed:`, error);
  }
}

async function markFailed(jobId: string, error: Error) {
  try {
    await db
      .update(jobsLog)
      .set({
        status: "failed",
        error: true,
        result: { message: error.message },
        finishedAt: new Date(),
      })
      .where(eq(jobsLog.jobId, jobId));
  } catch (dbError) {
    console.error(`Failed to mark job ${jobId} as failed:`, dbError);
  }
}

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

    return handler(job.data);
  },
  { connection: redisConnection },
);

worker.on("completed", async (job, result) => {
  console.log(`Job ${job.id} completed.`);

  if (!job.id) {
    return;
  }

  await markCompleted(String(job.id), result);
});

worker.on("failed", async (job, error) => {
  console.error(`Job ${job?.id ?? "unknown"} failed:`, error);

  if (!job?.id || !error) {
    return;
  }

  await markFailed(String(job.id), error);
});

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
