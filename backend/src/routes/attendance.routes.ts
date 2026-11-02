/**
 * /api/v1/attendance
 * HR attendance tracking
 * GET  /attendance           — list records for org
 * POST /attendance           — check in
 * PATCH /attendance/:id      — update / check out
 * GET  /attendance/my        — current user's own records
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate as any);

// ── GET /attendance/my — own records ──────────────────────────────────────────
router.get('/my', async (req: any, res, next) => {
  try {
    const records = await prisma.attendance.findMany({
      where:   { userId: req.user.userId, organizationId: req.user.organizationId },
      orderBy: { date: 'desc' },
      take:    31,
    });
    res.json(records);
  } catch (err) { next(err); }
});

// ── GET /attendance — org-wide (HR/Admin only) ────────────────────────────────
router.get('/', authorize('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER') as any, async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const from  = req.query.from ? new Date(req.query.from as string) : new Date(new Date().setDate(1));
    const to    = req.query.to   ? new Date(req.query.to   as string) : new Date();
    const userId = req.query.userId as string | undefined;

    const records = await prisma.attendance.findMany({
      where: {
        organizationId: orgId,
        date: { gte: from, lte: to },
        ...(userId && { userId }),
      },
      orderBy: { date: 'desc' },
      take: 500,
    });
    res.json(records);
  } catch (err) { next(err); }
});

// ── POST /attendance — check in ───────────────────────────────────────────────
router.post('/', async (req: any, res, next) => {
  try {
    const { userId, date, checkIn, checkOut, status, notes } = req.body;
    const targetUserId = userId ?? req.user.userId;
    const orgId = req.user.organizationId;
    const recordDate = date ? new Date(date) : new Date();
    // Normalize to start of day
    recordDate.setHours(0, 0, 0, 0);

    const record = await prisma.attendance.upsert({
      where:  { userId_date: { userId: targetUserId, date: recordDate } },
      create: {
        userId: targetUserId, organizationId: orgId, date: recordDate,
        checkIn:  checkIn  ? new Date(checkIn)  : new Date(),
        checkOut: checkOut ? new Date(checkOut) : null,
        status:   status   ?? 'PRESENT',
        notes:    notes    ?? null,
      },
      update: {
        ...(checkIn  && { checkIn:  new Date(checkIn)  }),
        ...(checkOut && { checkOut: new Date(checkOut) }),
        ...(status   && { status }),
        ...(notes    && { notes }),
      },
    });
    res.status(201).json(record);
  } catch (err) { next(err); }
});

// ── PATCH /attendance/:id — update / check out ────────────────────────────────
router.patch('/:id', async (req: any, res, next) => {
  try {
    const record = await prisma.attendance.findUnique({ where: { id: req.params.id } });
    if (!record) throw new AppError(404, 'Attendance record not found');

    const updated = await prisma.attendance.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.checkOut  && { checkOut:  new Date(req.body.checkOut) }),
        ...(req.body.checkIn   && { checkIn:   new Date(req.body.checkIn) }),
        ...(req.body.status    && { status:    req.body.status }),
        ...(req.body.notes     && { notes:     req.body.notes }),
        ...(req.body.approvedBy && { approvedBy: req.body.approvedBy }),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
