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
};

export const redisConnection = parseRedisConnection(env.redisUrl);
