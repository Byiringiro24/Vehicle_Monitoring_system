import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

router.get('/', async (req: any, res, next) => {
  try {
    const fleets = await prisma.fleet.findMany({
      where: { organizationId: req.user.organizationId },
      include: { _count: { select: { vehicles: true } }, manager: { select: { firstName: true, lastName: true } } },
    });
    res.json(fleets);
  } catch (err) { next(err); }
});

router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const fleet = await prisma.fleet.create({ data: { ...req.body, organizationId: req.user.organizationId } });
    res.status(201).json(fleet);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const fleet = await prisma.fleet.update({ where: { id: req.params.id }, data: req.body });
    res.json(fleet);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    await prisma.fleet.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;