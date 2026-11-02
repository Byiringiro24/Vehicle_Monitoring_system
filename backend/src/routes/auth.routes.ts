import { Router, Request, Response, NextFunction } from 'express';
import {
  login, refresh, logout, me, changePassword,
  forgotPassword, resetPassword, register, registerPersonal,
  switchOrganization,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { loginUser } from '../services/auth.service';
import { prisma } from '../config/database';
import { jwtConfig } from '../config/jwt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

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

// ── POST /auth/sso — Single Sign-On for external projects ────────────────────
// Accepts email + password, returns a one-time SSO token + redirect URL.
// The other project redirects the user to the redirectUrl, which logs them in
// automatically on articvms.ddnsgeek.com.
//
// Usage from another project:
//   POST https://articvms.ddnsgeek.com/api/v1/auth/sso
//   Body: { "email": "user@example.com", "password": "theirpassword" }
//   Returns: { "redirectUrl": "https://articvms.ddnsgeek.com/sso?token=xxx", "expiresIn": 60 }
//
// Then redirect the user to redirectUrl — they land on their dashboard already logged in.
router.post('/sso', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    // Validate credentials
    const result = await loginUser(email, password);

    // Generate a one-time SSO token (short-lived JWT, 60 seconds)
    const ssoToken = jwt.sign(
      { userId: result.user.id, email: result.user.email, sso: true },
      jwtConfig.secret,
      { expiresIn: '60s' } as jwt.SignOptions,
    );

    const appUrl = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';
    const redirectUrl = `${appUrl}/sso?token=${ssoToken}`;

    res.json({
      redirectUrl,
      expiresIn: 60,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message ?? 'Invalid credentials' });
  }
});

// ── POST /auth/sso/exchange — exchange SSO token for real auth tokens ────────
// Called by the /sso frontend page. Takes the one-time token and returns
// accessToken + refreshToken + user, just like login does.
router.post('/sso/exchange', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    // Verify the SSO token
    const payload = jwt.verify(token, jwtConfig.secret) as any;
    if (!payload.sso) {
      res.status(401).json({ error: 'Invalid SSO token' });
      return;
    }

    // Look up the user and generate real auth tokens
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    const jwtPayload: any = {
      userId: user.id, email: user.email,
      role: user.role, organizationId: user.organizationId,
    };
    const accessToken = jwt.sign(jwtPayload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn } as jwt.SignOptions);
    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Store user agent + IP for session tracking
    const userAgent = req.headers['user-agent'] ?? null;
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt, userAgent: userAgent as any, ipAddress: ipAddress as any },
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id, email: user.email, firstName: user.firstName,
        lastName: user.lastName, role: user.role,
        phone: user.phone,
        organization: user.organization,
      },
    });
  } catch (err: any) {
    res.status(401).json({ error: 'SSO token expired or invalid' });
  }
});
router.post('/reset-password',  resetPassword);

export default router;
