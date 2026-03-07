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

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  picture: string;
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

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
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

export async function verifyGoogleIdToken(idToken: string): Promise<SessionPayload> {
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

export async function createSessionJwt(tokens: TokenResponse): Promise<string> {
  const { sessionSecret } = requireAuthEnv();
  if (!tokens.id_token) throw new Error("No id_token in token response");

  const claims = await verifyGoogleIdToken(tokens.id_token);
  const secret = new TextEncoder().encode(sessionSecret);

  return new SignJWT({ email: claims.email, name: claims.name, picture: claims.picture })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
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
    };
  } catch {
    return null;
  }
}
