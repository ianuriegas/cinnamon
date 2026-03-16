export function parseRedisConnection(redisUrl: string) {
  const parsed = new URL(redisUrl);

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error(`Invalid REDIS_URL protocol: ${parsed.protocol}`);
  }

  if (!parsed.hostname) {
    throw new Error("Invalid REDIS_URL: hostname is required");
  }

  const parsedPort = parsed.port ? Number(parsed.port) : 6379;
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`Invalid REDIS_URL port: ${parsed.port}`);
  }

  return {
    host: parsed.hostname,
    port: parsedPort,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
