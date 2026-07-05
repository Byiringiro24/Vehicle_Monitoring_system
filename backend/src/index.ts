import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { initSocketServer } from './websocket/socketServer';
import { initMqttBroker } from './services/mqttBroker';
import { initMqttClient } from './services/mqttClient';
import { prisma } from './config/database';
import { redis } from './config/redis';
import logger from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const MQTT_PORT = parseInt(process.env.MQTT_PORT ?? '1883', 10);

async function bootstrap() {
  // Test DB connection
  await prisma.$connect();
  logger.info('PostgreSQL connected');

  // Test Redis
  await redis.ping();
  logger.info('Redis connected');

  // HTTP + Socket.IO server
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  // MQTT broker — skip if port is already in use (e.g. mosquitto on Ubuntu)
  try {
    initMqttBroker(MQTT_PORT);
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      logger.warn(`MQTT port ${MQTT_PORT} already in use — MQTT broker disabled. Set MQTT_PORT to a free port (e.g. 1884).`);
    } else {
      throw err;
    }
  }

  // MQTT publisher client — used to send lock/unlock commands to devices
  initMqttClient();

  // ── Auto-ping job — ping all vehicles every 15 seconds ────────────────────
  // This keeps the gps:online/gps:offline events accurate and auto-resolves
  // GPS status without requiring manual button clicks
  setInterval(async () => {
    try {
      const { getMqttClient } = await import('./services/mqttClient');
      const mqttClient = getMqttClient();
      if (!mqttClient?.connected) return;

      // Get all vehicles with device tokens
      const vehicles = await prisma.vehicle.findMany({
        select: { id: true, deviceToken: true, organizationId: true },
      });

      for (const vehicle of vehicles) {
        const pingTopic = `artic/${vehicle.deviceToken}/ping`;
        mqttClient.publish(pingTopic, JSON.stringify({ ts: Date.now(), auto: true }), { qos: 0 });
      }

      if (vehicles.length > 0) {
        logger.debug(`Auto-pinged ${vehicles.length} device(s)`);
      }
    } catch (err) {
      logger.error('Auto-ping error', err);
    }
  }, 15_000);

  // ── Offline detection job ──────────────────────────────────────────────────
  // Every 60 seconds: mark vehicles OFFLINE if their last telemetry is > 3 minutes old
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
      const stale = await prisma.vehicle.findMany({
        where: {
          status: { in: ['ACTIVE', 'IDLE'] },
          lastLocation: { updatedAt: { lt: cutoff } },
        },
        select: { id: true, licensePlate: true, organizationId: true },
      });
      if (stale.length > 0) {
        await prisma.vehicle.updateMany({
          where: { id: { in: stale.map(v => v.id) } },
          data:  { status: 'OFFLINE' },
        });
        // Notify dashboard via Socket.IO
        const io = (await import('./websocket/socketServer')).getSocketServer();
        if (io) {
          const orgGroups = stale.reduce((acc: Record<string, string[]>, v) => {
            (acc[v.organizationId] ??= []).push(v.id);
            return acc;
          }, {});
          for (const [orgId, ids] of Object.entries(orgGroups)) {
            io.to(`org:${orgId}`).emit('vehicles:offline', { vehicleIds: ids, timestamp: new Date().toISOString() });
          }
        }
        logger.info(`Marked ${stale.length} vehicle(s) OFFLINE: ${stale.map(v => v.licensePlate).join(', ')}`);
      }
    } catch (err) {
      logger.error('Offline detection error', err);
    }
  }, 60_000);

  httpServer.listen(PORT, () => {
    logger.info(`ARTIC VMS backend running on port ${PORT}`);
    logger.info(`MQTT broker running on port ${MQTT_PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
