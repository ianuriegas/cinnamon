import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { isEmailAllowed } from "@/config/env.ts";
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
  const host = c.req.header("host");
  if (!host) {
    const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
    return `${baseUrl.replace(/\/$/, "")}/auth/callback`;
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
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f2e5bc;
      color: #3c3836;
    }
    .card {
      background: #fbf1c7;
      border-radius: 1rem;
      padding: 2.5rem 2rem;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(60,56,54,0.12);
    }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; }
    p { color: #665c54; margin-bottom: 1.5rem; }
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: #d65d0e;
      color: #fbf1c7;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn:hover { background: #af3a03; }
    .error {
      background: #cc241d;
      color: #fbf1c7;
      padding: 0.875rem 1.25rem;
      border-radius: 0.5rem;
      margin-bottom: 1.25rem;
      font-size: 0.875rem;
      line-height: 1.4;
      font-weight: 500;
    }
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

      if (tokens.id_token) {
        const claims = await verifyGoogleIdToken(tokens.id_token);
        if (!isEmailAllowed(claims.email)) {
          deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
          deleteCookie(c, OAUTH_VERIFIER_COOKIE, { path: "/" });
          return c.redirect("/auth/login?error=access_denied");
        }
      }

      const jwt = await createSessionJwt(tokens);
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

    return c.json({
      authenticated: true,
      user: { email: session.email, name: session.name, picture: session.picture },
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
