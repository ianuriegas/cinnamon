export interface JobDefinition {
  command: string;
  /** Appended as the first argument to command (e.g. "./scripts/hello.py"). */
  script?: string;
  args?: string[];
  /** Duration string: "30s", "5m", "1h", "500ms". Defaults to 30s. */
  timeout?: string;
  retries?: number;
  env?: Record<string, string>;
  cwd?: string;
  description?: string;
  parseJsonOutput?: boolean;
  /** Cron expression for scheduled execution (used by scheduler in Phase 5). */
  schedule?: string;
}

export interface CinnamonConfig {
  jobs: Record<string, JobDefinition>;
}

export function defineConfig(config: CinnamonConfig): CinnamonConfig {
  return config;
}
