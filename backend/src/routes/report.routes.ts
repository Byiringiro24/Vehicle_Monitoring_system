import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

router.get('/trips', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 86400000);
    const to = req.query.to ? new Date(req.query.to) : new Date();

    const telemetry = await prisma.telemetry.groupBy({
      by: ['vehicleId'],
      where: { vehicle: { organizationId: orgId }, timestamp: { gte: from, lte: to } },
      _count: { id: true },
      _max: { odometer: true, speed: true },
      _avg: { speed: true, fuelLevel: true },
    });

    res.json({ from, to, data: telemetry });
  } catch (err) { next(err); }
});

router.get('/alerts-summary', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(req.query.to) : new Date();

    const summary = await prisma.alert.groupBy({
      by: ['type', 'severity'],
      where: { vehicle: { organizationId: orgId }, triggeredAt: { gte: from, lte: to } },
      _count: true,
    });

    res.json({ from, to, data: summary });
  } catch (err) { next(err); }
});

// ─── Daily Vehicle Payment Report (like the spreadsheet in the image) ─────────
// Returns per-vehicle daily payment amounts for a given month/year
router.get('/daily-payments', async (req: any, res, next) => {
  try {
    const orgId  = req.user.organizationId;
    const month  = parseInt(req.query.month as string ?? String(new Date().getMonth() + 1), 10);
    const year   = parseInt(req.query.year  as string ?? String(new Date().getFullYear()), 10);

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month,     1);

    // Get all vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, licensePlate: true },
      orderBy: { licensePlate: 'asc' },
    });

    // Get all payments in this month
    const payments = await prisma.contractPayment.findMany({
      where: {
        contract: { organizationId: orgId },
        paidDate: { gte: monthStart, lt: monthEnd },
        status: 'PAID',
      },
      include: {
        contract: { select: { vehicleId: true } },
      },
    });

    // Get driver daily submissions
    const driverPayments = await prisma.driverPayment.findMany({
      where: {
        driver: { organizationId: orgId },
        month, year,
      },
      include: {
        driver: {
          select: {
            currentVehicleId: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Build daily grid: { day → { vehicleId → amount } }
    const daysInMonth = new Date(year, month, 0).getDate();
    const grid: Record<string, Record<string, number>> = {};
    const comments: Record<string, string> = {};  // day → comment

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      grid[key] = {};
      // Initialize all vehicles to 0
      for (const v of vehicles) grid[key][v.id] = 0;
    }

    // Fill contract payments
    for (const p of payments) {
      if (!p.paidDate) continue;
      const d = p.paidDate.toISOString().slice(0, 10);
      if (grid[d] && p.contract.vehicleId) {
        grid[d][p.contract.vehicleId] = (grid[d][p.contract.vehicleId] ?? 0) + p.amount;
      }
    }

    // Compute totals per vehicle
    const totals: Record<string, number> = {};
    for (const v of vehicles) totals[v.id] = 0;
    for (const day of Object.values(grid)) {
      for (const [vId, amount] of Object.entries(day)) {
        totals[vId] = (totals[vId] ?? 0) + amount;
      }
    }

    res.json({
      month, year, daysInMonth,
      vehicles: vehicles.map(v => ({ id: v.id, plate: v.licensePlate, name: v.name })),
      grid,        // { "2025-10-01": { vehicleId: amount } }
      totals,      // { vehicleId: totalAmount }
      comments,    // { "2025-10-05": "weekend" }
      grandTotal: Object.values(totals).reduce((s, n) => s + n, 0),
    });
  } catch (err) { next(err); }
});

export default router;