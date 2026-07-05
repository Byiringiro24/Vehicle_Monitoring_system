import Aedes from 'aedes';
import net from 'net';
import { prisma } from '../config/database';
import { processTelemetry } from './telemetry.service';
import { getSocketServer } from '../websocket/socketServer';
import logger from '../utils/logger';

// ─── In-memory store for pending GPS ping responses ───────────────────────────
// Key: vehicleId, Value: resolve function from a waiting Promise
const pendingPings = new Map<string, (responded: boolean) => void>();

/** Called by a vehicle route to check if the GPS module is reachable.
 *  Publishes a ping, waits up to `timeoutMs` for a pong response. */
export async function pingGpsDevice(vehicleId: string, timeoutMs = 8000): Promise<boolean> {
  // Look up the vehicle to get its deviceToken (needed for the topic)
  const vehicle = await prisma.vehicle.findUnique({
    where:  { id: vehicleId },
    select: { deviceToken: true },
  });
  if (!vehicle) return false;

  return new Promise<boolean>((resolve) => {
    // Register the waiter
    pendingPings.set(vehicleId, resolve);

    // Publish ping to device via the broker's own publishCommand mechanism
    // We import the broker publish here; since broker is module-level, export it
    if (_broker) {
      const pingTopic = `artic/${vehicle.deviceToken}/ping`;
      _broker.publish(
        { cmd: 'publish', qos: 0, dup: false, retain: false,
          topic: pingTopic, payload: Buffer.from(JSON.stringify({ ts: Date.now() })) },
        (err: Error | null) => { if (err) logger.warn(`Ping publish error: ${err.message}`); }
      );
      logger.debug(`GPS ping sent to vehicle ${vehicleId} on topic ${pingTopic}`);
    } else {
      // No broker running — immediately resolve false
      pendingPings.delete(vehicleId);
      resolve(false);
      return;
    }

    // Timeout — if no pong arrives within timeoutMs, the GPS is offline
    setTimeout(() => {
      if (pendingPings.has(vehicleId)) {
        pendingPings.delete(vehicleId);
        resolve(false);
      }
    }, timeoutMs);
  });
}

// Module-level broker reference so pingGpsDevice can publish
let _broker: any = null;

export function initMqttBroker(port: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broker = new (Aedes as any)();
  _broker = broker;
  const server = net.createServer(broker.handle);

  // Authenticate devices by deviceToken
  broker.authenticate = async (
    client: { id: string; vehicleId?: string },
    username: Buffer | string | null,
    password: Buffer | null,
    callback: (err: Error | null, success: boolean) => void
  ) => {
    const token = (password?.toString() ?? username?.toString() ?? '').trim();
    try {
      const vehicle = await prisma.vehicle.findFirst({ where: { deviceToken: token } });
      if (vehicle) {
        client.vehicleId = vehicle.id;
        callback(null, true);
        logger.info(`GPS device authenticated: vehicle ${vehicle.id} (${vehicle.licensePlate ?? ''})`);
      } else {
        logger.warn(`GPS device auth failed — unknown token: ${token.substring(0, 8)}...`);
        callback(null, false);
      }
    } catch (err) {
      callback(err as Error, false);
    }
  };

  // Track connected GPS devices and notify dashboard
  broker.on('client', async (c: { id: string; vehicleId?: string }) => {
    logger.info(`MQTT client connected: ${c.id}`);
    if (c.vehicleId) {
      // Mark gpsDevice as online
      await prisma.gpsDevice.updateMany({
        where: { vehicleId: c.vehicleId },
        data:  { status: 'ACTIVE', lastCommunication: new Date() },
      }).catch(() => {});

      // Broadcast GPS online event to dashboard
      const io = getSocketServer();
      if (io) {
        const vehicle = await prisma.vehicle.findUnique({
          where:  { id: c.vehicleId },
          select: { organizationId: true },
        }).catch(() => null);
        if (vehicle) {
          io.to(`org:${vehicle.organizationId}`).emit('gps:online', {
            vehicleId: c.vehicleId,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  });

  broker.on('clientDisconnect', async (c: { id: string; vehicleId?: string }) => {
    logger.info(`MQTT client disconnected: ${c.id}`);
    if (c.vehicleId) {
      await prisma.gpsDevice.updateMany({
        where: { vehicleId: c.vehicleId },
        data:  { status: 'INACTIVE', lastCommunication: new Date() },
      }).catch(() => {});

      // Broadcast GPS offline event
      const io = getSocketServer();
      if (io) {
        const vehicle = await prisma.vehicle.findUnique({
          where:  { id: c.vehicleId },
          select: { organizationId: true },
        }).catch(() => null);
        if (vehicle) {
          io.to(`org:${vehicle.organizationId}`).emit('gps:offline', {
            vehicleId: c.vehicleId,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  });

  // Handle incoming messages
  broker.on('publish', async (
    packet: { topic: string; payload: Buffer },
    client: { id: string; vehicleId?: string } | null
  ) => {
    if (!client) return;
    const vehicleId = client.vehicleId;
    if (!vehicleId) return;
    const topic = packet.topic;
    if (!topic.startsWith('artic/')) return;

    try {
      // ── Telemetry ────────────────────────────────────────────────────────
      if (topic.endsWith('/telemetry')) {
        const payload = JSON.parse(packet.payload.toString());
        await processTelemetry(vehicleId, payload);
        logger.debug(`Telemetry received from vehicle ${vehicleId}`);
      }
      // ── GPS Pong (response to ping) ──────────────────────────────────────
      else if (topic.endsWith('/pong')) {
        logger.debug(`GPS pong received from vehicle ${vehicleId}`);
        const resolve = pendingPings.get(vehicleId);
        if (resolve) {
          pendingPings.delete(vehicleId);
          resolve(true);
        }
        // Update lastCommunication
        await prisma.gpsDevice.updateMany({
          where: { vehicleId },
          data:  { lastCommunication: new Date() },
        }).catch(() => {});
      }
    } catch (err) {
      logger.error('MQTT message processing error', err);
    }
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(
        `MQTT port ${port} is already in use (mosquitto may be running). ` +
        `The built-in MQTT broker will not start. ` +
        `ESP32 devices should connect to the existing broker on port ${port}.`
      );
      // Do NOT throw — let the rest of the app continue running
    } else {
      logger.error('MQTT broker error', err);
    }
  });

  server.listen(port, () => logger.info(`MQTT broker listening on port ${port}`));
}
