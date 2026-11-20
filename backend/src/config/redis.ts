import Redis from 'ioredis';
import logger from '../utils/logger';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,                 // don't auto-connect — connect explicitly
  enableOfflineQueue: false,         // fail fast when offline rather than queueing
  retryStrategy: (times) => {
    if (times > 3) return null;      // stop retrying after 3 attempts
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => logger.warn(`Redis unavailable — sessions/rate-limiting degraded: ${err.message}`));
redis.on('connect', () => logger.info('Redis connected'));