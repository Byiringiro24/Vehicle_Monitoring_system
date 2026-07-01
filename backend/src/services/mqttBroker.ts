import Aedes from 'aedes';
import net from 'net';
import { prisma } from '../config/database';
import { processTelemetry } from './telemetry.service';
import logger from '../utils/logger';

export function initMqttBroker(port: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broker = new (Aedes as any)();
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
      } else {
        callback(null, false);
      }
    } catch (err) {
      callback(err as Error, false);
    }
  };

  // Handle incoming telemetry
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
      const payload = JSON.parse(packet.payload.toString());
      if (topic.endsWith('/telemetry')) {
        await processTelemetry(vehicleId, payload);
        logger.debug(`Telemetry received from vehicle ${vehicleId}`);
      }
    } catch (err) {
      logger.error('MQTT message processing error', err);
    }
  });

  broker.on('client',           (c: { id: string }) => logger.info(`MQTT client connected: ${c.id}`));
  broker.on('clientDisconnect', (c: { id: string }) => logger.info(`MQTT client disconnected: ${c.id}`));

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
