import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

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
