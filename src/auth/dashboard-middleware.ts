import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";

import { isDashboardAuthEnabled } from "@/config/env.ts";

import { SESSION_COOKIE, verifySession } from "./dashboard-auth.ts";

export async function dashboardAuthMiddleware(c: Context, next: Next) {
  if (!isDashboardAuthEnabled()) return next();

  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifySession(token);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  return next();
}
