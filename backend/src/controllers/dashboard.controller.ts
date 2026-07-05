import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../config/database';

export async function getDashboardStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.organizationId;
    const today     = new Date(); today.setHours(0,0,0,0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalVehicles, activeVehicles, idleVehicles, offlineVehicles,
      totalAlerts, activeAlerts, totalFleets, totalDrivers,
    ] = await Promise.all([
      prisma.vehicle.count({ where: { organizationId: orgId } }),
      prisma.vehicle.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      prisma.vehicle.count({ where: { organizationId: orgId, status: 'IDLE' } }),
      prisma.vehicle.count({ where: { organizationId: orgId, status: 'OFFLINE' } }),
      prisma.alert.count({ where: { vehicle: { organizationId: orgId } } }),
      prisma.alert.count({ where: { vehicle: { organizationId: orgId }, status: 'ACTIVE' } }),
      prisma.fleet.count({ where: { organizationId: orgId } }),
      prisma.driver.count({ where: { organizationId: orgId } }),
    ]);

    const vehiclesByStatus = await prisma.vehicle.groupBy({
      by: ['status'], where: { organizationId: orgId }, _count: true,
    });

    const recentAlerts = await prisma.alert.findMany({
      where: { vehicle: { organizationId: orgId } },
      orderBy: { triggeredAt: 'desc' }, take: 8,
      include: { vehicle: { select: { id: true, name: true, licensePlate: true } } },
    });

    // Today's trips
    const [tripsToday, tripsRunning] = await Promise.all([
      prisma.trip.count({ where: { vehicle: { organizationId: orgId }, startTime: { gte: today }, endTime: { not: null } } }),
      prisma.trip.count({ where: { vehicle: { organizationId: orgId }, startTime: { gte: today }, endTime: null } }),
    ]);

    // Fuel summary
    const fuelToday = await prisma.fuelRecord.aggregate({
      where: { organizationId: orgId, date: { gte: today } },
      _sum: { totalCost: true, litres: true },
    });
    const fuelMonth = await prisma.fuelRecord.aggregate({
      where: { organizationId: orgId, date: { gte: monthStart } },
      _sum: { totalCost: true, litres: true },
    });

    // Maintenance
    const [maintenanceDueToday, maintenanceOverdue, maintenanceUpcoming] = await Promise.all([
      prisma.vehicle.count({
        where: { organizationId: orgId, nextServiceDate: { gte: today, lt: new Date(today.getTime() + 86400000) } },
      }),
      prisma.vehicle.count({
        where: { organizationId: orgId, nextServiceDate: { lt: today } },
      }),
      prisma.vehicle.count({
        where: { organizationId: orgId, nextServiceDate: { gte: new Date(today.getTime() + 86400000), lt: new Date(today.getTime() + 30 * 86400000) } },
      }),
    ]);

    // Financial summary (this month)
    const incomeMonth = await prisma.contractPayment.aggregate({
      where: { contract: { organizationId: orgId }, paidDate: { gte: monthStart }, status: 'PAID' },
      _sum: { amount: true },
    });
    const expensesMonth = await prisma.vehicleExpense.aggregate({
      where: { organizationId: orgId, date: { gte: monthStart } },
      _sum: { amount: true },
    });

    // Vehicle activity for last 7 days
    const sevenDaysAgo = new Date(today.getTime() - 6 * 86400000);
    const activityRaw = await prisma.telemetry.findMany({
      where: { vehicle: { organizationId: orgId }, timestamp: { gte: sevenDaysAgo }, engineOn: true },
      select: { timestamp: true, vehicleId: true },
      distinct: ['vehicleId'],
    });
    // Count unique active vehicles per day
    const activityByDay: Record<string, Set<string>> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo.getTime() + i * 86400000);
      activityByDay[d.toISOString().slice(0, 10)] = new Set();
    }
    // Simplified — just return total telemetry count per day
    const activityCounts = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE("timestamp") as day, COUNT(DISTINCT "vehicleId") as count
      FROM telemetry t
      JOIN vehicles v ON v.id = t."vehicleId"
      WHERE v."organizationId" = ${orgId}
        AND t.timestamp >= ${sevenDaysAgo}
        AND t."engineOn" = true
      GROUP BY DATE("timestamp")
      ORDER BY day
    `;

    res.json({
      totals: {
        vehicles: totalVehicles, activeVehicles, idleVehicles, offlineVehicles,
        alerts: totalAlerts, activeAlerts, fleets: totalFleets, drivers: totalDrivers,
      },
      vehiclesByStatus: Object.fromEntries(vehiclesByStatus.map(v => [v.status, v._count])),
      recentAlerts,
      trips: { today: tripsToday, running: tripsRunning },
      fuel: {
        todayCost:     fuelToday._sum.totalCost ?? 0,
        todayLitres:   fuelToday._sum.litres    ?? 0,
        monthCost:     fuelMonth._sum.totalCost ?? 0,
        monthLitres:   fuelMonth._sum.litres    ?? 0,
      },
      maintenance: { dueToday: maintenanceDueToday, overdue: maintenanceOverdue, upcoming: maintenanceUpcoming },
      financial: {
        income:   incomeMonth._sum.amount   ?? 0,
        expenses: expensesMonth._sum.amount ?? 0,
        profit:   (incomeMonth._sum.amount ?? 0) - (expensesMonth._sum.amount ?? 0),
      },
      activity: activityCounts.map(r => ({ day: String(r.day).slice(0, 10), count: Number(r.count) })),
    });
  } catch (err) { next(err); }
}
