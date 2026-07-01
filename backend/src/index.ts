import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { initSocketServer } from './websocket/socketServer';
import { initMqttBroker } from './services/mqttBroker';
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
