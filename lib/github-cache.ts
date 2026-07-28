import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

function getRedisClient() {
  if (redisClient !== undefined) return redisClient;

  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.CACHE_KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.CACHE_KV_REST_API_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = new Redis({ url, token });
  } catch {
    redisClient = null;
  }

  return redisClient;
}

export async function readGithubCache<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

export async function writeGithubCache(
  key: string,
  owner: string,
  payload: unknown,
  ttlMs: number,
) {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(key, payload, { px: ttlMs });
  } catch {
    // The city remains available through GitHub and Vercel's data cache if
    // Redis is temporarily unavailable or has not been configured locally.
  }

  void owner;
}
