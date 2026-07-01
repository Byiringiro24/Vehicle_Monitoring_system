import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

router.get('/trips', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 86400000);
    const to = req.query.to ? new Date(req.query.to) : new Date();

    const telemetry = await prisma.telemetry.groupBy({
      by: ['vehicleId'],
      where: { vehicle: { organizationId: orgId }, timestamp: { gte: from, lte: to } },
      _count: { id: true },
      _max: { odometer: true, speed: true },
      _avg: { speed: true, fuelLevel: true },
    });

    res.json({ from, to, data: telemetry });
  } catch (err) { next(err); }
});

router.get('/alerts-summary', async (req: any, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(req.query.to) : new Date();

    const summary = await prisma.alert.groupBy({
      by: ['type', 'severity'],
      where: { vehicle: { organizationId: orgId }, triggeredAt: { gte: from, lte: to } },
      _count: true,
    });

    res.json({ from, to, data: summary });
  } catch (err) { next(err); }
});

export default router;