import type {
  AccessRequestRow,
  ApiKeyCreateResponse,
  ApiKeyRotateResponse,
  ApiKeyRow,
  DefinitionRow,
  PaginationInfo,
  RunRow,
  RunsFilters,
  ScheduleRow,
  TeamRow,
  UserRow,
} from "./types";

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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", credentials: "include" });
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

export async function retryRun(id: string): Promise<{ status?: string; error?: string }> {
  return post(`/runs/${id}/retry`);
}

export function streamRunUrl(id: string): string {
  return `${BASE}/runs/${id}/stream`;
}

export interface AuthUser {
  userId: number;
  email: string;
  name: string;
  picture: string;
  isSuperAdmin: boolean;
  disabled: boolean;
  teamIds?: number[];
  teamNames?: string[];
}

interface AuthResponse {
  user: AuthUser | null;
  accessRequestsEnabled: boolean;
  authEnabled: boolean;
}

export async function fetchAuthUser(): Promise<AuthResponse> {
  try {
    const res = await fetch("/auth/me", { credentials: "include" });
    if (res.status === 401) {
      window.location.replace("/auth/login");
      return { user: null, accessRequestsEnabled: false, authEnabled: true };
    }
    if (!res.ok) return { user: null, accessRequestsEnabled: false, authEnabled: true };
    const data = await res.json();
    return {
      user: data.authenticated ? data.user : null,
      accessRequestsEnabled: data.accessRequestsEnabled ?? false,
      authEnabled: data.authEnabled ?? true,
    };
  } catch {
    return { user: null, accessRequestsEnabled: false, authEnabled: true };
  }
}

// --- API Keys ---

export async function fetchApiKeys(): Promise<{ data: ApiKeyRow[] }> {
  return get("/api-keys");
}

export async function createApiKey(label: string, teamId?: number): Promise<ApiKeyCreateResponse> {
  return postJson("/api-keys", { label, ...(teamId != null && { teamId }) });
}

export async function updateApiKeyLabel(
  id: number,
  label: string,
): Promise<{ data: { id: number; label: string } }> {
  return patch(`/api-keys/${id}`, { label });
}

export async function rotateApiKey(id: number): Promise<ApiKeyRotateResponse> {
  return post(`/api-keys/${id}/rotate`);
}

export async function revokeApiKey(id: number): Promise<{ status: string }> {
  return post(`/api-keys/${id}/revoke`);
}

// --- Teams ---

export async function fetchTeams(): Promise<{ data: TeamRow[] }> {
  return get("/teams");
}

export async function createTeam(name: string): Promise<{ data: TeamRow }> {
  return postJson("/teams", { name });
}

export async function updateTeamName(id: number, name: string): Promise<{ data: TeamRow }> {
  return patch(`/teams/${id}`, { name });
}

export async function deleteTeam(id: number): Promise<{ status: string }> {
  return del(`/teams/${id}`);
}

// --- Users ---

export async function fetchUsers(): Promise<{ data: UserRow[] }> {
  return get("/users");
}

export async function updateUser(
  id: number,
  updates: { disabled?: boolean },
): Promise<{ data: UserRow }> {
  return patch(`/users/${id}`, updates);
}

export async function fetchUserTeams(userId: number): Promise<{ data: TeamRow[] }> {
  return get(`/users/${userId}/teams`);
}

export async function updateUserTeams(
  userId: number,
  teamIds: number[],
): Promise<{ data: TeamRow[] }> {
  return put(`/users/${userId}/teams`, { teamIds });
}

export async function approveAccessRequest(
  id: number,
  teamIds?: number[],
): Promise<{ status: string }> {
  return postJson(`/access-requests/${id}/approve`, teamIds != null ? { teamIds } : {});
}

// --- Access Requests ---

export async function fetchAccessRequests(status?: string): Promise<{ data: AccessRequestRow[] }> {
  const qs = status ? `?status=${status}` : "";
  return get(`/access-requests${qs}`);
}

export async function fetchMyAccessRequest(): Promise<{ data: AccessRequestRow | null }> {
  return get("/access-requests/mine");
}

export async function submitAccessRequest(): Promise<{ data: AccessRequestRow }> {
  return post("/access-requests");
}

export async function denyAccessRequest(id: number, notes?: string): Promise<{ status: string }> {
  return postJson(`/access-requests/${id}/deny`, { notes });
}
