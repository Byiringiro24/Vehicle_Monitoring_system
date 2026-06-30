import Redis from 'ioredis';
import logger from '../utils/logger';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error', (err) => logger.error('Redis error', err));
redis.on('connect', () => logger.info('Redis connected'));