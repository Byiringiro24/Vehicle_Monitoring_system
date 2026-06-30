import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

router.get('/me', async (req: any, res, next) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
    res.json(org);
  } catch (err) { next(err); }
});

router.put('/me', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const org = await prisma.organization.update({ where: { id: req.user.organizationId }, data: req.body });
    res.json(org);
  } catch (err) { next(err); }
});

export default router;