import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { getPagination, paginatedResponse } from '../middleware/paginate';

const router = Router();
router.use(authenticate);

// ─── Customers ────────────────────────────────────────────────────────────────
router.get('/customers', async (req: any, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const search = req.query.search as string | undefined;
    const where: any = {
      organizationId: req.user.organizationId,
      ...(search && { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]}),
    };
    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where, skip, take: limit,
        include: { _count: { select: { contracts: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.customer.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) { next(err); }
});

router.post('/customers', async (req: any, res, next) => {
  try {
    const customer = await prisma.customer.create({
      data: { ...req.body, organizationId: req.user.organizationId },
    });
    res.status(201).json(customer);
  } catch (err) { next(err); }
});

router.put('/customers/:id', async (req: any, res, next) => {
  try {
    const c = await prisma.customer.update({ where: { id: req.params.id }, data: req.body });
    res.json(c);
  } catch (err) { next(err); }
});

// ─── Contracts ────────────────────────────────────────────────────────────────
router.get('/contracts', async (req: any, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { status, type, vehicleId, customerId } = req.query;
    const where: any = {
      organizationId: req.user.organizationId,
      ...(status     && { status }),
      ...(type       && { contractType: type }),
      ...(vehicleId  && { vehicleId }),
      ...(customerId && { customerId }),
    };
    const [data, total] = await Promise.all([
      prisma.vehicleContract.findMany({
        where, skip, take: limit,
        include: {
          vehicle:  { select: { id: true, name: true, licensePlate: true } },
          customer: { select: { id: true, name: true, phone: true } },
          driver:   { include: { user: { select: { firstName: true, lastName: true } } } },
          _count:   { select: { payments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicleContract.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) { next(err); }
});

router.get('/contracts/:id', async (req: any, res, next) => {
  try {
    const contract = await prisma.vehicleContract.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: {
        vehicle:  { select: { id: true, name: true, licensePlate: true, vehicleType: true } },
        customer: true,
        driver:   { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        payments: { orderBy: { dueDate: 'asc' } },
      },
    });
    if (!contract) { res.status(404).json({ error: 'Contract not found' }); return; }
    res.json(contract);
  } catch (err) { next(err); }
});

router.post('/contracts', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER'), async (req: any, res, next) => {
  try {
    const { totalValue, depositAmount = 0, periodicAmount, startDate, endDate, ...rest } = req.body;
    const contract = await prisma.vehicleContract.create({
      data: {
        ...rest,
        organizationId: req.user.organizationId,
        totalValue,
        depositAmount,
        periodicAmount,
        totalBalance: totalValue - depositAmount,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
      },
      include: {
        vehicle:  { select: { name: true, licensePlate: true } },
        customer: { select: { name: true } },
      },
    });
    res.status(201).json(contract);
  } catch (err) { next(err); }
});

router.put('/contracts/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'), async (req: any, res, next) => {
  try {
    const contract = await prisma.vehicleContract.update({
      where: { id: req.params.id }, data: req.body,
    });
    res.json(contract);
  } catch (err) { next(err); }
});

// ─── Contract Payments ────────────────────────────────────────────────────────
router.get('/contracts/:id/payments', async (req: any, res, next) => {
  try {
    const payments = await prisma.contractPayment.findMany({
      where: { contractId: req.params.id },
      orderBy: { dueDate: 'asc' },
    });
    res.json(payments);
  } catch (err) { next(err); }
});

router.post('/contracts/:id/payments', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'), async (req: any, res, next) => {
  try {
    const contract = await prisma.vehicleContract.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!contract) { res.status(404).json({ error: 'Contract not found' }); return; }
    const payment = await prisma.contractPayment.create({
      data: {
        contractId: req.params.id,
        customerId: contract.customerId,
        ...req.body,
        dueDate: new Date(req.body.dueDate),
        paidDate: req.body.paidDate ? new Date(req.body.paidDate) : null,
      },
    });
    // Update contract totals
    if (payment.status === 'PAID') {
      await prisma.vehicleContract.update({
        where: { id: req.params.id },
        data: {
          totalPaid:    { increment: payment.amount },
          totalBalance: { decrement: payment.amount },
        },
      });
    }
    res.status(201).json(payment);
  } catch (err) { next(err); }
});

router.patch('/payments/:id/mark-paid', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'), async (req: any, res, next) => {
  try {
    const { amount, method, reference } = req.body;
    const payment = await prisma.contractPayment.update({
      where: { id: req.params.id },
      data: { status: 'PAID', paidDate: new Date(), method, reference,
               ...(amount && { amount: parseFloat(amount) }) },
    });
    await prisma.vehicleContract.update({
      where: { id: payment.contractId },
      data: { totalPaid: { increment: payment.amount }, totalBalance: { decrement: payment.amount } },
    });
    res.json(payment);
  } catch (err) { next(err); }
});

export default router;
