import { prisma } from '../config/database';
import { TelemetryData } from '../types';
import { getSocketServer } from '../websocket/socketServer';

export async function checkAlertRules(vehicleId: string, data: TelemetryData) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId }, select: { organizationId: true },
  });
  if (!vehicle) return;

  const rules = await prisma.alertRule.findMany({
    where: { organizationId: vehicle.organizationId, isActive: true },
  });

  for (const rule of rules) {
    const cond = rule.conditions as Record<string, number>;
    let triggered = false;
    let message = '';

    switch (rule.type) {
      case 'SPEEDING':
        if (data.speed != null && cond.maxSpeed && data.speed > cond.maxSpeed) {
          triggered = true;
          message = `Vehicle speed ${data.speed} km/h exceeds limit of ${cond.maxSpeed} km/h`;
        }
        break;
      case 'LOW_FUEL':
        if (data.fuelLevel != null && cond.minFuel && data.fuelLevel < cond.minFuel) {
          triggered = true;
          message = `Fuel level ${data.fuelLevel}% is below threshold of ${cond.minFuel}%`;
        }
        break;
      case 'ENGINE_OVERHEAT':
        if (data.engineTemp != null && cond.maxTemp && data.engineTemp > cond.maxTemp) {
          triggered = true;
          message = `Engine temperature ${data.engineTemp}°C exceeds ${cond.maxTemp}°C`;
        }
        break;
      case 'BATTERY_LOW_VOLTAGE':
        if (data.batteryVoltage != null && cond.minVoltage && data.batteryVoltage < cond.minVoltage) {
          triggered = true;
          message = `Battery voltage ${data.batteryVoltage}V is below ${cond.minVoltage}V`;
        }
        break;
      case 'LOW_BATTERY':
        if ((data as any).batteryLevelPct != null && cond.minPct && (data as any).batteryLevelPct < cond.minPct) {
          triggered = true;
          message = `Battery level ${(data as any).batteryLevelPct}% is below ${cond.minPct}%`;
        }
        break;
    }

    if (triggered) {
      const alert = await prisma.alert.create({
        data: {
          vehicleId,
          type:     rule.type,
          severity: rule.severity,
          title:    rule.name,
          message,
          metadata: JSON.parse(JSON.stringify({ ruleId: rule.id })),
        },
        include: { vehicle: { select: { name: true, licensePlate: true } } },
      });

      const io = getSocketServer();
      if (io) {
        io.to(`org:${vehicle.organizationId}`).emit('alert:new', alert);
      }
    }
  }
}

export async function getAlerts(organizationId: string, filters: {
  status?: string; severity?: string; vehicleId?: string;
  from?: Date; to?: Date; page?: number; limit?: number;
}) {
  const { page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    vehicle: { organizationId },
    ...(filters.status    && { status:   filters.status }),
    ...(filters.severity  && { severity: filters.severity }),
    ...(filters.vehicleId && { vehicleId: filters.vehicleId }),
    ...((filters.from || filters.to) && {
      triggeredAt: {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to   && { lte: filters.to   }),
      },
    }),
  };

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where, skip, take: limit,
      orderBy: { triggeredAt: 'desc' },
      include: { vehicle: { select: { id: true, name: true, licensePlate: true } } },
    }),
    prisma.alert.count({ where }),
  ]);

  return { alerts, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function acknowledgeAlert(alertId: string, userId: string) {
  return prisma.alert.update({
    where: { id: alertId },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedById: userId },
  });
}

export async function resolveAlert(alertId: string) {
  return prisma.alert.update({
    where: { id: alertId },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });
}
