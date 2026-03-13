import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

import { getEnv, isDashboardAuthEnabled } from "@/config/env.ts";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");
const GOOGLE_ISSUER = "https://accounts.google.com";
const SCOPES = ["openid", "email", "profile"];

export const SESSION_COOKIE = "cinnamon_session";
export const OAUTH_STATE_COOKIE = "oauth_state";
export const OAUTH_VERIFIER_COOKIE = "oauth_code_verifier";
export const OAUTH_COOKIE_MAX_AGE = 600; // 10 min
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const googleJwks = createRemoteJWKSet(GOOGLE_JWKS_URL);

interface GoogleClaims {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

interface SessionPayload extends GoogleClaims {
  userId: number;
  isSuperAdmin: boolean;
}

function requireAuthEnv() {
  const env = getEnv();
  const { googleClientId, googleClientSecret, sessionSecret, baseUrl } = env;
  if (!googleClientId || !googleClientSecret || !sessionSecret) {
    throw new Error(
      "OAuth not configured: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET required",
    );
  }
  return { googleClientId, googleClientSecret, sessionSecret, baseUrl };
}

// ---------------------------------------------------------------------------
// PKCE + State helpers
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return randomBytes(16).toString("hex");
}

// ---------------------------------------------------------------------------
// Google OAuth helpers
// ---------------------------------------------------------------------------

export function getGoogleAuthUrl(redirectUri: string): {
  url: string;
  state: string;
  codeVerifier: string;
} {
  const { googleClientId } = requireAuthEnv();
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return { url: `${GOOGLE_AUTH_URL}?${params}`, state, codeVerifier };
}

interface TokenResponse {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const { googleClientId, googleClientSecret } = requireAuthEnv();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: googleClientId,
      client_secret: googleClientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).error_description ?? "Token exchange failed");
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleClaims> {
  const { googleClientId } = requireAuthEnv();
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: GOOGLE_ISSUER,
    audience: googleClientId,
  });

  return {
    sub: payload.sub as string,
    email: (payload.email as string) ?? "",
    name: (payload.name as string) ?? "",
    picture: (payload.picture as string) ?? "",
  };
}

interface SessionUser {
  id: number;
  googleSub: string;
  email: string;
  name: string;
  picture: string;
  isSuperAdmin: boolean;
}

export async function createSessionJwt(user: SessionUser): Promise<string> {
  const { sessionSecret } = requireAuthEnv();
  const secret = new TextEncoder().encode(sessionSecret);

  return new SignJWT({
    email: user.email,
    name: user.name,
    picture: user.picture,
    userId: user.id,
    isSuperAdmin: user.isSuperAdmin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.googleSub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (!isDashboardAuthEnabled()) return null;

  const { sessionSecret } = requireAuthEnv();
  try {
    const secret = new TextEncoder().encode(sessionSecret);
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      email: (payload.email as string) ?? "",
      name: (payload.name as string) ?? "",
      picture: (payload.picture as string) ?? "",
      userId: (payload.userId as number) ?? 0,
      isSuperAdmin: (payload.isSuperAdmin as boolean) ?? false,
    };
  } catch {
    return null;
  }
}
