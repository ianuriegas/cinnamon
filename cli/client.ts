import type { CliConfig } from "./config.ts";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createClient(config: CliConfig) {
  async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${config.apiUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg =
        data && typeof data === "object" && "error" in data
          ? (data as { error: string }).error
          : `HTTP ${res.status}`;
      throw new ApiError(res.status, msg);
    }

    return data as T;
  }

  return {
    get: <T = unknown>(path: string) => request<T>("GET", path),
    post: <T = unknown>(path: string, body?: unknown) => request<T>("POST", path, body),
  };
}

export type Client = ReturnType<typeof createClient>;
