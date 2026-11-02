/**
 * /api/v1/remittances
 * Rider daily remittance tracking
 * GET  /remittances        — list remittance records for this user/org
 * POST /remittances        — record a daily payment
 * GET  /remittances/today  — today's status for the authenticated driver
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate as any);

// ── GET /remittances/today ────────────────────────────────────────────────────
router.get('/today', async (req: any, res, next) => {
  try {
    const userId = req.user.userId;
    const today  = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    // Get driver profile
    const driver = await prisma.driver.findFirst({
      where: { userId },
      include: {
        contracts: {
          where: { status: 'ACTIVE' },
          select: { id: true, periodicAmount: true, contractType: true },
          take: 1,
        },
      },
    });

    if (!driver) { res.json({ hasProfile: false }); return; }

    const obligation = driver.contracts[0]?.periodicAmount ?? 0;

    // Sum payments recorded today (via DriverPayment or CashFlow)
    const todayPayments = await prisma.cashFlow.aggregate({
      where: {
        organizationId: req.user.organizationId,
        reference: `REMIT-${driver.id}`,
        date: { gte: today, lt: tomorrow },
        type: 'INCOME',
      },
      _sum: { amount: true },
    });

    const paidToday = todayPayments._sum.amount ?? 0;

    res.json({
      hasProfile:  true,
      driverId:    driver.id,
      obligation,
      paidToday,
      remaining:   Math.max(0, obligation - paidToday),
      isSettled:   paidToday >= obligation,
    });
  } catch (err) { next(err); }
});

// ── GET /remittances — history ────────────────────────────────────────────────
router.get('/', async (req: any, res, next) => {
  try {
    const userId  = req.user.userId;
    const orgId   = req.user.organizationId;
    const months  = parseInt((req.query.months as string) ?? '3');
    const from    = new Date(); from.setMonth(from.getMonth() - months);

    const driver = await prisma.driver.findFirst({ where: { userId } });
    if (!driver) { res.json([]); return; }

    const records = await prisma.cashFlow.findMany({
      where: {
        organizationId: orgId,
        reference: `REMIT-${driver.id}`,
        date: { gte: from },
        type: 'INCOME',
      },
      orderBy: { date: 'desc' },
      take: 90,
    });

    res.json(records);
  } catch (err) { next(err); }
});

// ── POST /remittances — record a daily payment ────────────────────────────────
router.post('/', async (req: any, res, next) => {
  try {
    const userId = req.user.userId;
    const orgId  = req.user.organizationId;
    const { amount, method, notes } = req.body;

    if (!amount || isNaN(parseFloat(String(amount)))) {
      throw new AppError(400, 'amount is required');
    }

    const driver = await prisma.driver.findFirst({ where: { userId } });
    if (!driver) throw new AppError(404, 'Driver profile not found for this user');

    const record = await prisma.cashFlow.create({
      data: {
        organizationId: orgId,
        date:        new Date(),
        description: `Daily remittance — driver ${driver.id}`,
        amount:      parseFloat(String(amount)),
        type:        'INCOME',
        category:    'REMITTANCE',
        method:      method ?? 'CASH',
        reference:   `REMIT-${driver.id}`,
        balance:     0,
      },
    });

    res.status(201).json({
      id:      record.id,
      amount:  record.amount,
      date:    record.date,
      method:  record.method,
      message: `RWF ${parseFloat(String(amount)).toLocaleString()} recorded`,
    });
  } catch (err) { next(err); }
});

export default router;
