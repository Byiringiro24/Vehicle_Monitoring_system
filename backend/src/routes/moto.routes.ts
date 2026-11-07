/**
 * /api/v1/moto
 * Motorcycle/boda-boda fleet management
 * Based on FABU.xlsx, AUTOEARN daily report, AMASEZERANO contract
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditLog, getIp } from '../utils/audit';

const router = Router();
router.use(authenticate as any);

const MOTO_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER', 'DISPATCHER'] as const;

// ═══════════════════════════════════════════════════════════════════════════
//  MOTO DRIVERS — CRUD + bike assignment + active filter
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /moto/drivers — list with optional filter ────────────────────────────
router.get('/drivers', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const { status, plate, search, active } = req.query;

    const where: any = { organizationId: orgId };
    if (status)     where.status = status;
    if (plate)      where.plateNumber = { contains: plate, mode: 'insensitive' };
    if (active === 'true')  where.status = 'ACTIVE';
    if (active === 'false') where.status = { in: ['INACTIVE', 'SUSPENDED'] };
    if (search) {
      where.OR = [
        { firstName:   { contains: search, mode: 'insensitive' } },
        { lastName:    { contains: search, mode: 'insensitive' } },
        { phone:       { contains: search } },
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { nationalId:  { contains: search } },
      ];
    }

    const drivers = await prisma.motoDriver.findMany({
      where,
      include: {
        _count: { select: { payments: true, fines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with today's payment status + debt
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const enriched = await Promise.all(drivers.map(async (d: any) => {
      const todayPayment = await prisma.dailyPayment.findFirst({
        where: { driverId: d.id, date: today },
      });
      const unpaidDays = await prisma.dailyPayment.count({
        where: { driverId: d.id, status: { in: ['PENDING', 'DEBT'] } },
      });
      return {
        ...d,
        hasBike: !!d.plateNumber,
        todayStatus: todayPayment?.status ?? 'NOT_RECORDED',
        todayPaid: todayPayment?.paidAmount ?? 0,
        unpaidDays,
        totalDebt: d.totalDebt,
        finesCount: d._count.fines,
      };
    }));

    res.json(enriched);
  } catch (err) { next(err); }
});

// ── POST /moto/drivers — create a new moto driver ───────────────────────────
router.post('/drivers', authorize(...MOTO_ROLES) as any, async (req: any, res, next) => {
  try {
    const d = req.body;
    if (!d.firstName || !d.lastName || !d.phone) {
      throw new AppError(400, 'firstName, lastName and phone are required');
    }

    const driver = await prisma.motoDriver.create({
      data: {
        organizationId: req.user.organizationId,
        firstName:      d.firstName,
        lastName:       d.lastName,
        phone:          d.phone,
        altPhone:       d.altPhone ?? null,
        nationalId:     d.nationalId ?? null,
        licenseNumber:  d.licenseNumber ?? null,
        licenseClass:   d.licenseClass ?? 'B',
        address:        d.address ?? null,
        referral1Name:  d.referral1Name ?? null,
        referral1Phone: d.referral1Phone ?? null,
        referral2Name:  d.referral2Name ?? null,
        referral2Phone: d.referral2Phone ?? null,
        plateNumber:    d.plateNumber ?? null,
        bikeModel:      d.bikeModel ?? null,
        bikeAssignedAt: d.plateNumber ? new Date() : null,
        dailyRate:      parseFloat(d.dailyRate ?? '6000'),
        weeklyRate:     parseFloat(d.weeklyRate ?? '42000'),
        paymentType:    d.paymentType ?? 'DAILY',
        paymentDeadline: d.paymentDeadline ?? '21:00',
        status:         d.status ?? 'ACTIVE',
        notes:          d.notes ?? null,
      },
    });

    auditLog({ organizationId: req.user.organizationId, userId: req.user.userId,
      action: 'moto_driver.create', targetType: 'moto_driver', targetId: driver.id,
      after: { name: `${d.firstName} ${d.lastName}`, plate: d.plateNumber }, ipAddress: getIp(req) });

    res.status(201).json(driver);
  } catch (err) { next(err); }
});

// ── PUT /moto/drivers/:id — update driver ───────────────────────────────────
router.put('/drivers/:id', authorize(...MOTO_ROLES) as any, async (req: any, res, next) => {
  try {
    const existing = await prisma.motoDriver.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw new AppError(404, 'Driver not found');

    const d = req.body;
    const updated = await prisma.motoDriver.update({
      where: { id: req.params.id },
      data: {
        ...(d.firstName      !== undefined && { firstName: d.firstName }),
        ...(d.lastName       !== undefined && { lastName: d.lastName }),
        ...(d.phone          !== undefined && { phone: d.phone }),
        ...(d.altPhone       !== undefined && { altPhone: d.altPhone }),
        ...(d.nationalId     !== undefined && { nationalId: d.nationalId }),
        ...(d.licenseNumber  !== undefined && { licenseNumber: d.licenseNumber }),
        ...(d.licenseClass   !== undefined && { licenseClass: d.licenseClass }),
        ...(d.address        !== undefined && { address: d.address }),
        ...(d.referral1Name  !== undefined && { referral1Name: d.referral1Name }),
        ...(d.referral1Phone  !== undefined && { referral1Phone: d.referral1Phone }),
        ...(d.referral2Name  !== undefined && { referral2Name: d.referral2Name }),
        ...(d.referral2Phone  !== undefined && { referral2Phone: d.referral2Phone }),
        ...(d.dailyRate       !== undefined && { dailyRate: parseFloat(d.dailyRate) }),
        ...(d.weeklyRate      !== undefined && { weeklyRate: parseFloat(d.weeklyRate) }),
        ...(d.paymentType     !== undefined && { paymentType: d.paymentType }),
        ...(d.paymentDeadline !== undefined && { paymentDeadline: d.paymentDeadline }),
        ...(d.status          !== undefined && { status: d.status }),
        ...(d.notes           !== undefined && { notes: d.notes }),
        ...(d.contractSignedAt !== undefined && { contractSignedAt: new Date(d.contractSignedAt) }),
        ...(d.contractNotes    !== undefined && { contractNotes: d.contractNotes }),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── PATCH /moto/drivers/:id/assign-bike — assign or reassign bike ──────────
router.patch('/drivers/:id/assign-bike', authorize(...MOTO_ROLES) as any, async (req: any, res, next) => {
  try {
    const { plateNumber, bikeModel } = req.body;
    const driver = await prisma.motoDriver.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!driver) throw new AppError(404, 'Driver not found');

    // If assigning a bike that's currently assigned to another driver, unassign from them
    if (plateNumber) {
      const currentHolder = await prisma.motoDriver.findFirst({
        where: { organizationId: req.user.organizationId, plateNumber, id: { not: req.params.id } },
      });
      if (currentHolder) {
        await prisma.motoDriver.update({
          where: { id: currentHolder.id },
          data:  { plateNumber: null, bikeModel: null, bikeAssignedAt: null, status: 'INACTIVE' },
        });
      }
    }

    const updated = await prisma.motoDriver.update({
      where: { id: req.params.id },
      data: {
        plateNumber:    plateNumber || null,
        bikeModel:      bikeModel ?? null,
        bikeAssignedAt: plateNumber ? new Date() : null,
        status:         plateNumber ? 'ACTIVE' : 'INACTIVE',
      },
    });

    auditLog({ organizationId: req.user.organizationId, userId: req.user.userId,
      action: 'moto_driver.assign_bike', targetType: 'moto_driver', targetId: driver.id,
      after: { plate: plateNumber, previousPlate: driver.plateNumber }, ipAddress: getIp(req) });

    res.json({ message: plateNumber
      ? `Bike ${plateNumber} assigned to ${driver.firstName} ${driver.lastName}`
      : `Bike unassigned from ${driver.firstName} ${driver.lastName}`,
      driver: updated });
  } catch (err) { next(err); }
});

// ── GET /moto/drivers/:id — single driver detail with payment history ──────
router.get('/drivers/:id', async (req: any, res, next) => {
  try {
    const driver = await prisma.motoDriver.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: {
        payments: { orderBy: { date: 'desc' }, take: 90 },
        fines:    { orderBy: { fineDate: 'desc' }, take: 50 },
      },
    });
    if (!driver) throw new AppError(404, 'Driver not found');

    // Calculate summary stats
    const allPayments = (driver as any).payments ?? [];
    const totalPaid     = allPayments.reduce((s: number, p: any) => s + p.paidAmount, 0);
    const totalExpected = allPayments.reduce((s: number, p: any) => s + p.expectedAmount, 0);
    const unpaidCount   = allPayments.filter((p: any) => p.status === 'PENDING' || p.status === 'DEBT').length;
    const totalFines    = (driver as any).fines?.reduce((s: number, f: any) => s + f.amount, 0) ?? 0;

    res.json({
      ...driver,
      summary: {
        totalPaid,
        totalExpected,
        totalDebt: (driver as any).totalDebt,
        unpaidCount,
        totalFines,
        paymentCount: allPayments.length,
      },
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  DAILY PAYMENTS — record payment, search, report
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /moto/payments — list/search daily payments ─────────────────────────
router.get('/payments', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const { date, from, to, driverId, plate, status, limit = '100' } = req.query;

    const where: any = { organizationId: orgId };
    if (date) {
      const d = new Date(date as string); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      where.date = { gte: d, lt: next };
    }
    if (from || to) {
      where.date = { ...(from && { gte: new Date(from as string) }), ...(to && { lte: new Date(to as string) }) };
    }
    if (driverId) where.driverId = driverId;
    if (plate)    where.plateNumber = { contains: plate, mode: 'insensitive' };
    if (status)   where.status = status;

    const payments = await prisma.dailyPayment.findMany({
      where,
      include: { driver: { select: { firstName: true, lastName: true, phone: true, plateNumber: true, dailyRate: true } } },
      orderBy: { date: 'desc' },
      take: Math.min(parseInt(limit as string), 500),
    });
    res.json(payments);
  } catch (err) { next(err); }
});

// ── POST /moto/payments — record a daily payment ────────────────────────────
// This is the core of the finance collection:
// - Finance enters the amount the driver paid
// - If they pay less → it's debt (difference added to totalDebt)
// - If they pay more → it covers previous debt first, then credit
// - If they don't pay → status DEBT, expected amount added to totalDebt
router.post('/payments', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'DISPATCHER') as any, async (req: any, res, next) => {
  try {
    const { driverId, date, paidAmount, paidViaPhone, paidViaCash, notes } = req.body;

    if (!driverId || !date) throw new AppError(400, 'driverId and date are required');

    const driver = await prisma.motoDriver.findFirst({
      where: { id: driverId, organizationId: req.user.organizationId },
    });
    if (!driver) throw new AppError(404, 'Driver not found');

    const paymentDate = new Date(date); paymentDate.setHours(0, 0, 0, 0);
    const expectedAmount = driver.dailyRate;
    const paid = parseFloat(paidAmount ?? '0');
    const phone = parseFloat(paidViaPhone ?? '0');
    const cash = parseFloat(paidViaCash ?? '0');
    const totalPaid = paid || (phone + cash); // use paidAmount OR phone+cash

    // Debt calculation:
    // debtBefore = driver's current totalDebt
    // If totalPaid >= expectedAmount:
    //   excess = totalPaid - expectedAmount
    //   if debtBefore > 0: debtAfter = max(0, debtBefore - excess)
    //   else: debtAfter = 0 (credit)
    // If totalPaid < expectedAmount:
    //   shortfall = expectedAmount - totalPaid
    //   debtAfter = debtBefore + shortfall
    const debtBefore = driver.totalDebt;
    let debtAfter: number;
    let status: string;
    const difference = totalPaid - expectedAmount;

    if (totalPaid === 0) {
      // Didn't pay at all
      debtAfter = debtBefore + expectedAmount;
      status = 'DEBT';
    } else if (totalPaid >= expectedAmount) {
      // Paid full or more — excess covers previous debt
      const excess = totalPaid - expectedAmount;
      debtAfter = Math.max(0, debtBefore - excess);
      status = debtAfter > 0 && excess < debtBefore ? 'PARTIAL' : 'PAID';
    } else {
      // Paid less than expected — shortfall added to debt
      const shortfall = expectedAmount - totalPaid;
      debtAfter = debtBefore + shortfall;
      status = 'DEBT';
    }

    // Find existing or create new (one per driver per day)
    const existing = await prisma.dailyPayment.findFirst({
      where: { driverId, date: paymentDate },
    });

    let payment: any;
    if (existing) {
      payment = await prisma.dailyPayment.update({
        where: { id: existing.id },
        data: {
          paidAmount: totalPaid,
          difference,
          status,
          recordedBy: req.user.userId,
          paidViaPhone: phone,
          paidViaCash: cash,
          notes: notes ?? undefined,
          debtBefore,
          debtAfter,
        },
      });
    } else {
      payment = await prisma.dailyPayment.create({
        data: {
          organizationId: req.user.organizationId,
          driverId,
          plateNumber: driver.plateNumber ?? 'UNASSIGNED',
          date: paymentDate,
          expectedAmount,
          paidAmount: totalPaid,
          difference,
          status,
          recordedBy: req.user.userId,
          paidViaPhone: phone,
          paidViaCash: cash,
          notes,
          debtBefore,
          debtAfter,
        },
      });
    }

    // Update driver's running totalDebt
    await prisma.motoDriver.update({
      where: { id: driverId },
      data: { totalDebt: debtAfter },
    });

    auditLog({ organizationId: req.user.organizationId, userId: req.user.userId,
      action: 'moto_payment.record', targetType: 'daily_payment', targetId: payment.id,
      after: { driver: `${driver.firstName} ${driver.lastName}`, plate: driver.plateNumber,
        paid: totalPaid, expected: expectedAmount, debtAfter }, ipAddress: getIp(req) });

    res.status(201).json({
      ...payment,
      driverName: `${driver.firstName} ${driver.lastName}`,
      plateNumber: driver.plateNumber,
      debtAfter,
      message: totalPaid >= expectedAmount
        ? `Paid RWF ${totalPaid.toLocaleString()} — ${debtAfter > 0 ? `remaining debt: RWF ${debtAfter.toLocaleString()}` : 'fully settled'}`
        : `Paid RWF ${totalPaid.toLocaleString()} of RWF ${expectedAmount.toLocaleString()} — debt increased to RWF ${debtAfter.toLocaleString()}`,
    });
  } catch (err) { next(err); }
});

// ── GET /moto/payments/today — today's collection summary ───────────────────
router.get('/payments/today', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    const [payments, activeDrivers] = await Promise.all([
      prisma.dailyPayment.findMany({
        where: { organizationId: orgId, date: { gte: today, lt: tomorrow } },
        include: { driver: { select: { firstName: true, lastName: true, plateNumber: true } } },
      }),
      prisma.motoDriver.count({ where: { organizationId: orgId, status: 'ACTIVE', plateNumber: { not: null } } }),
    ]);

    const totalCollected = payments.reduce((s, p) => s + p.paidAmount, 0);
    const totalExpected   = payments.reduce((s, p) => s + p.expectedAmount, 0);
    const paidCount       = payments.filter(p => p.status === 'PAID').length;
    const debtCount       = payments.filter(p => p.status === 'DEBT' || p.status === 'PARTIAL').length;
    const notRecorded     = activeDrivers - payments.length;

    res.json({
      date: today,
      totalCollected,
      totalExpected,
      totalDebt: totalExpected - totalCollected,
      paidCount,
      debtCount,
      notRecorded,
      activeDrivers,
      payments,
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  GARAGE EXPENSES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/garage', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const { from, to, plate, limit = '100' } = req.query;
    const where: any = { organizationId: orgId };
    if (from || to) where.date = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
    if (plate) where.plateNumber = { contains: plate, mode: 'insensitive' };

    const expenses = await prisma.garageExpense.findMany({
      where, orderBy: { date: 'desc' }, take: Math.min(parseInt(limit), 500),
    });
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    res.json({ data: expenses, total });
  } catch (err) { next(err); }
});

router.post('/garage', authorize(...MOTO_ROLES) as any, async (req: any, res, next) => {
  try {
    const { date, plateNumber, product, amount, category, notes } = req.body;
    if (!product || !amount) throw new AppError(400, 'product and amount are required');

    const expense = await prisma.garageExpense.create({
      data: {
        organizationId: req.user.organizationId,
        date: date ? new Date(date) : new Date(),
        plateNumber: plateNumber ?? null,
        product,
        amount: parseFloat(amount),
        category: category ?? 'MAINTENANCE',
        recordedBy: req.user.userId,
        notes,
      },
    });
    res.status(201).json(expense);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  FINES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/fines', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const { plate, driverId, from, to } = req.query;
    const where: any = { organizationId: orgId };
    if (plate) where.plateNumber = { contains: plate, mode: 'insensitive' };
    if (driverId) where.driverId = driverId;
    if (from || to) where.fineDate = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };

    const fines = await prisma.motoFine.findMany({
      where, orderBy: { fineDate: 'desc' }, take: 200,
      include: { driver: { select: { firstName: true, lastName: true } } },
    });
    res.json(fines);
  } catch (err) { next(err); }
});

router.post('/fines', authorize(...MOTO_ROLES) as any, async (req: any, res, next) => {
  try {
    const { driverId, plateNumber, fineDate, reason, amount, paidByCompany, notes } = req.body;
    if (!plateNumber || !reason || !amount) throw new AppError(400, 'plateNumber, reason and amount are required');

    const fine = await prisma.motoFine.create({
      data: {
        organizationId: req.user.organizationId,
        driverId:       driverId ?? null,
        plateNumber,
        fineDate:       fineDate ? new Date(fineDate) : new Date(),
        reason,
        amount:         parseFloat(amount),
        paidByCompany:  paidByCompany ?? false,
        notes,
      },
    });
    res.status(201).json(fine);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  REPORTS — daily/weekly/monthly by driver or plate
// ═══════════════════════════════════════════════════════════════════════════

router.get('/reports/summary', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const { from, to, driverId, plate } = req.query;

    const startDate = from ? new Date(from as string) : new Date(new Date().setDate(1));
    const endDate   = to ? new Date(to as string) : new Date();

    const where: any = { organizationId: orgId, date: { gte: startDate, lte: endDate } };
    if (driverId) where.driverId = driverId;
    if (plate)    where.plateNumber = { contains: plate, mode: 'insensitive' };

    const [payments, fines, garage] = await Promise.all([
      prisma.dailyPayment.findMany({ where, orderBy: { date: 'asc' } }),
      prisma.motoFine.findMany({
        where: { organizationId: orgId, fineDate: { gte: startDate, lte: endDate },
          ...(plate && { plateNumber: { contains: plate, mode: 'insensitive' } }) },
      }),
      prisma.garageExpense.findMany({
        where: { organizationId: orgId, date: { gte: startDate, lte: endDate },
          ...(plate && { plateNumber: { contains: plate, mode: 'insensitive' } }) },
      }),
    ]);

    const totalCollected = payments.reduce((s, p) => s + p.paidAmount, 0);
    const totalExpected   = payments.reduce((s, p) => s + p.expectedAmount, 0);
    const totalFines      = fines.reduce((s, f) => s + f.amount, 0);
    const totalGarage     = garage.reduce((s, g) => s + g.amount, 0);

    // Group by day for daily view
    const byDay: Record<string, { collected: number; expected: number; debt: number }> = {};
    payments.forEach(p => {
      const day = p.date.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { collected: 0, expected: 0, debt: 0 };
      byDay[day].collected += p.paidAmount;
      byDay[day].expected  += p.expectedAmount;
      byDay[day].debt      += Math.max(0, p.expectedAmount - p.paidAmount);
    });

    res.json({
      period: { from: startDate, to: endDate },
      totals: {
        totalCollected,
        totalExpected,
        totalDebt: totalExpected - totalCollected,
        totalFines,
        totalGarage,
        net: totalCollected - totalGarage - totalFines,
        paymentCount: payments.length,
        daysCovered: Object.keys(byDay).length,
      },
      byDay: Object.entries(byDay).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
      fines,
      garage,
    });
  } catch (err) { next(err); }
});

export default router;
