import "dotenv/config";
import { parseRedisConnection } from "./redis.ts";

const DEFAULT_REDIS_URL = "redis://localhost:6379";

let _env: ReturnType<typeof loadEnv> | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function loadEnv() {
  return {
    databaseUrl: getRequiredEnv("DATABASE_URL"),
    redisUrl: process.env.REDIS_URL ?? DEFAULT_REDIS_URL,
    spotifyAccessToken: process.env.SPOTIFY_ACCESS_TOKEN,
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    spotifyRefreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
  };
}

export function getEnv() {
  if (!_env) _env = loadEnv();
  return _env;
}

export function getRedisConnection() {
  return parseRedisConnection(getEnv().redisUrl);
}
