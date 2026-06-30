import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

router.get('/', async (req: any, res, next) => {
  try {
    const geofences = await prisma.geofence.findMany({ where: { organizationId: req.user.organizationId } });
    res.json(geofences);
  } catch (err) { next(err); }
});

router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const geo = await prisma.geofence.create({ data: { ...req.body, organizationId: req.user.organizationId } });
    res.status(201).json(geo);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const geo = await prisma.geofence.update({ where: { id: req.params.id }, data: req.body });
    res.json(geo);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    await prisma.geofence.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;