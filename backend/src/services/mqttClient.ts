/**
 * MQTT publisher client
 * Used by the backend to publish commands (lock/unlock) to devices.
 * Since mosquitto runs on port 1883 on this server, we connect to it as a client.
 */
import mqtt from 'mqtt';
import logger from '../utils/logger';

let client: mqtt.MqttClient | null = null;

export function initMqttClient() {
  const host = process.env.MQTT_HOST ?? 'localhost';
  const port = parseInt(process.env.MQTT_PORT ?? '1883', 10);
  const url  = `mqtt://${host}:${port}`;

  client = mqtt.connect(url, {
    clientId:        'artic-backend-publisher',
    reconnectPeriod: 5000,
    connectTimeout:  10000,
  });

  client.on('connect', () => logger.info(`MQTT client connected to ${url}`));
  client.on('error',   (err) => logger.warn(`MQTT client error: ${err.message}`));
  client.on('offline', () => logger.warn('MQTT client offline'));
}

/**
 * Publish a command to a device.
 * Topic: artic/vehicle/command
 * The ESP32 subscribes to this topic and acts on the payload.
 */
export function publishCommand(topic: string, payload: object) {
  if (!client?.connected) {
    logger.warn('MQTT client not connected — command not sent');
    return false;
  }
  const msg = JSON.stringify(payload);
  client.publish(topic, msg, { qos: 1, retain: true }, (err) => {
    if (err) logger.error(`MQTT publish error: ${err.message}`);
    else     logger.info(`MQTT command sent → ${topic}: ${msg}`);
  });
  return true;
}

export function getMqttClient() { return client; }
