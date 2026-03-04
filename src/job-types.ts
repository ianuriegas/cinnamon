export const JOB_STATUS = {
  processing: "processing",
  completed: "completed",
  failed: "failed",
} as const;

export type JobData = Record<string, unknown>;
export type JobHandler = (payload: JobData) => Promise<unknown>;
