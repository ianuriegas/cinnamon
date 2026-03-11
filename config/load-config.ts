import type { CinnamonConfig, JobDefinition, WebhookTarget } from "./define-config.ts";

const DURATION_PATTERN = /^(\d+)(ms|s|m|h)$/;

const DURATION_MULTIPLIERS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
};

export function parseDuration(input: string): number {
  const match = input.match(DURATION_PATTERN);
  if (!match) {
    throw new Error(
      `Invalid duration "${input}". Expected format: <number><unit> where unit is ms, s, m, or h (e.g. "30s", "5m")`,
    );
  }
  const value = Number(match[1]);
  const unit = match[2];
  if (value <= 0) {
    throw new Error(`Duration must be positive, got "${input}"`);
  }
  return value * DURATION_MULTIPLIERS[unit];
}

const CRON_FIELD_COUNT = 5;

function validateCronExpression(jobName: string, expression: string): void {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== CRON_FIELD_COUNT) {
    throw new Error(
      `Job "${jobName}": invalid cron expression "${expression}". Expected ${CRON_FIELD_COUNT} fields (minute hour day-of-month month day-of-week), got ${fields.length}`,
    );
  }
}

function validateWebhookTarget(
  jobName: string,
  event: string,
  index: number,
  target: unknown,
): asserts target is WebhookTarget {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw new Error(
      `Job "${jobName}": notifications.${event}[${index}] must be an object with a "url" field`,
    );
  }
  const t = target as Record<string, unknown>;
  if (typeof t.url !== "string" || t.url.trim() === "") {
    throw new Error(
      `Job "${jobName}": notifications.${event}[${index}].url must be a non-empty string`,
    );
  }
}

function validateJobDefinition(name: string, def: unknown): JobDefinition {
  if (!def || typeof def !== "object" || Array.isArray(def)) {
    throw new Error(`Job "${name}": definition must be an object`);
  }

  const d = def as Record<string, unknown>;

  if (typeof d.command !== "string" || d.command.trim() === "") {
    throw new Error(`Job "${name}": "command" is required and must be a non-empty string`);
  }

  if (d.script !== undefined && typeof d.script !== "string") {
    throw new Error(`Job "${name}": "script" must be a string`);
  }

  if (d.args !== undefined && !Array.isArray(d.args)) {
    throw new Error(`Job "${name}": "args" must be an array`);
  }

  if (d.timeout !== undefined) {
    if (typeof d.timeout !== "string") {
      throw new Error(`Job "${name}": "timeout" must be a duration string (e.g. "30s", "5m")`);
    }
    parseDuration(d.timeout);
  }

  if (d.retries !== undefined) {
    if (typeof d.retries !== "number" || !Number.isInteger(d.retries) || d.retries < 0) {
      throw new Error(`Job "${name}": "retries" must be a non-negative integer`);
    }
  }

  if (d.env !== undefined) {
    if (!d.env || typeof d.env !== "object" || Array.isArray(d.env)) {
      throw new Error(`Job "${name}": "env" must be a Record<string, string>`);
    }
    for (const [key, val] of Object.entries(d.env as Record<string, unknown>)) {
      if (typeof val !== "string") {
        throw new Error(`Job "${name}": env["${key}"] must be a string`);
      }
    }
  }

  if (d.cwd !== undefined && typeof d.cwd !== "string") {
    throw new Error(`Job "${name}": "cwd" must be a string`);
  }

  if (d.description !== undefined && typeof d.description !== "string") {
    throw new Error(`Job "${name}": "description" must be a string`);
  }

  if (d.parseJsonOutput !== undefined && typeof d.parseJsonOutput !== "boolean") {
    throw new Error(`Job "${name}": "parseJsonOutput" must be a boolean`);
  }

  if (d.schedule !== undefined) {
    if (typeof d.schedule !== "string") {
      throw new Error(`Job "${name}": "schedule" must be a cron string`);
    }
    validateCronExpression(name, d.schedule);
  }

  if (d.notifications !== undefined) {
    if (!d.notifications || typeof d.notifications !== "object" || Array.isArray(d.notifications)) {
      throw new Error(`Job "${name}": "notifications" must be an object`);
    }
    const n = d.notifications as Record<string, unknown>;
    for (const event of ["on_failure", "on_success"] as const) {
      if (n[event] !== undefined) {
        if (!Array.isArray(n[event])) {
          throw new Error(`Job "${name}": "notifications.${event}" must be an array`);
        }
        for (const [i, target] of (n[event] as unknown[]).entries()) {
          validateWebhookTarget(name, event, i, target);
        }
      }
    }
  }

  if (d.teams !== undefined) {
    if (!Array.isArray(d.teams) || d.teams.some((t) => typeof t !== "string")) {
      throw new Error(`Job "${name}": "teams" must be an array of strings`);
    }
  }

  return d as unknown as JobDefinition;
}

function validateConfig(raw: unknown): CinnamonConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Config must be an object with a 'jobs' field");
  }

  const config = raw as Record<string, unknown>;

  if (!config.jobs || typeof config.jobs !== "object" || Array.isArray(config.jobs)) {
    throw new Error("Config 'jobs' field is required and must be an object");
  }

  const jobs: Record<string, JobDefinition> = {};
  for (const [name, def] of Object.entries(config.jobs as Record<string, unknown>)) {
    jobs[name] = validateJobDefinition(name, def);
  }

  return { jobs };
}

let _config: CinnamonConfig | null = null;

export async function loadConfig(): Promise<CinnamonConfig> {
  if (_config) return _config;

  const mod = await import("@/cinnamon.config.ts");
  const raw = mod.default ?? mod;
  _config = validateConfig(raw);
  return _config;
}

/** Reset cached config (useful for testing). */
export function resetConfigCache(): void {
  _config = null;
}

export interface ScheduleEntry {
  jobName: string;
  pattern: string;
  data: Record<string, unknown>;
}

export function getScheduledJobs(config: CinnamonConfig): ScheduleEntry[] {
  return Object.entries(config.jobs)
    .filter(([_, def]) => def.schedule)
    .map(([name, def]) => ({
      jobName: name,
      pattern: def.schedule as string,
      data: {},
    }));
}

export { validateConfig as _validateConfig };
