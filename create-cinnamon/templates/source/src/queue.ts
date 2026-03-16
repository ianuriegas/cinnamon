import { Queue } from "bullmq";
import { getRedisConnection } from "@/config/env.ts";

export const jobsQueueName = process.env.NODE_ENV === "test" ? "jobs-queue-test" : "jobs-queue";
const queueRetentionSeconds = 12 * 60 * 60;

export const jobsQueue = new Queue(jobsQueueName, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: { age: queueRetentionSeconds },
    removeOnFail: { age: queueRetentionSeconds },
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});
