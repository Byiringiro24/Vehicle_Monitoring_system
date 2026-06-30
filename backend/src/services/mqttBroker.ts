import aedes from 'aedes';
import net from 'net';
import { prisma } from '../config/database';
import { processTelemetry } from './telemetry.service';
import logger from '../utils/logger';

export function initMqttBroker(port: number) {
  const broker = aedes();
  const server = net.createServer(broker.handle as any);

  // Authenticate devices by token
  broker.authenticate = async (client, username, password, callback) => {
    const token = password?.toString() ?? username?.toString() ?? '';
    try {
      const vehicle = await prisma.vehicle.findFirst({ where: { deviceToken: token } });
      if (vehicle) {
        (client as any).vehicleId = vehicle.id;
        callback(null, true);
      } else {
        callback(null, false);
      }
    } catch (err) {
      callback(err as Error, false);
    }
  };

  // Handle incoming telemetry messages
  broker.on('publish', async (packet, client) => {
    if (!client) return;
    const vehicleId = (client as any).vehicleId as string;
    if (!vehicleId) return;

    const topic = packet.topic;
    if (!topic.startsWith('artic/')) return;

    try {
      const payload = JSON.parse(packet.payload.toString());
      if (topic.endsWith('/telemetry')) {
        await processTelemetry(vehicleId, payload);
        logger.debug(Telemetry received from vehicle );
      }
    } catch (err) {
      logger.error('MQTT message processing error', err);
    }
  });

  broker.on('client', (client) => logger.info(MQTT client connected: ));
  broker.on('clientDisconnect', (client) => logger.info(MQTT client disconnected: ));

  server.listen(port, () => logger.info(MQTT broker listening on port ));
}