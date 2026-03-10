import type {
  AdminApiKey,
  AdminApiKeyTeam,
  AdminTeam,
  AdminUser,
  DefinitionRow,
  PaginationInfo,
  RunRow,
  RunsFilters,
  ScheduleRow,
} from "./types";

const BASE = "/api/dashboard";
const ADMIN_BASE = "/api/admin";

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

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${ADMIN_BASE}${path}`, { credentials: "include" });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function adminDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    method: "DELETE",
    credentials: "include",
  });
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

export interface UserTeam {
  teamId: number;
  name: string;
  role: string;
}

export interface AuthUser {
  email: string;
  name: string;
  picture: string;
  isSuperAdmin: boolean;
  teams: UserTeam[];
}

// --- Admin API (super-admin only) ---

export async function fetchAdminUsers(): Promise<{ data: AdminUser[] }> {
  return adminGet("/users");
}

export async function fetchAdminTeams(): Promise<{ data: AdminTeam[] }> {
  return adminGet("/teams");
}

export async function createAdminTeam(name: string): Promise<{ data: AdminTeam }> {
  return adminPost("/teams", { name });
}

export async function assignUserTeam(
  userId: number,
  teamId: number,
  role: string,
): Promise<{ status: string }> {
  return adminPost(`/users/${userId}/teams`, { teamId, role });
}

export async function removeUserTeam(userId: number, teamId: number): Promise<{ status: string }> {
  return adminDelete(`/users/${userId}/teams/${teamId}`);
}

export async function fetchAdminKeys(): Promise<{ data: AdminApiKey[] }> {
  return adminGet("/keys");
}

export async function createAdminKey(
  teamIds: number[],
  name?: string,
): Promise<{ data: AdminApiKey; key: string }> {
  return adminPost("/keys", { teamIds, name });
}

export async function fetchAdminKey(id: number): Promise<{ data: AdminApiKey }> {
  return adminGet(`/keys/${id}`);
}

async function adminPatch(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function updateAdminKeyTeams(
  id: number,
  teamIds: number[],
): Promise<{ data: { teams: AdminApiKeyTeam[] } }> {
  return adminPatch(`/keys/${id}/teams`, { teamIds }) as Promise<{
    data: { teams: AdminApiKeyTeam[] };
  }>;
}

export async function revokeAdminKey(id: number): Promise<{ status: string }> {
  return adminDelete(`/keys/${id}`);
}

export async function fetchAuthUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.authenticated) return null;
    return {
      ...data.user,
      isSuperAdmin: data.isSuperAdmin ?? false,
      teams: data.teams ?? [],
    };
  } catch {
    return null;
  }
}
