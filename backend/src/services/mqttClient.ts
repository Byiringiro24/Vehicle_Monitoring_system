/**
 * Backend MQTT client
 * Connects to mosquitto (port 1883) to:
 *  1. Publish lock/unlock commands to devices
 *  2. Publish ping requests to devices
 *  3. Subscribe to pong responses to resolve GPS ping promises
 */
import mqtt from 'mqtt';
import logger from '../utils/logger';

let client: mqtt.MqttClient | null = null;

// Pending ping resolve functions: vehicleId → resolve(boolean)
const pendingPings = new Map<string, (responded: boolean) => void>();

export function registerPingWaiter(vehicleId: string, resolve: (v: boolean) => void) {
  pendingPings.set(vehicleId, resolve);
}

export function resolvePing(vehicleId: string, responded: boolean) {
  const resolve = pendingPings.get(vehicleId);
  if (resolve) {
    pendingPings.delete(vehicleId);
    resolve(responded);
  }
}

export function initMqttClient() {
  const host = process.env.MQTT_HOST ?? 'localhost';
  const port = parseInt(process.env.MQTT_PORT ?? '1883', 10);
  const url  = `mqtt://${host}:${port}`;

  client = mqtt.connect(url, {
    clientId:        'artic-backend-publisher',
    reconnectPeriod: 5000,
    connectTimeout:  10000,
  });

  client.on('connect', () => {
    logger.info(`MQTT client connected to ${url}`);
    // Subscribe to all pong topics so we receive GPS ping responses
    client!.subscribe('artic/+/pong', { qos: 0 }, (err) => {
      if (err) logger.warn(`Failed to subscribe to pong topics: ${err.message}`);
      else     logger.info('MQTT client subscribed to artic/+/pong');
    });
  });

  client.on('message', (topic: string, message: Buffer) => {
    // artic/<TOKEN>/pong — resolve any pending GPS ping
    if (topic.endsWith('/pong')) {
      // Find which vehicle this pong belongs to by matching the token
      // The pendingPings map is keyed by vehicleId — we need to look it up
      // We'll broadcast to all pending pings and let mqttBroker handle resolution
      logger.debug(`Backend MQTT client received pong on ${topic}: ${message.toString()}`);
      // Emit to the pong handler in mqttBroker
      pongHandlers.forEach((handler) => handler(topic, message));
    }
  });

  client.on('error',   (err) => logger.warn(`MQTT client error: ${err.message}`));
  client.on('offline', () => logger.warn('MQTT client offline'));
}

// Registry of pong handlers — mqttBroker registers one
const pongHandlers: Array<(topic: string, msg: Buffer) => void> = [];
export function onPong(handler: (topic: string, msg: Buffer) => void) {
  pongHandlers.push(handler);
}

export function publishCommand(topic: string, payload: object) {
  if (!client?.connected) {
    logger.warn('MQTT client not connected — command not sent');
    return false;
  }
  const msg = JSON.stringify(payload);
  client.publish(topic, msg, { qos: 1, retain: true }, (err?: Error) => {
    if (err) logger.error(`MQTT publish error: ${err.message}`);
    else     logger.info(`MQTT command sent → ${topic}: ${msg}`);
  });
  return true;
}

export function getMqttClient() { return client; }
