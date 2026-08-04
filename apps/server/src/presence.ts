import { Redis } from "ioredis";
import { config } from "./config.js";

/** In-memory presence when Redis is down (local dev). */
const memory = new Map<string, Set<string>>();

let redis: Redis | null = null;
let redisReady = false;

export function initPresence(log: {
  warn: (o: unknown, msg?: string) => void;
}): void {
  redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  redis.on("error", (err) => {
    redisReady = false;
    log.warn({ err: err.message }, "redis");
  });
  redis.on("connect", () => {
    redisReady = true;
  });
  void redis.connect().catch(() => {
    redisReady = false;
    log.warn(
      "redis unavailable — using in-memory presence (single-process only)"
    );
  });
}

export async function presenceAdd(
  artifactId: string,
  userSub: string
): Promise<void> {
  if (redis && redisReady) {
    try {
      await redis.sadd(`presence:${artifactId}`, userSub);
      return;
    } catch {
      redisReady = false;
    }
  }
  let set = memory.get(artifactId);
  if (!set) {
    set = new Set();
    memory.set(artifactId, set);
  }
  set.add(userSub);
}

export async function presenceRemove(
  artifactId: string,
  userSub: string
): Promise<void> {
  if (redis && redisReady) {
    try {
      await redis.srem(`presence:${artifactId}`, userSub);
      return;
    } catch {
      redisReady = false;
    }
  }
  memory.get(artifactId)?.delete(userSub);
}

export async function presenceList(artifactId: string): Promise<string[]> {
  if (redis && redisReady) {
    try {
      return await redis.smembers(`presence:${artifactId}`);
    } catch {
      redisReady = false;
    }
  }
  return [...(memory.get(artifactId) ?? [])];
}
