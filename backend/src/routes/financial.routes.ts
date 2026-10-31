import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

// ─── Requisitions ─────────────────────────────────────────────────────────────
router.get('/requisitions', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const where: Record<string, any> = { organizationId: orgId };
    if (req.query.status) where.status = req.query.status;

    const requisitions = await prisma.requisition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.json({ data: requisitions });
  } catch (err) { next(err); }
});

router.post('/requisitions', async (req: any, res, next) => {
  try {
    const { type, amount, neededBy, reason, paymentPreference, vehicleId, tripReference, workOrderRef, agreementRef, notes } = req.body;

    if (!type || !reason || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Type, amount and reason are required' });
    }

    const requisition = await prisma.requisition.create({
      data: {
        organizationId: req.user.organizationId,
        requesterId: req.user.id,
        type,
        amount: Number(amount),
        neededBy: neededBy ? new Date(neededBy) : null,
        reason: String(reason).trim(),
        paymentPreference: paymentPreference ?? 'MOBILE_MONEY',
        vehicleId: vehicleId || null,
        tripReference: tripReference || null,
        workOrderRef: workOrderRef || null,
        agreementRef: agreementRef || null,
        notes: notes || null,
        status: 'SUBMITTED',
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });

    res.status(201).json(requisition);
  } catch (err) { next(err); }
});

router.patch('/requisitions/:id/approve', authorize('FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'), async (req: any, res, next) => {
  try {
    const { notes } = req.body;
    const requisition = await prisma.requisition.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        notes: notes ?? undefined,
        approvedById: req.user.id,
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.json(requisition);
  } catch (err) { next(err); }
});

router.patch('/requisitions/:id/reject', authorize('FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'), async (req: any, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'A rejection reason is required' });
    }

    const requisition = await prisma.requisition.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        rejectedReason: String(reason).trim(),
        approvedById: req.user.id,
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.json(requisition);
  } catch (err) { next(err); }
});

// ─── Payroll Runs ─────────────────────────────────────────────────────────────
router.get('/payroll', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const month = Number(req.query.month ?? new Date().getMonth() + 1);
    const year = Number(req.query.year ?? new Date().getFullYear());

    const rows = await prisma.driverPayment.findMany({
      where: {
        driver: { organizationId: orgId },
        month,
        year,
      },
      include: {
        driver: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            currentVehicle: { select: { id: true, name: true, licensePlate: true } },
          },
        },
      },
      orderBy: [{ totalAmount: 'desc' }],
    });

    const data = rows.map((row: any) => ({
      id: row.id,
      driverId: row.driverId,
      driverName: `${row.driver.user.firstName ?? ''} ${row.driver.user.lastName ?? ''}`.trim() || 'Unknown driver',
      email: row.driver.user.email,
      phone: row.driver.user.phone,
      vehicle: row.driver.currentVehicle ? `${row.driver.currentVehicle.name} (${row.driver.currentVehicle.licensePlate})` : 'Unassigned',
      gross: (row.baseSalary ?? 0) + (row.commission ?? 0) + (row.bonus ?? 0),
      deductions: row.deductions ?? 0,
      net: row.totalAmount ?? 0,
      paid: row.paidAmount ?? 0,
      status: row.status,
      month: row.month,
      year: row.year,
    }));

    const totalGross = data.reduce((sum, row) => sum + row.gross, 0);
    const totalNet = data.reduce((sum, row) => sum + row.net, 0);

    res.json({ month, year, data, totalGross, totalNet, count: data.length });
  } catch (err) { next(err); }
});

router.post('/payroll/generate', authorize('FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'), async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const month = Number(req.body.month ?? new Date().getMonth() + 1);
    const year = Number(req.body.year ?? new Date().getFullYear());

    const drivers = await prisma.driver.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    const rows = await Promise.all(drivers.map(async (driver: any) => {
      const payment = await prisma.driverPayment.upsert({
        where: { driverId_month_year: { driverId: driver.id, month, year } },
        create: {
          driverId: driver.id,
          month,
          year,
          baseSalary: driver.baseSalary ?? 0,
          expectedAmount: driver.baseSalary ?? 0,
          paidAmount: 0,
          difference: 0,
          totalAmount: driver.baseSalary ?? 0,
          status: 'PENDING',
        },
        update: {
          baseSalary: driver.baseSalary ?? 0,
          expectedAmount: driver.baseSalary ?? 0,
          totalAmount: driver.baseSalary ?? 0,
        },
      });
      return payment;
    }));

    res.status(201).json({ month, year, generated: rows.length, data: rows });
  } catch (err) { next(err); }
});

