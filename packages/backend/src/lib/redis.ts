import Redis from "ioredis";
import { config } from "../config.js";

/**
 * Shared Redis client for caching, idempotency, and pub/sub.
 * Uses the shared Redis 7 instance with the `nexum:` key prefix.
 */
export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  keyPrefix: config.redis.keyPrefix,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

/**
 * Connect to Redis. Call once during server startup.
 * Fails fast if Redis is unavailable rather than silently retrying.
 */
export async function connectRedis(): Promise<void> {
  await redis.connect();
}

/**
 * Disconnect from Redis. Call during graceful shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
