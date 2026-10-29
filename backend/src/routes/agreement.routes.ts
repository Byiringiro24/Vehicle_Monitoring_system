/**
 * /api/v1/agreements
 * Configurable vehicle agreements: daily rental, hire-purchase, lease-to-own,
 * driver daily submission, fleet management, etc.
 * Payment schedules are auto-generated on agreement activation.
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuid } from 'uuid';

const router = Router();
router.use(authenticate);

// ── Payment schedule generator ────────────────────────────────────────────────
function generateSchedule(agreement: {
  id: string; startDate: Date; endDate?: Date | null; expectedEndDate?: Date | null;
  ratePeriod: string; rateAmount: number; installmentCount?: number | null;
  totalValue?: number | null; currency: string;
}): Array<{ periodLabel: string; dueDate: Date; amountDue: number; currency: string }> {
  const payments: Array<{ periodLabel: string; dueDate: Date; amountDue: number; currency: string }> = [];
  const start   = new Date(agreement.startDate);
  const end     = agreement.endDate ? new Date(agreement.endDate)
    : agreement.expectedEndDate ? new Date(agreement.expectedEndDate) : null;

  const PERIOD_MS: Record<string, number> = {
    hourly:  60 * 60 * 1000,
    daily:   24 * 60 * 60 * 1000,
    weekly:  7  * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };

  // For installment / hire-purchase — fixed count
  if (agreement.ratePeriod === 'monthly' && agreement.installmentCount && agreement.installmentCount > 0) {
    const amount = agreement.totalValue
      ? Math.ceil(agreement.totalValue / agreement.installmentCount)
      : agreement.rateAmount;
    for (let i = 0; i < agreement.installmentCount; i++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i + 1);
      payments.push({ periodLabel: `Installment ${i + 1}`, dueDate: due, amountDue: amount, currency: agreement.currency });
    }
    return payments;
  }

  // For recurring periods with a known end date
  if (end) {
    const periodMs = PERIOD_MS[agreement.ratePeriod] ?? PERIOD_MS.daily;
    const totalMs  = end.getTime() - start.getTime();
    const count    = Math.max(1, Math.ceil(totalMs / periodMs));

    const labels: Record<string, string> = {
      hourly: 'Hour', daily: 'Day', weekly: 'Week', monthly: 'Month',
    };
    const label = labels[agreement.ratePeriod] ?? 'Period';

    for (let i = 0; i < count; i++) {
      const due = new Date(start.getTime() + (i + 1) * periodMs);
      payments.push({ periodLabel: `${label} ${i + 1}`, dueDate: due, amountDue: agreement.rateAmount, currency: agreement.currency });
    }
    return payments;
  }

  // Open-ended — generate first 30 periods
  const periodMs = PERIOD_MS[agreement.ratePeriod] ?? PERIOD_MS.daily;
  const labels: Record<string, string> = { hourly: 'Hour', daily: 'Day', weekly: 'Week', monthly: 'Month' };
  const label = labels[agreement.ratePeriod] ?? 'Period';

  for (let i = 0; i < 30; i++) {
    const due = new Date(start.getTime() + (i + 1) * periodMs);
    payments.push({ periodLabel: `${label} ${i + 1}`, dueDate: due, amountDue: agreement.rateAmount, currency: agreement.currency });
  }
  return payments;
}

// ── GET /agreements/business-models — list available models for this org ──────
router.get('/business-models', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const models = await prisma.businessModel.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }], isActive: true },
      orderBy: [{ organizationId: 'asc' }, { name: 'asc' }],
    });
    res.json(models);
  } catch (err) { next(err); }
});

// ── POST /agreements/business-models — create a custom model for this org ─────
router.post('/business-models', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const model = await prisma.businessModel.create({
      data: { ...req.body, organizationId: req.user.organizationId },
    });
    res.status(201).json(model);
  } catch (err) { next(err); }
});

// ── GET /agreements — list agreements for this org ────────────────────────────
router.get('/', async (req: any, res, next) => {
  try {
    const orgId   = req.user.organizationId;
    const status  = req.query.status as string | undefined;
    const vehicleId = req.query.vehicleId as string | undefined;
    const customerId = req.query.customerId as string | undefined;
    const page    = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
    const limit   = Math.min(100, parseInt(req.query.limit as string ?? '50', 10));
    const skip    = (page - 1) * limit;

    const where: any = { organizationId: orgId };
    if (status)     where.status     = status;
    if (vehicleId)  where.vehicleId  = vehicleId;
    if (customerId) where.customerId = customerId;

    const [agreements, total] = await Promise.all([
      prisma.agreement.findMany({
        where,
        include: {
          vehicle:  { select: { id: true, name: true, licensePlate: true } },
          customer: { select: { id: true, name: true, phone: true } },
          businessModel: { select: { name: true, modelType: true } },
          _count: { select: { scheduledPayments: true, paymentRecords: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      prisma.agreement.count({ where }),
    ]);
    res.json({ data: agreements, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ── GET /agreements/:id — get one agreement with full schedule ─────────────────
router.get('/:id', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const agreement = await prisma.agreement.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: {
        vehicle:  { select: { id: true, name: true, licensePlate: true, manufacturer: true, model: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        businessModel: true,
        scheduledPayments: { orderBy: { dueDate: 'asc' } },
        paymentRecords:    { orderBy: { paidAt: 'desc' }, take: 50 },
      },
    });
    if (!agreement) throw new AppError(404, 'Agreement not found');
    res.json(agreement);
  } catch (err) { next(err); }
});

// ── POST /agreements — create an agreement (starts as DRAFT) ──────────────────
router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const {
      vehicleId, customerId, driverId, businessModelId, title, modelType,
      currency, rateAmount, ratePeriod, depositAmount, totalValue, installmentCount,
      startDate, endDate, expectedEndDate, notes,
    } = req.body;

    if (!vehicleId || !customerId || !title || rateAmount == null || !startDate) {
      throw new AppError(400, 'vehicleId, customerId, title, rateAmount and startDate are required');
    }

    // Verify vehicle + customer belong to this org
    const [vehicle, customer] = await Promise.all([
      prisma.vehicle.findFirst({ where: { id: vehicleId, organizationId: orgId } }),
      prisma.customer.findFirst({ where: { id: customerId, organizationId: orgId } }),
    ]);
    if (!vehicle)  throw new AppError(404, 'Vehicle not found');
    if (!customer) throw new AppError(404, 'Customer not found');

    // Calculate totalBalance for fixed-value agreements
    const calculatedBalance = totalValue ?? (installmentCount ? installmentCount * rateAmount : 0);

    const agreement = await prisma.agreement.create({
      data: {
        organizationId: orgId,
        vehicleId, customerId, driverId,
        businessModelId: businessModelId || null,
        title, modelType: modelType ?? 'CUSTOM',
        currency: currency ?? 'RWF',
        rateAmount: parseFloat(rateAmount),
        ratePeriod: ratePeriod ?? 'daily',
        depositAmount: depositAmount ? parseFloat(depositAmount) : 0,
        totalValue:    totalValue    ? parseFloat(totalValue)    : null,
        installmentCount: installmentCount ? parseInt(installmentCount) : null,
        totalBalance: calculatedBalance,
        startDate:   new Date(startDate),
        endDate:     endDate          ? new Date(endDate)          : null,
        expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
        notes,
        agreementNumber: uuid(),
        status: 'DRAFT',
      },
      include: {
        vehicle:  { select: { id: true, name: true, licensePlate: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    res.status(201).json(agreement);
  } catch (err) { next(err); }
});

// ── POST /agreements/:id/activate — activate and generate payment schedule ────
router.post('/:id/activate', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const agreement = await prisma.agreement.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!agreement) throw new AppError(404, 'Agreement not found');
    if (agreement.status === 'ACTIVE') throw new AppError(409, 'Agreement is already active');

    // Generate the payment schedule
    const schedule = generateSchedule({
      id:               agreement.id,
      startDate:        agreement.startDate,
      endDate:          agreement.endDate,
      expectedEndDate:  agreement.expectedEndDate,
      ratePeriod:       agreement.ratePeriod,
      rateAmount:       agreement.rateAmount,
      installmentCount: agreement.installmentCount,
      totalValue:       agreement.totalValue,
      currency:         agreement.currency,
    });

    await prisma.$transaction([
      // Delete any existing draft schedule
      prisma.scheduledPayment.deleteMany({ where: { agreementId: agreement.id } }),
      // Create new schedule
      prisma.scheduledPayment.createMany({
        data: schedule.map(s => ({
          agreementId: agreement.id,
          periodLabel: s.periodLabel,
          dueDate:     s.dueDate,
          amountDue:   s.amountDue,
          currency:    s.currency,
        })),
      }),
      // Activate the agreement
      prisma.agreement.update({
        where: { id: agreement.id },
        data:  { status: 'ACTIVE', signedAt: new Date() },
      }),
    ]);

    const updated = await prisma.agreement.findUnique({
      where: { id: agreement.id },
      include: { scheduledPayments: { orderBy: { dueDate: 'asc' } } },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST /agreements/:id/payments — record a payment ─────────────────────────
router.post('/:id/payments', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const agreement = await prisma.agreement.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!agreement) throw new AppError(404, 'Agreement not found');

    const { amount, method, reference, notes, scheduledPaymentId, paidAt } = req.body;
    if (!amount || amount <= 0) throw new AppError(400, 'amount must be greater than 0');

    const paid = parseFloat(amount);

    await prisma.$transaction(async tx => {
      // Create the payment record
      await tx.paymentRecord.create({
        data: {
          organizationId:     orgId,
          agreementId:        agreement.id,
          scheduledPaymentId: scheduledPaymentId || null,
          amount:             paid,
          currency:           agreement.currency,
          method:             method ?? 'CASH',
          reference, notes,
          paidAt:             paidAt ? new Date(paidAt) : new Date(),
          recordedById:       req.user.userId,
        },
      });

      // If linked to a scheduled payment, update its status
      if (scheduledPaymentId) {
        const sp = await tx.scheduledPayment.findUnique({ where: { id: scheduledPaymentId } });
        if (sp) {
          const newPaid = sp.amountPaid + paid;
          await tx.scheduledPayment.update({
            where: { id: scheduledPaymentId },
            data:  {
              amountPaid: newPaid,
              status:     newPaid >= sp.amountDue ? 'PAID' : 'PARTIAL',
              paidAt:     newPaid >= sp.amountDue ? new Date() : undefined,
            },
          });
        }
      }

      // Update agreement totals
      const newTotal   = agreement.totalPaid + paid;
      const newBalance = Math.max(0, (agreement.totalValue ?? 0) - newTotal);
      await tx.agreement.update({
        where: { id: agreement.id },
        data:  { totalPaid: newTotal, totalBalance: newBalance },
      });
    });

    res.json({ message: 'Payment recorded', amount: paid });
  } catch (err) { next(err); }
});

// ── GET /agreements/:id/payments — list payment records ───────────────────────
router.get('/:id/payments', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const agreement = await prisma.agreement.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!agreement) throw new AppError(404, 'Agreement not found');

    const [schedule, records] = await Promise.all([
      prisma.scheduledPayment.findMany({ where: { agreementId: agreement.id }, orderBy: { dueDate: 'asc' } }),
      prisma.paymentRecord.findMany({ where: { agreementId: agreement.id }, orderBy: { paidAt: 'desc' } }),
    ]);

    const totalDue     = schedule.reduce((s, p) => s + p.amountDue, 0);
    const totalPaid    = records.reduce((s, r) => s + r.amount, 0);
    const overdue      = schedule.filter(p => p.status === 'OVERDUE').reduce((s, p) => s + (p.amountDue - p.amountPaid), 0);

    res.json({ schedule, records, summary: { totalDue, totalPaid, outstanding: totalDue - totalPaid, overdue } });
  } catch (err) { next(err); }
});

// ── PATCH /agreements/:id — update status or notes ────────────────────────────
router.patch('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const agreement = await prisma.agreement.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!agreement) throw new AppError(404, 'Agreement not found');

    const { status, notes, endDate, contractFileUrl } = req.body;
    const updated = await prisma.agreement.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(notes  !== undefined && { notes }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(contractFileUrl && { contractFileUrl }),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// Register in app.ts
export default router;
