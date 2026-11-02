import { Router } from 'express';
import {
  login, refresh, logout, me, changePassword,
  forgotPassword, resetPassword, register, registerPersonal,
  switchOrganization,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register',          register);
router.post('/register-personal', registerPersonal);
router.post('/login',             login);
router.post('/refresh',           refresh);
router.post('/logout',            logout);
router.post('/switch-organization', authenticate, switchOrganization);
router.get('/me',                 authenticate, me);
router.post('/change-password',   authenticate, changePassword);

// Sessions management
router.get('/sessions', authenticate, async (req: any, res, next) => {
  try {
    const { prisma } = await import('../config/database');
    const sessions = await prisma.refreshToken.findMany({
      where:   { userId: req.user.userId, expiresAt: { gt: new Date() } },
      select:  { id: true, createdAt: true, expiresAt: true, userAgent: true, ipAddress: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sessions);
  } catch (err) { next(err); }
});

router.delete('/sessions/:id', authenticate, async (req: any, res, next) => {
  try {
    const { prisma } = await import('../config/database');
    const session = await prisma.refreshToken.findUnique({ where: { id: req.params.id } });
    if (!session || session.userId !== req.user.userId) {
      res.status(404).json({ error: 'Session not found' }); return;
    }
    await prisma.refreshToken.delete({ where: { id: req.params.id } });
    res.json({ message: 'Session revoked' });
  } catch (err) { next(err); }
});

router.delete('/sessions', authenticate, async (req: any, res, next) => {
  try {
    const { currentToken } = req.body;
    const { prisma } = await import('../config/database');
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user.userId, ...(currentToken ? { token: { not: currentToken } } : {}) },
    });
    res.json({ message: 'All other sessions revoked' });
  } catch (err) { next(err); }
});

// Password recovery
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

export default router;
