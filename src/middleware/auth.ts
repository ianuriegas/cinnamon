import type { Context, Next } from "hono";
import { verifyApiKey } from "@/src/auth.ts";

type AuthEnv = {
  Variables: {
    teamIds: number[];
  };
};

export async function authMiddleware(c: Context<AuthEnv>, next: Next) {
  const header = c.req.header("authorization");

  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or malformed Authorization header" }, 401);
  }

  const plainKey = header.slice("Bearer ".length);
  const result = await verifyApiKey(plainKey);

  if (!result || result.teamIds.length === 0) {
    return c.json({ error: "Invalid or revoked API key" }, 401);
  }

  c.set("teamIds", result.teamIds);
  return next();
}
