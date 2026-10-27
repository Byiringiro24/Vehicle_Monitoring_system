/**
 * GET /health           — simple liveness check (existing)
 * GET /health/detailed  — full system health: DB, Redis, MQTT, SMTP
 * Super Admin only for the detailed endpoint.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { verifySmtpConnection } from '../services/email.service';
import { authenticate, authorize } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// Public liveness (used by Docker healthcheck)
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'artic-vms-backend',
    version: process.env.npm_package_version ?? '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Detailed health — Super Admin only
router.get('/detailed', authenticate as any, authorize('SUPER_ADMIN') as any, async (_req, res) => {
  const result: Record<string, any> = {
    status: 'ok',
    version: process.env.npm_package_version ?? '1.0.0',
    timestamp: new Date().toISOString(),
    db: false, dbLatency: null,
    redis: false, redisLatency: null,
    mqtt: false, mqttClients: 0,
    smtp: false, smtpHost: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  };

  // ── PostgreSQL ────────────────────────────────────────────────────────────
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    result.db = true;
    result.dbLatency = Date.now() - t0;
  } catch (err: any) {
    logger.warn(`[HEALTH] DB check failed: ${err.message}`);
  }

  // ── Redis ─────────────────────────────────────────────────────────────────
  try {
    const t0 = Date.now();
    await redis.ping();
    result.redis = true;
    result.redisLatency = Date.now() - t0;
  } catch (err: any) {
    logger.warn(`[HEALTH] Redis check failed: ${err.message}`);
  }

  // ── MQTT (check if broker module reports connected) ───────────────────────
  try {
    const { getMqttClient } = await import('../services/mqttClient');
    const client = getMqttClient();
    result.mqtt = !!(client?.connected);
  } catch {
    result.mqtt = false;
  }

  // ── SMTP ──────────────────────────────────────────────────────────────────
  try {
    result.smtp = await verifySmtpConnection();
  } catch {
    result.smtp = false;
  }

  // Overall status
  result.status = result.db && result.redis ? 'ok' : 'degraded';

  res.json(result);
});

export default router;
