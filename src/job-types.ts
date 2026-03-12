export const JOB_STATUS = {
  queued: "queued",
  processing: "processing",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  interrupted: "interrupted",
} as const;

export type JobData = Record<string, unknown>;
export type JobHandler = (
  payload: JobData,
  options?: import("@/jobs/shell/index.ts").ShellJobOptions,
) => Promise<unknown>;
