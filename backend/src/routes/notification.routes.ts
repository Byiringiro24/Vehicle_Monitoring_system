/**
 * /api/v1/notifications
 * User notification preferences
 * GET  /notifications/preferences        — get user's prefs
 * PUT  /notifications/preferences        — update all prefs at once
 * PATCH /notifications/preferences/:type — toggle one alert type
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate as any);

const ALERT_TYPES = [
  'SPEEDING','GEOFENCE_ENTRY','GEOFENCE_EXIT','LOW_FUEL','LOW_BATTERY',
  'ENGINE_OVERHEAT','BATTERY_LOW_VOLTAGE','HARSH_BRAKING','HARSH_ACCELERATION',
  'ACCIDENT','IDLE_TOO_LONG','OFFLINE','INSURANCE_EXPIRING',
  'ROAD_TAX_EXPIRING','INSPECTION_DUE','MAINTENANCE_DUE','CUSTOM',
];

// ── GET /notifications/preferences ───────────────────────────────────────────
router.get('/preferences', async (req: any, res, next) => {
  try {
    const userId = req.user.userId;
    const orgId  = req.user.organizationId;

    const saved = await prisma.notificationPreference.findMany({
      where: { userId, organizationId: orgId },
    });

    // Merge with defaults — any alert type not saved defaults to enabled
    const prefs = ALERT_TYPES.map(alertType => {
      const existing = saved.find(s => s.alertType === alertType);
      return {
        alertType,
        emailEnabled: existing?.emailEnabled ?? true,
        inAppEnabled: existing?.inAppEnabled ?? true,
        id:           existing?.id ?? null,
      };
    });

    res.json(prefs);
  } catch (err) { next(err); }
});

// ── PUT /notifications/preferences — bulk update ──────────────────────────────
router.put('/preferences', async (req: any, res, next) => {
  try {
    const userId = req.user.userId;
    const orgId  = req.user.organizationId;
    const prefs: { alertType: string; emailEnabled: boolean; inAppEnabled: boolean }[] = req.body;

    if (!Array.isArray(prefs)) {
      res.status(400).json({ error: 'Expected array of preferences' });
      return;
    }

    // Upsert each preference
    await Promise.all(prefs.map(p =>
      prisma.notificationPreference.upsert({
        where:  { userId_organizationId_alertType: { userId, organizationId: orgId, alertType: p.alertType } },
        create: { userId, organizationId: orgId, alertType: p.alertType, emailEnabled: p.emailEnabled, inAppEnabled: p.inAppEnabled },
        update: { emailEnabled: p.emailEnabled, inAppEnabled: p.inAppEnabled },
      })
    ));

    res.json({ message: 'Preferences updated', count: prefs.length });
  } catch (err) { next(err); }
});

// ── PATCH /notifications/preferences/:type — toggle one type ─────────────────
router.patch('/preferences/:type', async (req: any, res, next) => {
  try {
    const userId    = req.user.userId;
    const orgId     = req.user.organizationId;
    const alertType = req.params.type;
    const { emailEnabled, inAppEnabled } = req.body;

    const pref = await prisma.notificationPreference.upsert({
      where:  { userId_organizationId_alertType: { userId, organizationId: orgId, alertType } },
      create: { userId, organizationId: orgId, alertType, emailEnabled: emailEnabled ?? true, inAppEnabled: inAppEnabled ?? true },
      update: {
        ...(emailEnabled !== undefined && { emailEnabled }),
        ...(inAppEnabled !== undefined && { inAppEnabled }),
      },
    });

    res.json(pref);
  } catch (err) { next(err); }
});

export default router;
