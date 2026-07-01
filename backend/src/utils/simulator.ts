/**
 * ARTIC VMS — Vehicle GPS Simulator
 * Simulates vehicles sending MQTT telemetry + directly inserts GPS history records.
 * Usage: npm run simulate
 */
import 'dotenv/config';
import mqtt from 'mqtt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Kigali starting coordinates + key landmarks
const ROUTES = [
  { name: 'Kigali Centre',  lat: -1.9441, lng: 30.0619 },
  { name: 'Nyabugogo',      lat: -1.9272, lng: 30.0534 },
  { name: 'Kimironko',      lat: -1.9380, lng: 30.1033 },
  { name: 'Remera',         lat: -1.9530, lng: 30.1119 },
  { name: 'Kicukiro',       lat: -2.0011, lng: 30.0667 },
  { name: 'Gikondo',        lat: -1.9724, lng: 30.0709 },
];

interface VehicleSim {
  id:         string;
  token:      string;
  name:       string;
  plate:      string;
  energyType: string;
  lat:        number;
  lng:        number;
  speed:      number;
  heading:    number;
  fuel:       number;
  batteryPct: number;
  engineTemp: number;
  odometer:   number;
  rpm:        number;
}

async function main() {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: { not: 'DECOMMISSIONED' } },
    take: 6,
    select: { id: true, deviceToken: true, name: true, licensePlate: true },
  });

  if (!vehicles.length) {
    console.error('No vehicles found. Run: npm run seed');
    process.exit(1);
  }

  const sims: VehicleSim[] = vehicles.map((v, i) => {
    const start = ROUTES[i % ROUTES.length];
    return {
      id:         v.id,
      token:      v.deviceToken,
      name:       v.name,
      plate:      v.licensePlate,
      energyType: 'PETROL', // default for simulation — could be extended
      lat:        start.lat + (Math.random() - 0.5) * 0.05,
      lng:        start.lng + (Math.random() - 0.5) * 0.05,
      speed:      10 + Math.random() * 50,
      heading:    Math.random() * 360,
      fuel:       40 + Math.random() * 55,
      batteryPct: 30 + Math.random() * 65,
      engineTemp: 75 + Math.random() * 15,
      odometer:   10000 + i * 3500 + Math.random() * 1000,
      rpm:        800 + Math.random() * 1500,
    };
  });

  const mqttHost = process.env.MQTT_HOST ?? 'localhost';
  const mqttPort = parseInt(process.env.MQTT_PORT ?? '1883', 10);

  console.log(`\n🚗 ARTIC VMS Simulator — ${sims.length} vehicles`);
  console.log(`📡 Connecting to mqtt://${mqttHost}:${mqttPort}`);
  console.log(`⏱  Sending telemetry every 5 seconds\n`);

  for (const sim of sims) {
    const client = mqtt.connect(`mqtt://${mqttHost}:${mqttPort}`, {
      username: sim.token,
      password: sim.token,
      clientId: `sim-${sim.id.slice(0, 8)}`,
    });

    client.on('connect', () => {
      const icon = sim.energyType === 'ELECTRIC' ? '⚡' : sim.energyType === 'MOTORCYCLE' ? '🏍️' : '🚛';
      console.log(`${icon}  ${sim.plate} (${sim.name}) — CONNECTED`);

      setInterval(() => {
        // Random walk with tendency to stay on roads
        sim.heading = (sim.heading + (Math.random() - 0.5) * 30 + 360) % 360;
        const rad = sim.heading * Math.PI / 180;
        sim.speed  = Math.max(0, Math.min(110, sim.speed + (Math.random() - 0.5) * 20));
        sim.lat   += Math.cos(rad) * sim.speed / 111000 / 3.6 * 5;
        sim.lng   += Math.sin(rad) * sim.speed / (111000 * Math.cos(sim.lat * Math.PI / 180)) / 3.6 * 5;

        // Clamp to Kigali area
        sim.lat = Math.max(-2.05, Math.min(-1.90, sim.lat));
        sim.lng = Math.max(30.03, Math.min(30.15, sim.lng));

        // Update telemetry values
        if (sim.energyType === 'ELECTRIC') {
          sim.batteryPct = Math.max(5, sim.batteryPct - 0.02);
        } else {
          sim.fuel    = Math.max(5, sim.fuel - (sim.speed > 0 ? 0.04 : 0.001));
        }
        sim.engineTemp = Math.max(70, Math.min(108, sim.engineTemp + (Math.random() - 0.48) * 2));
        sim.rpm        = sim.speed > 5 ? 800 + sim.speed * 28 + (Math.random() - 0.5) * 200 : 700;
        sim.odometer  += sim.speed / 3600 * 5;

        const isElectric = sim.energyType === 'ELECTRIC';

        const payload: Record<string, unknown> = {
          latitude:    parseFloat(sim.lat.toFixed(6)),
          longitude:   parseFloat(sim.lng.toFixed(6)),
          speed:       parseFloat(sim.speed.toFixed(1)),
          heading:     parseFloat(sim.heading.toFixed(1)),
          engineOn:    true,
          ignition:    true,
          odometer:    parseFloat(sim.odometer.toFixed(1)),
          rpm:         Math.round(sim.rpm),
        };

        if (isElectric) {
          payload.batteryLevelPct = parseFloat(sim.batteryPct.toFixed(1));
          payload.batteryVoltage  = 350 + sim.batteryPct * 0.5;
        } else {
          payload.fuelLevel       = parseFloat(sim.fuel.toFixed(1));
          payload.engineTemp      = parseFloat(sim.engineTemp.toFixed(1));
          payload.batteryVoltage  = 12.8 + Math.random() * 1.5;
        }

        const topic = `artic/${sim.id}/telemetry`;
        client.publish(topic, JSON.stringify(payload));

        const fuelDisplay = isElectric
          ? `🔋${payload.batteryLevelPct}%`
          : `⛽${payload.fuelLevel}%`;
        console.log(`📡 ${sim.plate}: ${Math.round(sim.speed)} km/h | ${fuelDisplay} | [${(sim.lat).toFixed(4)}, ${(sim.lng).toFixed(4)}]`);
      }, 5000);

      // Subscribe to lock commands
      client.subscribe(`artic/${sim.id}/command`, () => {});
    });

    client.on('message', (topic, msg) => {
      try {
        const cmd = JSON.parse(msg.toString());
        if (cmd.action === 'lock') {
          console.log(`🔒 LOCK COMMAND received for ${sim.plate}: ${cmd.locked ? 'LOCK' : 'UNLOCK'}`);
        }
      } catch { /* ignore */ }
    });

    client.on('error', (err) => {
      console.error(`❌ ${sim.plate}: ${err.message}`);
    });
  }

  console.log('\n✅ Simulator running — Press Ctrl+C to stop\n');
}

main().catch(console.error);
