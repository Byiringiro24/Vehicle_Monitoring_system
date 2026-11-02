/**
 * /api/v1/entitlements
 * Feature entitlement management (Super Admin controls what each org can use)
 * GET  /entitlements              â€” list this org's entitlements
 * GET  /entitlements/check/:code  â€” is a specific feature enabled for this org?
 * POST /entitlements              â€” Super Admin: grant a feature to an org
 * DELETE /entitlements/:id        â€” Super Admin: revoke an entitlement
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditLog, getIp } from '../utils/audit';

const router = Router();
router.use(authenticate as any);

// â”€â”€ GET /entitlements â€” list this org's enabled features â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const entitlements = await prisma.featureEntitlement.findMany({
      where: { organizationId: orgId, enabled: true },
      orderBy: { featureCode: 'asc' },
    });
    res.json(entitlements);
  } catch (err) { next(err); }
});

// â”€â”€ GET /entitlements/check/:code â€” check single feature â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/check/:code', async (req: any, res, next) => {
  try {
    const orgId   = req.user.organizationId;
    const feature = req.params.code;

    const entitlement = await prisma.featureEntitlement.findUnique({
      where: { organizationId_featureCode: { organizationId: orgId, featureCode: feature } },
    });

    // CORE features are always enabled regardless of entitlement records
    const CORE_FEATURES = [
      'core.dashboard', 'core.vehicles', 'gps.live_map', 'gps.history',
      'gps.geofences', 'core.drivers', 'core.alerts', 'core.maintenance',
      'core.documents', 'core.agreements', 'core.finance', 'core.customers',
      'core.reports',
    ];
    const isCore    = CORE_FEATURES.includes(feature);
    const isEnabled = isCore || (entitlement?.enabled ?? false);

    res.json({ feature, enabled: isEnabled, isCore, entitlement: entitlement ?? null });
  } catch (err) { next(err); }
});

// â”€â”€ POST /entitlements â€” Super Admin: grant feature to org â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/', authorize('SUPER_ADMIN') as any, async (req: any, res, next) => {
  try {
    const { organizationId, featureCode, expiresAt, notes } = req.body;
    if (!organizationId || !featureCode) {
      throw new AppError(400, 'organizationId and featureCode are required');
    }

    const entitlement = await prisma.featureEntitlement.upsert({
      where:  { organizationId_featureCode: { organizationId, featureCode } },
      create: { organizationId, featureCode, enabled: true, grantedBy: req.user.userId, expiresAt: expiresAt ? new Date(expiresAt) : undefined, notes },
      update: { enabled: true, grantedBy: req.user.userId, expiresAt: expiresAt ? new Date(expiresAt) : undefined, notes },
    });

    await auditLog({
      organizationId,
      userId:    req.user.userId,
      action:    'feature.grant',
      targetType:'feature',
      targetId:  featureCode,
      after:     { note: `Feature '${featureCode}' granted to org ${organizationId}` },
      ipAddress: getIp(req),
    });

    res.status(201).json(entitlement);
  } catch (err) { next(err); }
});

// â”€â”€ DELETE /entitlements/:id â€” Super Admin: revoke â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.delete('/:id', authorize('SUPER_ADMIN') as any, async (req: any, res, next) => {
  try {
    const ent = await prisma.featureEntitlement.findUnique({ where: { id: req.params.id } });
    if (!ent) throw new AppError(404, 'Entitlement not found');

    await prisma.featureEntitlement.update({
      where: { id: req.params.id },
      data:  { enabled: false },
    });

    await auditLog({
      organizationId: ent.organizationId,
      userId:    req.user.userId,
      action:    'feature.revoke',
      targetType:'feature',
      targetId:  ent.featureCode,
      after:     { note: `Feature '${ent.featureCode}' revoked from org ${ent.organizationId}` },
      ipAddress: getIp(req),
    });

    res.json({ message: 'Feature revoked' });
  } catch (err) { next(err); }
});

export default router;

