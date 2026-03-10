export interface RunRow {
  id: number;
  jobId: string;
  jobName: string;
  queueName: string;
  teamId: number | null;
  status: string;
  error: boolean;
  payload: unknown;
  result: unknown;
  logs: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
}

export interface RunsFilters {
  name: string;
  status: string;
  since: string;
}

export interface DefinitionRow {
  name: string;
  command: string;
  script?: string;
  schedule?: string;
  timeout?: string;
  retries?: number;
  description?: string;
  teams?: string[];
  lastRun?: {
    status: string;
    createdAt: string;
  } | null;
}

export interface ScheduleRow {
  name: string;
  pattern: string;
  next: string | null;
  stats: {
    total: number;
    completed: number;
    failed: number;
  };
}

export interface ShellResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  parsed?: Record<string, unknown> | null;
}

export function isShellResult(value: unknown): value is ShellResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return "stdout" in v || "stderr" in v || "exitCode" in v;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  teams: Array<{ teamId: number; name: string; role: string }>;
}

export interface AdminTeam {
  id: number;
  name: string;
  createdAt: string;
}

export interface AdminApiKeyTeam {
  id: number;
  name: string;
}

export interface AdminApiKey {
  id: number;
  teams: AdminApiKeyTeam[];
  name: string | null;
  revoked: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export function formatJson(value: unknown): string {
  if (value == null) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
