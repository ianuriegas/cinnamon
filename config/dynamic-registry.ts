import type { JobsOptions } from "bullmq";

import { runShellJob, type ShellJobOptions } from "@/src/executors/shell.ts";
import type { JobHandler } from "@/src/job-types.ts";
import type { CinnamonConfig, JobDefinition } from "./define-config.ts";
import { loadConfig, parseDuration } from "./load-config.ts";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Replaces ${VAR} references in env values with the corresponding
 * host process.env value. Unresolved variables become empty strings.
 */
export function interpolateEnv(env: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(env)) {
    result[key] = val.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? "");
  }
  return result;
}

/**
 * Wraps a config-driven job definition into a JobHandler that delegates
 * to the shell executor with the config's defaults merged in.
 */
function createConfigHandler(_name: string, def: JobDefinition): JobHandler {
  const timeoutMs = def.timeout ? parseDuration(def.timeout) : DEFAULT_TIMEOUT_MS;
  const baseArgs = [...(def.script ? [def.script] : []), ...(def.args ?? [])];

  return async (payload, options?: ShellJobOptions) => {
    const dryRunArgs = payload.dryRun === true ? ["--dry-run"] : [];
    const merged = {
      ...payload,
      command: def.command,
      args: [...baseArgs, ...((payload.args as string[]) ?? []), ...dryRunArgs],
      timeoutMs,
      parseJsonOutput: def.parseJsonOutput ?? false,
      env: def.env ? interpolateEnv(def.env) : undefined,
      cwd: def.cwd,
    };
    return runShellJob(merged, options);
  };
}

/**
 * Returns BullMQ job options (attempts/backoff) for a config-driven job,
 * or undefined if the job has no retry policy configured.
 */
export function getJobOptions(jobName: string, config: CinnamonConfig): JobsOptions | undefined {
  const def = config.jobs[jobName];
  if (!def?.retries) return undefined;
  return {
    attempts: def.retries,
    backoff: { type: "exponential", delay: 1000 },
  };
}

export function buildRegistry(config: CinnamonConfig): Record<string, JobHandler> {
  const registry: Record<string, JobHandler> = {
    shell: runShellJob as JobHandler,
  };

  for (const [name, def] of Object.entries(config.jobs)) {
    if (name in registry) {
      throw new Error(
        `Config job "${name}" collides with a native handler. Rename the config entry or remove the native handler.`,
      );
    }
    registry[name] = createConfigHandler(name, def);
  }

  return registry;
}

let _jobHandlers: Record<string, JobHandler> | null = null;

export async function getJobHandlers(): Promise<Record<string, JobHandler>> {
  if (_jobHandlers) return _jobHandlers;
  const config = await loadConfig();
  _jobHandlers = buildRegistry(config);
  return _jobHandlers;
}

/** Reset cached registry (useful for testing). */
export function resetRegistryCache(): void {
  _jobHandlers = null;
}
