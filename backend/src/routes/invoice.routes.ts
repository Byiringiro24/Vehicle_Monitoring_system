/**
 * /api/v1/invoices
 * Simple invoice management — create, list, mark paid
 * Accessible to: SUPER_ADMIN, ADMIN, FINANCE_MANAGER
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate as any);

const INVOICE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] as const;

// Invoices are stored in the CashFlow table (existing) for simplicity,
// tagged with category = 'INVOICE'. This avoids a new DB migration.
// Each invoice is a CashFlow record with type=INCOME and extra metadata in JSON.

// ── GET /invoices — list all invoices for this org ────────────────────────────
router.get('/', async (req: any, res, next) => {
  try {
    const orgId  = req.user.organizationId;
    const limit  = Math.min(parseInt((req.query.limit as string) ?? '100'), 200);
    const status = req.query.status as string | undefined;

    // Invoices stored as CashFlow with reference starting with 'INV-'
    const flows = await prisma.cashFlow.findMany({
      where: {
        organizationId: orgId,
        reference: { startsWith: 'INV-' },
        ...(status && { method: status }),    // we reuse 'method' field for invoice status
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    const invoices = flows.map((f: any) => {
      let meta: any = {};
      try { meta = JSON.parse(f.description); } catch {}
      return {
        id:            f.id,
        invoiceNumber: f.reference,
        customerId:    meta.customerId ?? null,
        customer:      meta.customer   ?? null,
        vehicleId:     meta.vehicleId  ?? null,
        description:   meta.note       ?? f.description,
        amount:        f.amount,
        currency:      'RWF',
        dueDate:       meta.dueDate    ?? null,
        status:        f.method        ?? 'DRAFT',
        createdAt:     f.createdAt,
        balance:       f.balance,
      };
    });

    res.json({ data: invoices, total: invoices.length });
  } catch (err) { next(err); }
});

// ── POST /invoices — create a new invoice ─────────────────────────────────────
router.post('/', authorize(...INVOICE_ROLES) as any, async (req: any, res, next) => {
  try {
    const { customerId, vehicleId, description, amount, currency, dueDate } = req.body;

    if (!description || !amount) {
      throw new AppError(400, 'description and amount are required');
    }

    const orgId = req.user.organizationId;

    // Build invoice number: INV-YYYYMM-XXXX
    const now    = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
    const count  = await prisma.cashFlow.count({
      where: { organizationId: orgId, reference: { startsWith: prefix } },
    });
    const invoiceNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    // Look up customer name if ID provided
    let customerObj: any = null;
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId: orgId },
        select: { id: true, name: true, email: true, phone: true },
      });
      customerObj = customer;
    }

    // Store invoice as a CashFlow record
    const meta = JSON.stringify({
      customerId:  customerId  ?? null,
      customer:    customerObj ?? null,
      vehicleId:   vehicleId  ?? null,
      note:        description,
      dueDate:     dueDate    ?? null,
    });

    const invoice = await prisma.cashFlow.create({
      data: {
        organizationId: orgId,
        date:           now,
        description:    meta,
        amount:         parseFloat(String(amount)),
        type:           'INCOME',
        category:       'INVOICE',
        method:         'SENT',         // status: DRAFT | SENT | PAID | OVERDUE | CANCELLED
        reference:      invoiceNumber,
        balance:        parseFloat(String(amount)),
      },
    });

    res.status(201).json({
      id:            invoice.id,
      invoiceNumber,
      customerId:    customerId  ?? null,
      customer:      customerObj ?? null,
      description,
      amount:        invoice.amount,
      currency:      currency ?? 'RWF',
      dueDate:       dueDate  ?? null,
      status:        'SENT',
      createdAt:     invoice.createdAt,
    });
  } catch (err) { next(err); }
});

// ── PATCH /invoices/:id/mark-paid — mark invoice as paid ─────────────────────
router.patch('/:id/mark-paid', authorize(...INVOICE_ROLES) as any, async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;

    const flow = await prisma.cashFlow.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!flow) throw new AppError(404, 'Invoice not found');
    if (flow.method === 'PAID') throw new AppError(409, 'Invoice is already marked as paid');

    const updated = await prisma.cashFlow.update({
      where: { id: req.params.id },
      data:  { method: 'PAID', balance: 0 },
    });

    res.json({ id: updated.id, status: 'PAID', message: 'Invoice marked as paid' });
  } catch (err) { next(err); }
});

// ── DELETE /invoices/:id — cancel invoice ─────────────────────────────────────
router.delete('/:id', authorize(...INVOICE_ROLES) as any, async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const flow  = await prisma.cashFlow.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!flow) throw new AppError(404, 'Invoice not found');

    await prisma.cashFlow.update({
      where: { id: req.params.id },
      data:  { method: 'CANCELLED' },
    });
    res.json({ message: 'Invoice cancelled' });
  } catch (err) { next(err); }
});

export default router;
