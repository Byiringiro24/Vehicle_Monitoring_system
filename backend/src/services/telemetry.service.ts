import { prisma } from '../config/database';
import { TelemetryData } from '../types';
import { getSocketServer } from '../websocket/socketServer';
import { checkAlertRules } from './alert.service';
import logger from '../utils/logger';

export async function processTelemetry(vehicleId: string, data: TelemetryData) {
  // Save telemetry record
  const record = await prisma.telemetry.create({
    data: { vehicleId, ...data },
  });

  // Update last known location
  if (data.latitude !== undefined && data.longitude !== undefined) {
    await prisma.lastLocation.upsert({
      where: { vehicleId },
      create: {
        vehicleId,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed ?? 0,
        heading: data.heading ?? 0,
        fuelLevel: data.fuelLevel,
        engineTemp: data.engineTemp,
        engineOn: data.engineOn ?? false,
      },
      update: {
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed ?? 0,
        heading: data.heading ?? 0,
        fuelLevel: data.fuelLevel,
        engineTemp: data.engineTemp,
        engineOn: data.engineOn ?? false,
      },
    });

    // Update vehicle status
    const status = data.engineOn ? 'ACTIVE' : (data.speed && data.speed > 0 ? 'ACTIVE' : 'IDLE');
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: status as any } });
  }

  // Emit real-time update via Socket.IO
  const io = getSocketServer();
  if (io) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }, select: { organizationId: true, fleetId: true },
    });
    if (vehicle) {
      io.to(org:).emit('telemetry:update', {
        vehicleId, data: record, timestamp: new Date().toISOString(),
      });
    }
  }

  // Check alert rules
  try {
    await checkAlertRules(vehicleId, data);
  } catch (err) {
    logger.error('Alert check failed', err);
  }

  return record;
}

export async function getVehicleTelemetry(
  vehicleId: string,
  from: Date,
  to: Date,
  limit = 1000,
) {
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