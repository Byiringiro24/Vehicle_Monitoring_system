/**
 * /api/v1/owner
 * Personal vehicle owner portal
 * Shows vehicles where ownerUserId = req.user.userId
 * Accessible to any authenticated user (scoped to their own vehicles)
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate as any);

// ── GET /owner/vehicles — vehicles this user owns personally ──────────────────
router.get('/vehicles', async (req: any, res, next) => {
  try {
    const userId = req.user.userId;

    const vehicles = await prisma.vehicle.findMany({
      where: { ownerUserId: userId },
      include: {
        organization:  { select: { id: true, name: true } },
        currentDriver: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        expenses: {
          where: {
            date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
          select: { amount: true },
        },
        contracts: {
          where: { status: 'ACTIVE' },
          select: { id: true, contractType: true, periodicAmount: true, totalPaid: true, totalValue: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute income / expenses / net per vehicle
    const enriched = vehicles.map((v: any) => {
      const monthlyExpenses = v.expenses.reduce((s: number, e: any) => s + e.amount, 0);
      const activeContract   = v.contracts[0] ?? null;
      const monthlyIncome    = activeContract?.periodicAmount ?? 0;
      return {
        ...v,
        monthlyIncome,
        monthlyExpenses,
        monthlyNet: monthlyIncome - monthlyExpenses,
        activeContract,
        expenses:  undefined, // strip raw expense array
        contracts: undefined,
      };
    });

    res.json(enriched);
  } catch (err) { next(err); }
});

// ── GET /owner/statements — monthly income/expense statements ─────────────────
router.get('/statements', async (req: any, res, next) => {
  try {
    const userId = req.user.userId;
    const months = parseInt((req.query.months as string) ?? '6');

    const vehicles = await prisma.vehicle.findMany({
      where: { ownerUserId: userId },
      select: { id: true, name: true, licensePlate: true },
    });

    const vehicleIds = vehicles.map((v: any) => v.id);
    if (vehicleIds.length === 0) return res.json([]);

    // Build monthly buckets going back N months
    const statements: any[] = [];
    for (let i = 0; i < months; i++) {
      const d      = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const from   = new Date(d.getFullYear(), d.getMonth(), 1);
      const to     = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label  = from.toLocaleString('default', { month: 'short', year: 'numeric' });

      const [expenses, payments] = await Promise.all([
        prisma.vehicleExpense.aggregate({
          where: { vehicleId: { in: vehicleIds }, date: { gte: from, lte: to } },
          _sum:  { amount: true },
        }),
        prisma.contractPayment.aggregate({
          where: {
            contract: { vehicleId: { in: vehicleIds } },
            paidDate: { gte: from, lte: to },
            status:   'PAID',
          },
          _sum: { amount: true },
        }),
      ]);

      const income   = payments._sum.amount ?? 0;
      const expense  = expenses._sum.amount ?? 0;
      statements.push({ month: label, from, to, income, expense, net: income - expense });
    }

    res.json({ vehicles, statements: statements.reverse() });
  } catch (err) { next(err); }
});

// ── PATCH /owner/vehicles/:id/claim — claim ownership of a vehicle ────────────
router.patch('/vehicles/:id/claim', async (req: any, res, next) => {
  try {
    const userId = req.user.userId;
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found in your organization' });
      return;
    }
    if (vehicle.ownerUserId && vehicle.ownerUserId !== userId) {
      res.status(409).json({ error: 'This vehicle already has an owner registered' });
      return;
    }
    await prisma.vehicle.update({
      where: { id: req.params.id },
      data:  { ownerUserId: userId },
    });
    res.json({ message: 'Vehicle ownership claimed successfully' });
  } catch (err) { next(err); }
});

export default router;
