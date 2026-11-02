/**
 * /api/v1/payouts
 * Owner payout approval workflow
 * POST /payouts         â€” request a payout (owner or finance)
 * GET  /payouts         â€” list payouts for this org
 * PATCH /payouts/:id/approve  â€” Finance Manager approves
 * PATCH /payouts/:id/execute  â€” Finance Manager executes (marks paid)
 * PATCH /payouts/:id/reject   â€” reject with reason
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditLog, getIp } from '../utils/audit';

const router = Router();
router.use(authenticate as any);

const FINANCE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] as const;

// â”€â”€ GET /payouts â€” list payouts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/', async (req: any, res, next) => {
  try {
    const orgId  = req.user.organizationId;
    const status = req.query.status as string | undefined;
    const payouts = await prisma.payout.findMany({
      where: { organizationId: orgId, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(payouts);
  } catch (err) { next(err); }
});

// â”€â”€ POST /payouts â€” request a payout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/', authorize(...FINANCE_ROLES) as any, async (req: any, res, next) => {
  try {
    const { ownerId, vehicleId, amount, periodFrom, periodTo, notes, method } = req.body;
    if (!ownerId || !amount || !periodFrom || !periodTo) {
      throw new AppError(400, 'ownerId, amount, periodFrom, periodTo are required');
    }
    const payout = await prisma.payout.create({
      data: {
        organizationId: req.user.organizationId,
        ownerId, vehicleId: vehicleId ?? null,
        amount:  parseFloat(String(amount)),
        currency: 'RWF',
        periodFrom: new Date(periodFrom),
        periodTo:   new Date(periodTo),
        status: 'PENDING',
        requestedBy: req.user.userId,
        notes: notes ?? null,
        method: method ?? null,
      },
    });

    await auditLog({ organizationId: req.user.organizationId, userId: req.user.userId,
      action: 'payout.request', targetType: 'payout', targetId: payout.id,
      after: { note: "`Payout RWF ${amount} requested for owner ${ownerId}`" }, ipAddress: getIp(req) });

    res.status(201).json(payout);
  } catch (err) { next(err); }
});

// â”€â”€ PATCH /payouts/:id/approve â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch('/:id/approve', authorize(...FINANCE_ROLES) as any, async (req: any, res, next) => {
  try {
    const payout = await prisma.payout.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!payout) throw new AppError(404, 'Payout not found');
    if (payout.status !== 'PENDING') throw new AppError(409, `Cannot approve â€” status is ${payout.status}`);
    if (payout.requestedBy === req.user.userId) {
      throw new AppError(403, 'You cannot approve your own payout request (separation of duties)');
    }

    const updated = await prisma.payout.update({
      where: { id: req.params.id },
      data:  { status: 'APPROVED', approvedBy: req.user.userId },
    });

    await auditLog({ organizationId: req.user.organizationId, userId: req.user.userId,
      action: 'payout.approve', targetType: 'payout', targetId: payout.id,
      after: { note: "`Payout RWF ${payout.amount} approved`" }, ipAddress: getIp(req) });

    res.json(updated);
  } catch (err) { next(err); }
});

// â”€â”€ PATCH /payouts/:id/execute â€” mark as paid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch('/:id/execute', authorize(...FINANCE_ROLES) as any, async (req: any, res, next) => {
  try {
    const { reference } = req.body;
    const payout = await prisma.payout.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!payout) throw new AppError(404, 'Payout not found');
    if (payout.status !== 'APPROVED') throw new AppError(409, 'Payout must be approved before execution');

    const updated = await prisma.payout.update({
      where: { id: req.params.id },
      data:  { status: 'EXECUTED', executedBy: req.user.userId, reference: reference ?? null },
    });

    await auditLog({ organizationId: req.user.organizationId, userId: req.user.userId,
      action: 'payout.execute', targetType: 'payout', targetId: payout.id,
      after: { note: "`Payout RWF ${payout.amount} executed (ref: ${reference ?? 'none'})`" }, ipAddress: getIp(req) });

    res.json(updated);
  } catch (err) { next(err); }
});

// â”€â”€ PATCH /payouts/:id/reject â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch('/:id/reject', authorize(...FINANCE_ROLES) as any, async (req: any, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) throw new AppError(400, 'reason is required');

    const payout = await prisma.payout.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!payout) throw new AppError(404, 'Payout not found');

    const updated = await prisma.payout.update({
      where: { id: req.params.id },
      data:  { status: 'REJECTED', rejectedBy: req.user.userId, rejectionReason: reason },
    });

    await auditLog({ organizationId: req.user.organizationId, userId: req.user.userId,
      action: 'payout.reject', targetType: 'payout', targetId: payout.id,
      after: { note: "`Payout rejected: ${reason}`" }, ipAddress: getIp(req) });

    res.json(updated);
  } catch (err) { next(err); }
});

export default router;


