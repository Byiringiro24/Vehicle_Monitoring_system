import { prisma } from '../config/database';
import { TelemetryData } from '../types';
import { getSocketServer } from '../websocket/socketServer';
import { checkAlertRules } from './alert.service';
import { checkGeofences } from './geofence.service';
import logger from '../utils/logger';

export async function processTelemetry(vehicleId: string, data: TelemetryData) {
  // 1. Save full telemetry record (only include known Telemetry fields)
  const record = await prisma.telemetry.create({
    data: {
      vehicleId,
      latitude:        data.latitude,
      longitude:       data.longitude,
      altitude:        data.altitude,
      heading:         data.heading,
      speed:           data.speed,
      odometer:        data.odometer,
      engineTemp:      data.engineTemp,
      rpm:             data.rpm,
      engineOn:        data.engineOn ?? false,
      fuelLevel:       data.fuelLevel,
      fuelUsed:        data.fuelUsed,
      batteryVoltage:  data.batteryVoltage,
      batteryLevelPct: (data as any).batteryLevelPct,
      ignition:        data.ignition ?? false,
    },
  });

  // Capture the PREVIOUS lastLocation BEFORE any upsert — used for jitter filtering
  let prevLocation: { latitude: number | null; longitude: number | null } | null = null;

  if (data.latitude !== undefined && data.longitude !== undefined) {
    const lat = data.latitude;
    const lon = data.longitude;

    // 2. Save GPS history point (for map path replay)
    await prisma.gpsHistory.create({
      data: {
        vehicleId,
        latitude:  lat,
        longitude: lon,
        speed:     data.speed   ?? 0,
        heading:   data.heading ?? 0,
        accuracy:  (data as any).accuracy,
        timestamp: new Date(),
      },
    });

    // 3. Read previous position BEFORE updating (for movement detection and distance calc)
    const existing = await prisma.lastLocation.findUnique({ where: { vehicleId } });
    prevLocation = existing ? { latitude: existing.latitude, longitude: existing.longitude } : null;

    let distanceDelta = 0;
    if (existing?.latitude && existing?.longitude) {
      distanceDelta = haversineKm(existing.latitude, existing.longitude, lat, lon);
    }

    const now2     = new Date();
    const todayStr = now2.toISOString().slice(0, 10);
    const lastStr  = existing?.updatedAt?.toISOString().slice(0, 10);
    const sameDay  = todayStr === lastStr;

    await prisma.lastLocation.upsert({
      where: { vehicleId },
      create: {
        vehicleId,
        latitude:  lat, longitude: lon,
        speed:     data.speed   ?? 0,
        heading:   data.heading ?? 0,
        fuelLevel: data.fuelLevel,
        engineTemp: data.engineTemp,
        engineOn:  data.engineOn ?? false,
        distanceTodayKm: distanceDelta,
        distanceMonthKm: distanceDelta,
        totalDistanceKm: distanceDelta,
      },
      update: {
        latitude:  lat, longitude: lon,
        speed:     data.speed   ?? 0,
        heading:   data.heading ?? 0,
        fuelLevel: data.fuelLevel,
        engineTemp: data.engineTemp,
        engineOn:  data.engineOn ?? false,
        distanceTodayKm: sameDay
          ? { increment: distanceDelta }
          : distanceDelta,
        distanceMonthKm: { increment: distanceDelta },
        totalDistanceKm: { increment: distanceDelta },
      },
    });

    // 4. Update vehicle status based on GPS activity
    // ACTIVE = moving (speed > 2 km/h), IDLE = stationary with GPS signal
    // NEVER set to OFFLINE from telemetry — offline is detected by absence of telemetry
    const newStatus = data.speed && data.speed > 2 ? 'ACTIVE' : 'IDLE';
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: newStatus as any } });

    // 4b. If device reported a SIM number, store it on the gpsDevice for verification
    const simNumber = (data as any).simNumber;
    if (simNumber && typeof simNumber === 'string') {
      await prisma.gpsDevice.updateMany({
        where: { vehicleId },
        data:  { simNumber: simNumber.trim() },
      }).catch(() => {}); // non-fatal
    }
  }

  // 5. Broadcast to dashboard — include location so map updates instantly
  const io = getSocketServer();
  if (io) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        organizationId: true, name: true, licensePlate: true, status: true,
        fleet: { select: { id: true, name: true, color: true } },
      },
    });
    if (vehicle) {
      const now = new Date().toISOString();

      // ── Device command responses — broadcast as a dedicated event ─────────
      // These are special payloads published by the ESP32 in response to commands.
      // They are NOT standard telemetry and are NOT stored in DB fields.
      // We detect them here before touching the DB record and emit device:response.
      const rawPayload = data as any;
      const isCommandResponse =
        rawPayload.ack ||
        rawPayload.pong ||
        (rawPayload.cmd && ['internet_status', 'ussd_response', 'restarting'].includes(rawPayload.cmd)) ||
        rawPayload.event === 'device_connected';

      if (isCommandResponse) {
        io.to(`org:${vehicle.organizationId}`).emit('device:response', {
          vehicleId,
          timestamp: now,
          payload: rawPayload,
        });
        logger.info(`[CMD-RESPONSE] Vehicle ${vehicleId}: cmd=${rawPayload.cmd ?? rawPayload.ack ?? rawPayload.event}`);
      }

      // Emit raw telemetry for charts
      io.to(`org:${vehicle.organizationId}`).emit('telemetry:update', {
        vehicleId, data: record, timestamp: now,
      });

      // Always emit a heartbeat so the frontend knows device is online
      // Include current speed so status (ACTIVE/IDLE) is always up to date
      io.to(`org:${vehicle.organizationId}`).emit('device:heartbeat', {
        vehicleId,
        updatedAt: now,
        speed:     data.speed     ?? 0,
        engineOn:  data.engineOn  ?? false,
        engineLocked:  (data as any).engineLocked  ?? false,
        gpsModuleOn:   (data as any).gpsModuleOn   ?? false,
        signalQuality: (data as any).signalQuality ?? 0,
      });

      // Emit location update for live map — always emit when we have valid GPS coords
      // The frontend handles display; filtering jitter here causes missed updates
      if (data.latitude !== undefined && data.longitude !== undefined && data.latitude && data.longitude) {
        const liveStatus = data.speed && data.speed > 2 ? 'ACTIVE' : 'IDLE';
        io.to(`org:${vehicle.organizationId}`).emit('location:update', {
          vehicleId,
          latitude:    data.latitude,
          longitude:   data.longitude,
          speed:       data.speed   ?? 0,
          heading:     data.heading ?? 0,
          fuelLevel:   data.fuelLevel,
          engineTemp:  data.engineTemp,
          engineOn:    data.engineOn ?? false,
          updatedAt:   now,
          vehicle: {
            id:           vehicleId,
            name:         vehicle.name,
            licensePlate: vehicle.licensePlate,
            status:       liveStatus,
            fleet:        vehicle.fleet,
          },
        });
      }
    }
  }

  // 6. Check alert rules and geofences in parallel
  await Promise.allSettled([
    checkAlertRules(vehicleId, data),
    data.latitude && data.longitude
      ? checkGeofences(vehicleId, data.latitude, data.longitude)
      : Promise.resolve(),
  ]);

  logger.debug(`Telemetry processed for vehicle ${vehicleId}`);
  return record;
}

export async function getVehicleTelemetry(vehicleId: string, from: Date, to: Date, limit = 1000) {
  return prisma.telemetry.findMany({
    where: { vehicleId, timestamp: { gte: from, lte: to } },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

export async function getLatestTelemetry(vehicleId: string) {
  return prisma.telemetry.findFirst({
    where: { vehicleId },
    orderBy: { timestamp: 'desc' },
  });
}

// ─── Haversine formula for distance between two GPS points ───────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function toRad(d: number) { return d * Math.PI / 180; }
