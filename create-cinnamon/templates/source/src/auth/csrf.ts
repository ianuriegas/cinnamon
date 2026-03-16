import type { Context, Next } from "hono";

import { getEnv } from "@/config/env.ts";

/**
 * Validates Origin / Referer on mutating requests to prevent CSRF.
 * Skipped when NODE_ENV=test.
 */
export async function csrfMiddleware(c: Context, next: Next) {
  if (process.env.NODE_ENV === "test") return next();
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS")
    return next();

  const { baseUrl } = getEnv();
  const origin = c.req.header("origin") ?? c.req.header("referer");

  if (!origin) {
    return c.json({ error: "Missing Origin header" }, 403);
  }

  try {
    const originHost = new URL(origin).origin;
    const expectedHost = new URL(baseUrl).origin;
    if (originHost !== expectedHost) {
      return c.json({ error: "Invalid Origin" }, 403);
    }
  } catch {
    return c.json({ error: "Invalid Origin" }, 403);
  }

  return next();
}
