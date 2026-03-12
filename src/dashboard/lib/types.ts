export interface RunRow {
  id: number;
  jobId: string;
  jobName: string;
  queueName: string;
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

export interface TeamRow {
  id: number;
  name: string;
  createdAt: string;
}

export interface ApiKeyRow {
  id: number;
  label: string | null;
  keyHint: string;
  revoked: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  teamId: number;
  teamName: string;
}

export interface ApiKeyCreateResponse extends ApiKeyRow {
  plainKey: string;
}

export interface ApiKeyRotateResponse extends ApiKeyCreateResponse {
  rotatedFromId: number;
}

export interface UserRow {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  googleSub: string;
  isSuperAdmin: boolean;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AccessRequestRow {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  status: "pending" | "approved" | "denied";
  requestedAt: string;
  decidedBy: number | null;
  decidedAt: string | null;
  notes: string | null;
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

export function formatJson(value: unknown): string {
  if (value == null) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
