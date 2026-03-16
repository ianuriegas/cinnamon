import type { Context, Next } from "hono";

export async function superAdminMiddleware(c: Context, next: Next) {
  const user = c.get("user");

  if (!user?.isSuperAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return next();
}
