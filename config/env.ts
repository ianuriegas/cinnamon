import "dotenv/config";
import { parseRedisConnection } from "./redis.ts";

const DEFAULT_REDIS_URL = "redis://localhost:6379";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export const env = {
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? DEFAULT_REDIS_URL,
  spotifyAccessToken: process.env.SPOTIFY_ACCESS_TOKEN,
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  spotifyRefreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
};

export const redisConnection = parseRedisConnection(env.redisUrl);
