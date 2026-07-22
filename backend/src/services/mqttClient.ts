/**
 * Backend MQTT client — connects to mosquitto (port 1883)
 *
 * Responsibilities:
 *  1. Subscribe to artic/+/telemetry — process all incoming GPS data
 *  2. Subscribe to artic/+/pong     — resolve GPS ping promises
 *  3. Publish lock/unlock/ping commands to devices
 *  4. Track which devices are online (seen in last 60s) and emit gps:online/offline
 */
import mqtt from 'mqtt';
import { prisma } from '../config/database';
import { processTelemetry } from './telemetry.service';
import { getSocketServer } from '../websocket/socketServer';
import logger from '../utils/logger';

let client: mqtt.MqttClient | null = null;

// Track last-seen timestamp per deviceToken
const lastSeen = new Map<string, number>();
const OFFLINE_THRESHOLD_MS = 10_000; // mark offline if no message for 10s (5× the 2s send interval)

// pong handlers — mqttBroker registers one
const pongHandlers: Array<(topic: string, msg: Buffer) => void> = [];
export function onPong(handler: (topic: string, msg: Buffer) => void) {
  pongHandlers.push(handler);
}

export function initMqttClient() {
  const host = process.env.MQTT_HOST ?? 'localhost';
  const port = parseInt(process.env.MQTT_PORT ?? '1883', 10);
  const url  = `mqtt://${host}:${port}`;

  client = mqtt.connect(url, {
    clientId:        'artic-backend-bridge',
    reconnectPeriod: 5000,
    connectTimeout:  10000,
  });

  client.on('connect', () => {
    logger.info(`MQTT client connected to ${url}`);

    // Subscribe to ALL telemetry — this is how we receive GPS from ESP32
    client!.subscribe('artic/+/telemetry', { qos: 0 }, (err) => {
      if (err) logger.warn(`Failed to subscribe to telemetry: ${err.message}`);
      else     logger.info('MQTT client subscribed to artic/+/telemetry');
    });

    // Subscribe to all pong topics
    client!.subscribe('artic/+/pong', { qos: 0 }, (err) => {
      if (err) logger.warn(`Failed to subscribe to pong: ${err.message}`);
      else     logger.info('MQTT client subscribed to artic/+/pong');
    });
  });

  client.on('message', async (topic: string, message: Buffer) => {
    // artic/<TOKEN>/telemetry
    if (topic.endsWith('/telemetry')) {
      const token = topic.split('/')[1];
      if (!token) return;

      try {
        const payload = JSON.parse(message.toString());

        // Look up vehicle by deviceToken
        const vehicle = await prisma.vehicle.findFirst({
          where:  { deviceToken: token },
          select: { id: true, organizationId: true, licensePlate: true },
        });

        if (!vehicle) {
          logger.warn(`[MQTT] Unknown device token: ${token.slice(0, 8)}...`);
          return;
        }

        // Track online status — emit gps:online on first message after being offline
        const wasOnline = lastSeen.has(token) && (Date.now() - lastSeen.get(token)!) < OFFLINE_THRESHOLD_MS;
        lastSeen.set(token, Date.now());

        if (!wasOnline) {
          // Device just came online — broadcast to dashboard
          const io = getSocketServer();
          if (io) {
            io.to(`org:${vehicle.organizationId}`).emit('gps:online', {
              vehicleId:    vehicle.id,
              licensePlate: vehicle.licensePlate,
              timestamp:    new Date().toISOString(),
            });
          }
          logger.info(`[GPS] Device ONLINE: ${vehicle.licensePlate} (${vehicle.id})`);
        }

        // ── SIM number verification ───────────────────────────────────────────
        // If the vehicle has a registered SIM number, verify it matches
        // what the device is reporting. Mismatch = possible device swap/theft.
        const reportedSim = payload.simNumber as string | undefined;
        if (reportedSim && vehicle) {
          const dbSim = (vehicle as any).simNumber;
          if (dbSim && dbSim.replace(/\s/g,'') !== reportedSim.replace(/\s/g,'')) {
            logger.warn(`[SIM MISMATCH] Vehicle ${vehicle.licensePlate}: DB="${dbSim}" Device="${reportedSim}"`);
            const io = getSocketServer();
            if (io) {
              io.to(`org:${vehicle.organizationId}`).emit('sim:mismatch', {
                vehicleId:    vehicle.id,
                licensePlate: vehicle.licensePlate,
                registered:   dbSim,
                reported:     reportedSim,
                timestamp:    new Date().toISOString(),
              });
            }
          } else if (!dbSim && reportedSim) {
            // Auto-register SIM number if none set yet
            await (prisma.vehicle as any).update({
              where: { id: vehicle.id },
              data:  { simNumber: reportedSim },
            }).catch(() => {});
            logger.info(`[SIM] Auto-registered ${reportedSim} for ${vehicle.licensePlate}`);
          }
        }

        // Process telemetry — saves to DB, updates lastLocation, emits location:update
        await processTelemetry(vehicle.id, payload);

      } catch (err) {
        logger.error(`[MQTT] Telemetry processing error on ${topic}:`, err);
      }
      return;
    }

    // artic/<TOKEN>/pong
    if (topic.endsWith('/pong')) {
      logger.debug(`[MQTT] Pong on ${topic}`);
      pongHandlers.forEach(h => h(topic, message));
      return;
    }
  });

  client.on('error',   (err) => logger.warn(`MQTT client error: ${err.message}`));
  client.on('offline', () => logger.warn('MQTT client offline'));
  client.on('reconnect', () => logger.info('MQTT client reconnecting…'));

  // ── Offline detection — check every 5s if any device has gone silent ────────
  setInterval(async () => {
    const now = Date.now();
    const io  = getSocketServer();

    for (const [token, ts] of lastSeen.entries()) {
      if (now - ts > OFFLINE_THRESHOLD_MS) {
        lastSeen.delete(token);
        try {
          const vehicle = await prisma.vehicle.findFirst({
            where:  { deviceToken: token },
            select: { id: true, organizationId: true, licensePlate: true },
          });
          if (vehicle) {
            // Update DB status
            await prisma.vehicle.update({
              where: { id: vehicle.id },
              data:  { status: 'OFFLINE' },
            }).catch(() => {});
            // Broadcast to dashboard
            if (io) {
              io.to(`org:${vehicle.organizationId}`).emit('gps:offline', {
                vehicleId:    vehicle.id,
                licensePlate: vehicle.licensePlate,
                timestamp:    new Date().toISOString(),
              });
            }
            logger.info(`[GPS] Device OFFLINE: ${vehicle.licensePlate}`);
          }
        } catch {}
      }
    }
  }, 5_000);
}

export function publishCommand(topic: string, payload: object) {
  if (!client?.connected) {
    logger.warn('MQTT client not connected — command not sent');
    return false;
  }
  const msg = JSON.stringify(payload);
  client.publish(topic, msg, { qos: 1, retain: false }, (err?: Error) => {
    if (err) logger.error(`MQTT publish error: ${err.message}`);
    else     logger.info(`MQTT command sent → ${topic}: ${msg}`);
  });
  return true;
}

export function getMqttClient() { return client; }
