import { Redis } from "ioredis";
import { getRedisUrl } from "./env.ts";

let _publisher: Redis | null = null;

export function getRedisPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(getRedisUrl(), { maxRetriesPerRequest: null, lazyConnect: true });
    _publisher.connect().catch(() => {});
  }
  return _publisher;
}

export function createRedisSubscriber(): Redis {
  return new Redis(getRedisUrl(), { maxRetriesPerRequest: null });
}

export async function closeRedisPublisher(): Promise<void> {
  if (_publisher) {
    await _publisher.quit();
    _publisher = null;
  }
}

export const CHANNEL_PREFIX = {
  logs: "cinnamon:logs:",
  logbuf: "cinnamon:logbuf:",
  cancel: "cinnamon:cancel:",
} as const;
