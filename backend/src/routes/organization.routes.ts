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
    const allowedFields = ['name', 'description', 'email', 'phone', 'address', 'website', 'country', 'currency', 'taxId'];
    const payload: Record<string, any> = {};

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        const value = req.body[key];
        if (value === null || value === undefined || value === '') {
          payload[key] = null;
          continue;
        }
        payload[key] = typeof value === 'string' ? value.trim() : value;
      }
    }

    if (payload.name && payload.name.length < 2) {
      throw new Error('Organization name must be at least 2 characters');
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      throw new Error('Organization email is invalid');
    }
    if (payload.country && payload.country.length > 100) {
      throw new Error('Country name is too long');
    }
    if (payload.currency && payload.currency.length > 10) {
      throw new Error('Currency code is too long');
    }
    if (payload.phone && payload.phone.length > 30) {
      throw new Error('Phone number is too long');
    }
    if (payload.website && payload.website.length > 255) {
      throw new Error('Website URL is too long');
    }

    const org = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data: payload,
    });
    res.json(org);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'A value conflicts with an existing record' });
      return;
    }
    if (err?.message) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;