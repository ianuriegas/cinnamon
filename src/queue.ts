import { Queue } from "bullmq";
import { redisConnection } from "../config/env.ts";

export { redisConnection };

export const jobsQueueName = "jobs-queue";
const queueRetentionSeconds = 12 * 60 * 60;

export const jobsQueue = new Queue(jobsQueueName, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { age: queueRetentionSeconds },
    removeOnFail: { age: queueRetentionSeconds },
  },
});
