export const JOB_STATUS = {
  queued: "queued",
  processing: "processing",
  completed: "completed",
  failed: "failed",
} as const;

export type JobData = Record<string, unknown>;
export type JobHandler = (payload: JobData) => Promise<unknown>;
