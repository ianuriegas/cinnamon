import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { isAccessRequestsEnabled, isSuperAdmin } from "@/config/env.ts";
import { db } from "@/db/index.ts";
import { teams } from "@/db/schema/teams.ts";
import { userTeams } from "@/db/schema/user-teams.ts";
import { users } from "@/db/schema/users.ts";
import {
  createSessionJwt,
  exchangeCodeForTokens,
  getGoogleAuthUrl,
  OAUTH_COOKIE_MAX_AGE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  SESSION_COOKIE,
  verifyGoogleIdToken,
} from "./dashboard-auth.ts";

function shouldUseSecureCookies(): boolean {
  const baseUrl = process.env.BASE_URL ?? "";
  return baseUrl.startsWith("https://");
}

/** Build redirect URI from request so cookie origin matches callback URL. */
function getRedirectUriFromRequest(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  const baseUrl = process.env.BASE_URL;
  if (baseUrl && (baseUrl.startsWith("http://") || baseUrl.startsWith("https://"))) {
    return `${baseUrl.replace(/\/$/, "")}/auth/callback`;
  }
  const host = c.req.header("host");
  if (!host) {
    return `${(baseUrl ?? "http://localhost:3000").replace(/\/$/, "")}/auth/callback`;
  }
  const proto = c.req.header("x-forwarded-proto")?.toLowerCase() === "https" ? "https" : "http";
  return `${proto}://${host}/auth/callback`;
}

