/**
 * /api/v1/audit
 * Audit log routes
 * GET /audit — list audit logs for this org (Admin+)
 * GET /audit/platform — all platform logs (Super Admin only)
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate as any);

// ── GET /audit — org-level audit logs ─────────────────────────────────────────
router.get('/', authorize('SUPER_ADMIN', 'ADMIN') as any, async (req: any, res, next) => {
  try {
    const orgId  = req.user.organizationId;
    const limit  = Math.min(parseInt((req.query.limit as string) ?? '100'), 500);
    const action = req.query.action as string | undefined;
    const from   = req.query.from ? new Date(req.query.from as string) : undefined;
    const to     = req.query.to   ? new Date(req.query.to   as string) : undefined;

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        ...(action && { action: { contains: action, mode: 'insensitive' } }),
        ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(logs);
  } catch (err) { next(err); }
});

// ── GET /audit/platform — all platform-level logs (Super Admin) ───────────────
router.get('/platform', authorize('SUPER_ADMIN') as any, async (req: any, res, next) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? '200'), 1000);
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(logs);
  } catch (err) { next(err); }
});

export default router;
