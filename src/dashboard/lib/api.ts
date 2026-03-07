import type { DefinitionRow, PaginationInfo, RunRow, RunsFilters, ScheduleRow } from "./types";

const BASE = "/api/dashboard";

function handleUnauthorized(res: Response): void {
  if (res.status === 401) {
    window.location.href = "/auth/login";
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", credentials: "include" });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchRuns(
  filters: RunsFilters,
  pagination: { limit: number; offset: number },
): Promise<{ data: RunRow[]; pagination: PaginationInfo; jobNames: string[] }> {
  const params = new URLSearchParams();
  if (filters.name) params.set("name", filters.name);
  if (filters.status) params.set("status", filters.status);
  if (filters.since) params.set("since", filters.since);
  params.set("limit", String(pagination.limit));
  params.set("offset", String(pagination.offset));
  return get(`/runs?${params}`);
}

export async function fetchRun(id: string): Promise<{ data: RunRow }> {
  return get(`/runs/${id}`);
}

export async function fetchRunRaw(id: string): Promise<string> {
  const res = await fetch(`${BASE}/runs/${id}/raw`, { credentials: "include" });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

export async function fetchDefinitions(): Promise<{ data: DefinitionRow[] }> {
  return get("/definitions");
}

export async function fetchSchedules(): Promise<{ data: ScheduleRow[] }> {
  return get("/schedules");
}

export async function triggerJob(name: string): Promise<{ jobId?: string; error?: string }> {
  return post(`/trigger/${name}`);
}

export async function cancelRun(id: string): Promise<{ status?: string; error?: string }> {
  return post(`/runs/${id}/cancel`);
}

export function streamRunUrl(id: string): string {
  return `${BASE}/runs/${id}/stream`;
}
