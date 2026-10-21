/**
 * /api/v1/platform  — Super Admin only
 * Company overview, subscription management, plan CRUD, entitlement grants.
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import {
  activateSubscription, grantEntitlement, revokeEntitlement, auditLog,
} from '../services/membership.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate, authorize('SUPER_ADMIN'));

// ── GET /platform/stats — platform-level KPIs ────────────────────────────────
router.get('/stats', async (_req, res, next) => {
  try {
    const [
      totalOrgs, activeOrgs,
      totalUsers, totalVehicles,
      subscriptionsByStatus,
      planBreakdown,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { isActive: true } as any }),
      prisma.user.count(),
      prisma.vehicle.count(),
      prisma.subscription.groupBy({ by: ['status'], _count: true }),
      prisma.subscription.groupBy({ by: ['planId'], _count: true }),
    ]);

    const plans = await prisma.plan.findMany({ select: { id: true, name: true, tier: true } });
    const planMap = Object.fromEntries(plans.map(p => [p.id, p.name]));

    res.json({
      totalOrgs,
      activeOrgs,
      totalUsers,
      totalVehicles,
      subscriptionsByStatus,
      planBreakdown: planBreakdown.map(p => ({
        plan: planMap[p.planId] ?? p.planId,
        count: p._count,
      })),
    });
  } catch (err) { next(err); }
});

// ── GET /platform/organizations — all companies with subscription ─────────────
router.get('/organizations', async (req: any, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit as string ?? '50', 10));
    const skip  = (page - 1) * limit;
    const search = (req.query.search as string) ?? '';

    const where: any = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }
      : {};

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          subscription: { include: { plan: { select: { name: true, tier: true } } } },
          _count: { select: { users: true, vehicles: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    res.json({ data: orgs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ── GET /platform/organizations/:id — single org detail ──────────────────────
router.get('/organizations/:id', async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        subscription: { include: { plan: true, entitlements: true } },
        entitlements: { orderBy: { featureKey: 'asc' } },
        _count: { select: { users: true, vehicles: true, drivers: true, contracts: true } },
      },
    });
    if (!org) throw new AppError(404, 'Organization not found');
    res.json(org);
  } catch (err) { next(err); }
});

// ── POST /platform/organizations/:id/subscription — activate/change plan ─────
router.post('/organizations/:id/subscription', async (req: any, res, next) => {
  try {
    const { planId, seats, trialDays, notes } = req.body;
    if (!planId) throw new AppError(400, 'planId is required');

    const subscription = await activateSubscription({
      organizationId: req.params.id,
      planId,
      actorUserId: req.user.userId,
      seats, trialDays, notes,
    });
    res.json(subscription);
  } catch (err) { next(err); }
});

// ── PATCH /platform/organizations/:id/subscription — update status/seats ─────
router.patch('/organizations/:id/subscription', async (req: any, res, next) => {
  try {
    const { status, seats, notes } = req.body;
    const sub = await prisma.subscription.findUnique({ where: { organizationId: req.params.id } });
    if (!sub) throw new AppError(404, 'No subscription found for this organization');

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        ...(status && { status }),
        ...(seats  && { seats }),
        ...(notes  && { notes }),
      },
    });
    await auditLog({
      organizationId: req.params.id,
      userId: req.user.userId,
      action: 'subscription.update',
      targetType: 'Subscription',
      targetId: sub.id,
      after: { status, seats, notes },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST /platform/organizations/:id/entitlements — grant a feature ───────────
router.post('/organizations/:id/entitlements', async (req: any, res, next) => {
  try {
    const { featureKey, expiresAt, usageLimit, metadata } = req.body;
    if (!featureKey) throw new AppError(400, 'featureKey is required');

    const entitlement = await grantEntitlement({
      organizationId: req.params.id,
      featureKey,
      grantedById: req.user.userId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      usageLimit,
      metadata,
    });
    res.status(201).json(entitlement);
  } catch (err) { next(err); }
});

// ── DELETE /platform/organizations/:id/entitlements/:key — revoke a feature ───
router.delete('/organizations/:id/entitlements/:key', async (req: any, res, next) => {
  try {
    const result = await revokeEntitlement(req.params.id, req.params.key, req.user.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /platform/plans — list all plans ─────────────────────────────────────
router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { monthlyPriceUsd: 'asc' } });
    res.json(plans);
  } catch (err) { next(err); }
});

// ── POST /platform/plans — create a plan ─────────────────────────────────────
router.post('/plans', async (req, res, next) => {
  try {
    const { name, slug, tier, description, monthlyPriceUsd, annualPriceUsd, includedSeats, trialDays, features, limits } = req.body;
    if (!name || !slug) throw new AppError(400, 'name and slug are required');
    const plan = await prisma.plan.create({
      data: { name, slug, tier, description, monthlyPriceUsd, annualPriceUsd, includedSeats, trialDays, features, limits },
    });
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

// ── PUT /platform/plans/:id — update a plan ──────────────────────────────────
router.put('/plans/:id', async (req, res, next) => {
  try {
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data: req.body });
    res.json(plan);
  } catch (err) { next(err); }
});

// ── GET /platform/audit-logs — recent audit events ───────────────────────────
router.get('/audit-logs', async (req, res, next) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit as string ?? '50', 10));
    const orgId = req.query.organizationId as string | undefined;
    const where = orgId ? { organizationId: orgId } : {};
    const logs = await prisma.auditLog.findMany({
      where, orderBy: { createdAt: 'desc' }, take: limit,
    });
    res.json(logs);
  } catch (err) { next(err); }
});

export default router;
