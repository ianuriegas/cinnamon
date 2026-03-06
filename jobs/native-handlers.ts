import type { JobHandler } from "@/src/job-types.ts";
import { runShellJob } from "./shell/index.ts";

export const nativeHandlers: Record<string, JobHandler> = {
  shell: runShellJob as JobHandler,
};
