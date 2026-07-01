import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../config/database';

export async function getDashboardStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId;
    const [totalVehicles, activeVehicles, totalAlerts, activeAlerts, totalFleets] = await Promise.all([
      prisma.vehicle.count({ where: { organizationId: orgId } }),
      prisma.vehicle.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      prisma.alert.count({ where: { vehicle: { organizationId: orgId } } }),
      prisma.alert.count({ where: { vehicle: { organizationId: orgId }, status: 'ACTIVE' } }),
      prisma.fleet.count({ where: { organizationId: orgId } }),
    ]);

    const vehiclesByStatus = await prisma.vehicle.groupBy({
      by: ['status'], where: { organizationId: orgId }, _count: true,
    });

    const alertsBySeverity = await prisma.alert.groupBy({
      by: ['severity'], where: { vehicle: { organizationId: orgId }, status: 'ACTIVE' }, _count: true,
    });

    const recentAlerts = await prisma.alert.findMany({
      where: { vehicle: { organizationId: orgId } },
      orderBy: { triggeredAt: 'desc' }, take: 5,
      include: { vehicle: { select: { name: true, licensePlate: true } } },
    });

    res.json({
      totals: { vehicles: totalVehicles, activeVehicles, alerts: totalAlerts, activeAlerts, fleets: totalFleets },
      vehiclesByStatus: Object.fromEntries(vehiclesByStatus.map(v => [v.status, v._count])),
      alertsBySeverity: Object.fromEntries(alertsBySeverity.map(a => [a.severity, a._count])),
      recentAlerts,
    });
  } catch (err) { next(err); }
}