export function createAuthRoutes() {
  const router = new Hono();

  router.get("/login", (c) => {
    const errorCode = c.req.query("error");
    const errorMessage = errorCode ? friendlyError(errorCode) : "";
    const errorHtml = errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : "";

    return c.html(`<!DOCTYPE html>
<html lang="en" data-theme="gruvbox-light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Sign in — Cinnamon</title>
  <script>
    (function(){var t=localStorage.getItem("cinnamon-theme")||"gruvbox-light";document.documentElement.setAttribute("data-theme",t);})();
  </script>
  <style>
    [data-theme="gruvbox-light"]{--login-bg:#f2e5bc;--login-card:#fbf1c7;--login-text:#3c3836;--login-muted:#665c54;--login-accent:#d65d0e;--login-accent-hover:#af3a03;--login-error:#cc241d;--login-error-text:#fbf1c7;}
    [data-theme="gruvbox-dark"]{--login-bg:#282828;--login-card:#3c3836;--login-text:#ebdbb2;--login-muted:#a89984;--login-accent:#fe8019;--login-accent-hover:#d65d0e;--login-error:#cc241d;--login-error-text:#fbf1c7;}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--login-bg);color:var(--login-text);}
    .card{background:var(--login-card);border-radius:1rem;padding:2.5rem 2rem;max-width:400px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.15);}
    h1{font-size:1.75rem;font-weight:700;margin-bottom:0.5rem;}
    p{color:var(--login-muted);margin-bottom:1.5rem;}
    .btn{display:inline-block;padding:0.75rem 1.5rem;background:var(--login-accent);color:var(--login-error-text);border:none;border-radius:0.5rem;font-size:1rem;font-weight:600;text-decoration:none;cursor:pointer;transition:background 0.15s;}
    .btn:hover{background:var(--login-accent-hover);}
    .error{background:var(--login-error);color:var(--login-error-text);padding:0.875rem 1.25rem;border-radius:0.5rem;margin-bottom:1.25rem;font-size:0.875rem;line-height:1.4;font-weight:500;}
  </style>
</head>
<body>
  <div class="card">
    <h1>Cinnamon</h1>
    <p>Sign in to access the dashboard</p>
    ${errorHtml}
    <a href="/auth/google" class="btn">Sign in with Google</a>
  </div>
</body>
</html>`);
  });

  router.get("/google", (c) => {
    const redirectUri = getRedirectUriFromRequest(c);
    const { url, state, codeVerifier } = getGoogleAuthUrl(redirectUri);
    const secure = shouldUseSecureCookies();

    setCookie(c, OAUTH_STATE_COOKIE, state, {
      path: "/",
      maxAge: OAUTH_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "Lax",
      secure,
    });
    setCookie(c, OAUTH_VERIFIER_COOKIE, codeVerifier, {
      path: "/",
      maxAge: OAUTH_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "Lax",
      secure,
    });

    return c.redirect(url);
  });

  router.get("/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");

    if (error) {
      const desc = c.req.query("error_description") ?? error;
      return c.redirect(`/auth/login?error=${encodeURIComponent(desc)}`);
    }

    const storedState = getCookie(c, OAUTH_STATE_COOKIE);
    const storedVerifier = getCookie(c, OAUTH_VERIFIER_COOKIE);

    if (!state || state !== storedState) {
      return c.redirect("/auth/login?error=invalid_state");
    }
    if (!code || !storedVerifier) {
      return c.redirect("/auth/login?error=missing_code");
    }

    try {
      const redirectUri = getRedirectUriFromRequest(c);
      const tokens = await exchangeCodeForTokens(code, storedVerifier, redirectUri);
      if (!tokens.id_token) throw new Error("No id_token in token response");

      const claims = await verifyGoogleIdToken(tokens.id_token);
      const isSA = isSuperAdmin(claims.email);

      let dbUser: {
        id: number;
        googleSub: string;
        email: string;
        name: string | null;
        picture: string | null;
        isSuperAdmin: boolean;
      } | null = null;

      if (isSA) {
        const [u] = await db
          .insert(users)
          .values({
            email: claims.email.toLowerCase(),
            name: claims.name,
            picture: claims.picture,
            googleSub: claims.sub,
            isSuperAdmin: true,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: users.googleSub,
            set: {
              name: claims.name,
              picture: claims.picture,
              isSuperAdmin: true,
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .returning();
        dbUser = u;
      } else {
        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.googleSub, claims.sub))
          .limit(1);
        if (existing) {
          if (!existing.disabled) {
            await db
              .update(users)
              .set({
                name: claims.name,
                picture: claims.picture,
                lastLoginAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(users.id, existing.id));
          }
          dbUser = { ...existing, name: claims.name, picture: claims.picture };
        }
      }

      const sessionUser = dbUser
        ? {
            id: dbUser.id,
            googleSub: dbUser.googleSub,
            email: dbUser.email,
            name: dbUser.name ?? "",
            picture: dbUser.picture ?? "",
            isSuperAdmin: dbUser.isSuperAdmin,
          }
        : {
            id: 0,
            googleSub: claims.sub,
            email: claims.email.toLowerCase(),
            name: claims.name ?? "",
            picture: claims.picture ?? "",
            isSuperAdmin: false,
          };

      const jwt = await createSessionJwt(sessionUser);
      const secure = shouldUseSecureCookies();
      const sessionMaxAge = 60 * 60 * 24 * 7;

      setCookie(c, SESSION_COOKIE, jwt, {
        path: "/",
        maxAge: sessionMaxAge,
        httpOnly: true,
        sameSite: "Lax",
        secure,
      });

      deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
      deleteCookie(c, OAUTH_VERIFIER_COOKIE, { path: "/" });

      return c.redirect("/dashboard");
    } catch (err) {
      console.error("OAuth callback error:", err);
      return c.redirect("/auth/login?error=authentication_failed");
    }
  });

  router.get("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.redirect("/auth/login");
  });

  router.get("/me", async (c) => {
    const { verifySession } = await import("./dashboard-auth.ts");
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return c.json({ authenticated: false }, 401);

    const session = await verifySession(token);
    if (!session) return c.json({ authenticated: false }, 401);

    const [dbUser] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    let teamIds: number[] = [];
    let teamNames: string[] = [];
    if (dbUser) {
      const utRows = await db
        .select({ teamId: userTeams.teamId, teamName: teams.name })
        .from(userTeams)
        .innerJoin(teams, eq(userTeams.teamId, teams.id))
        .where(eq(userTeams.userId, dbUser.id));
      teamIds = utRows.map((r) => r.teamId);
      teamNames = utRows.map((r) => r.teamName);
    }

    return c.json({
      authenticated: true,
      user: {
        userId: dbUser?.id ?? session.userId,
        email: dbUser?.email ?? session.email,
        name: dbUser?.name ?? session.name,
        picture: dbUser?.picture ?? session.picture,
        isSuperAdmin: dbUser?.isSuperAdmin ?? session.isSuperAdmin,
        disabled: dbUser ? dbUser.disabled : true,
        teamIds,
        teamNames,
      },
      accessRequestsEnabled: isAccessRequestsEnabled(),
    });
  });

  return router;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ERROR_MESSAGES: Record<string, string> = {
  access_denied:
    "Your account isn't authorized to access this dashboard. Contact an admin to request access.",
  invalid_state: "Login session expired. Please try again.",
  missing_code: "Something went wrong during sign-in. Please try again.",
  authentication_failed: "Authentication failed. Please try again.",
};

function friendlyError(code: string): string {
  return ERROR_MESSAGES[code] ?? code;
}