// ─── Owner Payouts ────────────────────────────────────────────────────────────
router.get('/owner-payouts', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: orgId, ownerUserId: { not: null } },
      select: { id: true, name: true, licensePlate: true, ownerUserId: true },
    });

    const payoutRows: any[] = [];
    for (const vehicle of vehicles) {
      if (!vehicle.ownerUserId) continue;

      const [incomeAgg, expenseAgg, owner] = await Promise.all([
        prisma.contractPayment.aggregate({
          where: { contract: { vehicleId: vehicle.id }, status: 'PAID' },
          _sum: { amount: true },
        }),
        prisma.vehicleExpense.aggregate({
          where: { vehicleId: vehicle.id },
          _sum: { amount: true },
        }),
        prisma.user.findUnique({
          where: { id: vehicle.ownerUserId! },
          select: { id: true, firstName: true, lastName: true, email: true },
        }),
      ]);

      const income = incomeAgg._sum.amount ?? 0;
      const expenses = expenseAgg._sum.amount ?? 0;
      const net = income - expenses;

      if (!owner || net <= 0) continue;

      const existing = payoutRows.find((row) => row.ownerId === owner.id);
      if (existing) {
        existing.grossIncome += income;
        existing.totalExpenses += expenses;
        existing.netPayout += net;
        existing.vehicleCount += 1;
        existing.vehicles.push({ id: vehicle.id, name: vehicle.name, licensePlate: vehicle.licensePlate, net });
      } else {
        payoutRows.push({
          ownerId: owner.id,
          ownerName: `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() || owner.email || 'Owner',
          email: owner.email,
          vehicleCount: 1,
          grossIncome: income,
          totalExpenses: expenses,
          netPayout: net,
          vehicles: [{ id: vehicle.id, name: vehicle.name, licensePlate: vehicle.licensePlate, net }],
        });
      }
    }

    res.json({ data: payoutRows, totalPayout: payoutRows.reduce((sum, row) => sum + row.netPayout, 0) });
  } catch (err) { next(err); }
});

router.post('/owner-payouts/execute', authorize('FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'), async (req: any, res, next) => {
  try {
    const { ownerId, amount, notes } = req.body;
    const orgId = req.user.organizationId;

    if (!ownerId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Owner and amount are required' });
    }

    const owner = await prisma.user.findFirst({
      where: { id: ownerId, organizationId: orgId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!owner) {
      return res.status(404).json({ error: 'Owner not found in your organization' });
    }

    const requisition = await prisma.requisition.create({
      data: {
        organizationId: orgId,
        requesterId: req.user.id,
        type: 'OWNER_PAYOUT',
        status: 'APPROVED',
        amount: Number(amount),
        reason: notes ? String(notes).trim() : `Approved owner payout for ${owner.firstName ?? 'Owner'} ${owner.lastName ?? ''}`.trim(),
        paymentPreference: 'BANK_TRANSFER',
        approvedById: req.user.id,
        notes: notes ? String(notes).trim() : null,
      },
    });

    res.status(201).json({ requisition, message: 'Owner payout executed and recorded' });
  } catch (err) { next(err); }
});

// ─── Finance Dashboard Summary ────────────────────────────────────────────────
router.get('/dashboard', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const now  = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const in30Days   = new Date(Date.now() + 30 * 86400000);
    const in15Days   = new Date(Date.now() + 15 * 86400000);

    const [
      todayIncome, todayExpenses,
      monthIncome, monthExpenses,
      activeContracts,
      overduePayments, dueTodayPayments,
      insuranceExpiring, roadTaxExpiring, inspectionExpiring,
      maintenanceCost, fuelCost, finesCost,
      vehicles,
    ] = await Promise.all([
      // Today income = payments received today
      prisma.contractPayment.aggregate({
        where: { contract: { organizationId: orgId }, status: 'PAID', paidDate: { gte: todayStart } },
        _sum: { amount: true },
      }),
      // Today expenses
      prisma.vehicleExpense.aggregate({
        where: { organizationId: orgId, date: { gte: todayStart } },
        _sum: { amount: true },
      }),
      // Month income
      prisma.contractPayment.aggregate({
        where: { contract: { organizationId: orgId }, status: 'PAID', paidDate: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // Month expenses
      prisma.vehicleExpense.aggregate({
        where: { organizationId: orgId, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // Active contracts by type
      prisma.vehicleContract.groupBy({
        by: ['contractType'],
        where: { organizationId: orgId, status: 'ACTIVE' },
        _count: true,
      }),
      // Overdue payments
      prisma.contractPayment.count({
        where: { contract: { organizationId: orgId }, status: 'OVERDUE' },
      }),
      // Due today
      prisma.contractPayment.count({
        where: { contract: { organizationId: orgId }, status: 'PENDING',
          dueDate: { gte: todayStart, lte: new Date(todayStart.getTime() + 86400000) } },
      }),
      // Insurance expiring in 30 days
      prisma.vehicle.count({
        where: { organizationId: orgId, insuranceExpiry: { gte: now, lte: in30Days } },
      }),
      // Road tax expiring in 30 days
      prisma.vehicle.count({
        where: { organizationId: orgId, roadTaxExpiry: { gte: now, lte: in30Days } },
      }),
      // Inspection expiring in 30 days
      prisma.vehicle.count({
        where: { organizationId: orgId, inspectionExpiry: { gte: now, lte: in15Days } },
      }),
      // Maintenance this month
      prisma.vehicleExpense.aggregate({
        where: { organizationId: orgId, category: 'MAINTENANCE', date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // Fuel this month
      prisma.vehicleExpense.aggregate({
        where: { organizationId: orgId, category: 'FUEL', date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // Fines this month
      prisma.vehicleExpense.aggregate({
        where: { organizationId: orgId, category: 'FINE', date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // Vehicle values for net business value
      prisma.vehicle.findMany({
        where: { organizationId: orgId },
        select: { currentValue: true, purchasePrice: true },
      }),
    ]);

    // Outstanding balance (total unpaid)
    const outstandingBalance = await prisma.contractPayment.aggregate({
      where: { contract: { organizationId: orgId }, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
      _sum: { amount: true },
    });

    // Top paying customers (this month)
    const topCustomers = await prisma.contractPayment.groupBy({
      by: ['customerId'],
      where: { contract: { organizationId: orgId }, status: 'PAID', paidDate: { gte: monthStart } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });
    const topCustomerIds = topCustomers.map(c => c.customerId);
    const customerNames  = await prisma.customer.findMany({
      where: { id: { in: topCustomerIds } },
      select: { id: true, name: true, phone: true },
    });
    const topCustomersWithNames = topCustomers.map(tc => ({
      ...tc,
      customer: customerNames.find(c => c.id === tc.customerId),
    }));

    // Most expensive vehicle (total expenses)
    const vehicleExpenses = await prisma.vehicleExpense.groupBy({
      by: ['vehicleId'],
      where: { organizationId: orgId },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 1,
    });
    let mostExpensiveVehicle = null;
    if (vehicleExpenses.length) {
      mostExpensiveVehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleExpenses[0].vehicleId },
        select: { name: true, licensePlate: true },
      });
    }

    const ti = todayIncome._sum.amount  ?? 0;
    const te = todayExpenses._sum.amount ?? 0;
    const mi = monthIncome._sum.amount  ?? 0;
    const me = monthExpenses._sum.amount ?? 0;
    const netBusinessValue = vehicles.reduce((s, v) => s + (v.currentValue ?? v.purchasePrice ?? 0), 0);

    res.json({
      today:  { income: ti, expenses: te, profit: ti - te },
      month:  { income: mi, expenses: me, profit: mi - me },
      outstanding:     outstandingBalance._sum.amount ?? 0,
      dueTodayCount:   dueTodayPayments,
      overdueCount:    overduePayments,
      activeContracts,
      compliance: { insuranceExpiring, roadTaxExpiring, inspectionExpiring },
      monthlyStats: {
        maintenance: maintenanceCost._sum.amount ?? 0,
        fuel:        fuelCost._sum.amount ?? 0,
        fines:       finesCost._sum.amount ?? 0,
      },
      topCustomers:       topCustomersWithNames,
      mostExpensiveVehicle,
      netBusinessValue,
    });
  } catch (err) { next(err); }
});

// ─── Vehicle Profitability ────────────────────────────────────────────────────
router.get('/vehicle-profitability', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 365 * 86400000);
    const to   = req.query.to   ? new Date(req.query.to)   : new Date();

    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, licensePlate: true, vehicleType: true, purchasePrice: true, currentValue: true },
    });

    const profitability = await Promise.all(vehicles.map(async v => {
      const [income, expenses] = await Promise.all([
        prisma.contractPayment.aggregate({
          where: { contract: { vehicleId: v.id }, status: 'PAID', paidDate: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
        prisma.vehicleExpense.groupBy({
          by: ['category'],
          where: { vehicleId: v.id, date: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
      ]);
      const totalIncome   = income._sum.amount ?? 0;
      const expensesBycat = Object.fromEntries(expenses.map(e => [e.category, e._sum.amount ?? 0]));
      const totalExpenses = Object.values(expensesBycat).reduce((s, a) => s + a, 0);
      return {
        vehicle: v,
        income: totalIncome,
        expenses: expensesBycat,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        profitMargin: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0',
      };
    }));

    res.json({ from, to, data: profitability });
  } catch (err) { next(err); }
});

// ─── Cash Flow ────────────────────────────────────────────────────────────────
router.get('/cash-flow', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
    const to   = req.query.to   ? new Date(req.query.to)   : new Date();

    const [income, expenses] = await Promise.all([
      prisma.contractPayment.findMany({
        where: { contract: { organizationId: orgId }, status: 'PAID', paidDate: { gte: from, lte: to } },
        select: { amount: true, paidDate: true, method: true },
        orderBy: { paidDate: 'asc' },
      }),
      prisma.vehicleExpense.findMany({
        where: { organizationId: orgId, date: { gte: from, lte: to } },
        select: { amount: true, date: true, category: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    res.json({ from, to, income, expenses });
  } catch (err) { next(err); }
});

// ─── Financial Statement ──────────────────────────────────────────────────────
router.get('/statement', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const from  = req.query.from ? new Date(req.query.from) : new Date(new Date().getFullYear(), 0, 1);
    const to    = req.query.to   ? new Date(req.query.to)   : new Date();

    const [revenueAgg, expenseByCategory] = await Promise.all([
      prisma.contractPayment.aggregate({
        where: { contract: { organizationId: orgId }, status: 'PAID', paidDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.vehicleExpense.groupBy({
        by: ['category'],
        where: { organizationId: orgId, date: { gte: from, lte: to } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
    ]);

    const totalRevenue  = revenueAgg._sum.amount ?? 0;
    const totalExpenses = expenseByCategory.reduce((s, e) => s + (e._sum.amount ?? 0), 0);
    const grossProfit   = totalRevenue - totalExpenses;

    // Vehicles for depreciation estimate
    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: orgId },
      select: { purchasePrice: true, currentValue: true, purchaseDate: true },
    });
    const totalDepreciation = vehicles.reduce((s, v) => {
      if (!v.purchasePrice || !v.currentValue) return s;
      return s + (v.purchasePrice - v.currentValue);
    }, 0);

    res.json({
      from, to,
      revenue: totalRevenue,
      expensesByCategory: expenseByCategory,
      totalExpenses,
      grossProfit,
      depreciation: totalDepreciation,
      netProfit: grossProfit - totalDepreciation,
    });
  } catch (err) { next(err); }
});

// ─── Driver Payments ─────────────────────────────────────────────────────────
router.get('/driver-payments', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const { year, month } = req.query;
    const payments = await prisma.driverPayment.findMany({
      where: {
        driver: { user: { organizationId: orgId } },
        ...(year  && { year: parseInt(year) }),
        ...(month && { month: parseInt(month) }),
      },
      include: {
        driver: {
          include: {
            user:           { select: { firstName: true, lastName: true, email: true, phone: true } },
            currentVehicle: { select: { name: true, licensePlate: true } },
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(payments);
  } catch (err) { next(err); }
});

router.post('/driver-payments', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'), async (req: any, res, next) => {
  try {
    const { driverId, month, year, baseSalary = 0, commission = 0, bonus = 0, deductions = 0, expectedAmount = 0, paidAmount = 0, notes } = req.body;
    const totalAmount = baseSalary + commission + bonus - deductions + paidAmount;
    const payment = await prisma.driverPayment.upsert({
      where: { driverId_month_year: { driverId, month, year } },
      create: { driverId, month, year, baseSalary, commission, bonus, deductions, expectedAmount, paidAmount, difference: paidAmount - expectedAmount, totalAmount, notes },
      update: { baseSalary, commission, bonus, deductions, expectedAmount, paidAmount, difference: paidAmount - expectedAmount, totalAmount, notes },
      include: { driver: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    res.status(201).json(payment);
  } catch (err) { next(err); }
});

router.patch('/driver-payments/:id/mark-paid', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'), async (req: any, res, next) => {
  try {
    const p = await prisma.driverPayment.update({
      where: { id: req.params.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    res.json(p);
  } catch (err) { next(err); }
});

export default router;
