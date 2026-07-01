import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { getPagination, paginatedResponse } from '../middleware/paginate';

const router = Router();
router.use(authenticate);

router.get('/', async (req: any, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { category, vehicleId, from, to } = req.query;
    const where: any = {
      organizationId: req.user.organizationId,
      ...(category  && { category }),
      ...(vehicleId && { vehicleId }),
      ...((from || to) && { date: {
        ...(from && { gte: new Date(from) }),
        ...(to   && { lte: new Date(to)   }),
      }}),
    };
    const [data, total] = await Promise.all([
      prisma.vehicleExpense.findMany({
        where, skip, take: limit,
        include: { vehicle: { select: { name: true, licensePlate: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.vehicleExpense.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) { next(err); }
});

router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER'), async (req: any, res, next) => {
  try {
    const expense = await prisma.vehicleExpense.create({
      data: {
        ...req.body,
        organizationId: req.user.organizationId,
        date: req.body.date ? new Date(req.body.date) : new Date(),
      },
      include: { vehicle: { select: { name: true, licensePlate: true } } },
    });
    res.status(201).json(expense);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'), async (req: any, res, next) => {
  try {
    const expense = await prisma.vehicleExpense.update({ where: { id: req.params.id }, data: req.body });
    res.json(expense);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'), async (req: any, res, next) => {
  try {
    await prisma.vehicleExpense.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Expense summary by category ─────────────────────────────────────────────
router.get('/summary', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
    const to   = req.query.to   ? new Date(req.query.to)   : new Date();
    const summary = await prisma.vehicleExpense.groupBy({
      by: ['category'],
      where: { organizationId: orgId, date: { gte: from, lte: to } },
      _sum: { amount: true }, _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });
    res.json({ from, to, summary });
  } catch (err) { next(err); }
});

export default router;
