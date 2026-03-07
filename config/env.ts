import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import "dotenv/config";
import { parseRedisConnection } from "./redis.ts";

const DEFAULT_REDIS_URL = "redis://localhost:6379";

interface GoogleClientSecretFile {
  web?: { client_id?: string; client_secret?: string; redirect_uris?: string[] };
}

function loadGoogleClientSecret(): { clientId?: string; clientSecret?: string } {
  const filePath = resolve("client_secret.json");
  if (!existsSync(filePath)) return {};
  try {
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as GoogleClientSecretFile;
    return {
      clientId: data.web?.client_id,
      clientSecret: data.web?.client_secret,
    };
  } catch {
    return {};
  }
}

let _env: ReturnType<typeof loadEnv> | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const DEFAULT_PORT = 3000;

function loadEnv() {
  const googleFile = loadGoogleClientSecret();

  return {
    databaseUrl: getRequiredEnv("DATABASE_URL"),
    redisUrl: process.env.REDIS_URL ?? DEFAULT_REDIS_URL,
    port: Number(process.env.PORT) || DEFAULT_PORT,
    disableCronJobs: process.env.DISABLE_CRON_JOBS === "true",
    spotifyAccessToken: process.env.SPOTIFY_ACCESS_TOKEN,
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    spotifyRefreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? googleFile.clientId,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? googleFile.clientSecret,
    baseUrl: process.env.BASE_URL ?? `http://localhost:${Number(process.env.PORT) || DEFAULT_PORT}`,
    sessionSecret: process.env.SESSION_SECRET,
    allowedEmails: parseAllowedEmails(process.env.ALLOWED_EMAILS),
  };
}

function parseAllowedEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isDashboardAuthEnabled(): boolean {
  const env = getEnv();
  return Boolean(env.googleClientId && env.sessionSecret);
}

export function isEmailAllowed(email: string): boolean {
  const { allowedEmails } = getEnv();
  if (allowedEmails.length === 0) return true;
  return allowedEmails.includes(email.toLowerCase());
}

export function getEnv() {
  if (!_env) _env = loadEnv();
  return _env;
}

export function getRedisConnection() {
  return parseRedisConnection(getEnv().redisUrl);
}

export function getRedisUrl(): string {
  return getEnv().redisUrl;
}
