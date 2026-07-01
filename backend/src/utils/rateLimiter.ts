import { redis } from '../config/redis';

export async function checkRateLimit(key: string, maxRequests: number, windowSec: number): Promise<boolean> {
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, windowSec);
  return current <= maxRequests;
}