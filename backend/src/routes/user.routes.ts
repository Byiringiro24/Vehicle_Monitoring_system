import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendInvitationEmail } from '../services/email.service';
import logger from '../utils/logger';

const router = Router();
router.use(authenticate);

// ── GET /users — list users in the caller's organisation (all authenticated users) ──
router.get('/', async (req: any, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, lastLoginAt: true, createdAt: true,
        phone: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

// ── GET /users/all — SUPER_ADMIN only: all users across ALL organisations ─────
router.get('/all', authorize('SUPER_ADMIN'), async (_req: any, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, lastLoginAt: true, createdAt: true,
        phone: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ organization: { name: 'asc' } }, { createdAt: 'desc' }],
    });
    res.json(users);
  } catch (err) { next(err); }
});

// ── POST /users — SUPER_ADMIN or ADMIN: create a new user in their organisation ─
router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const { email, password, firstName, lastName, role, phone } = req.body;
    if (!email || !password || !firstName || !lastName || !role) {
      res.status(400).json({ error: 'email, password, firstName, lastName and role are required' });
      return;
    }
    // SUPER_ADMIN cannot be created through this endpoint — only seeded
    if (role === 'SUPER_ADMIN') {
      res.status(403).json({ error: 'SUPER_ADMIN role cannot be assigned through this endpoint' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(), passwordHash,
        firstName, lastName, role, phone,
        organizationId: req.user.organizationId,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    next(err);
  }
});

// ── PUT /users/:id — SUPER_ADMIN or ADMIN: update user details ───────────────
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const { password, role, ...rest } = req.body;
    const data: any = { ...rest };

    // Prevent assigning SUPER_ADMIN role via this endpoint
    if (role && role !== 'SUPER_ADMIN') data.role = role;
    if (role === 'SUPER_ADMIN') {
      res.status(403).json({ error: 'SUPER_ADMIN role cannot be assigned through this endpoint' });
      return;
    }
    if (password) data.passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

// ── POST /users/:id/reset-password — SUPER_ADMIN only: force-reset any user's password ─
router.post('/:id/reset-password', authorize('SUPER_ADMIN'), async (req: any, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'newPassword must be at least 8 characters' });
      return;
    }

    // Verify the target user exists
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and invalidate all existing sessions for the user
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } }),
      prisma.refreshToken.deleteMany({ where: { userId: req.params.id } }),
    ]);

    res.json({
      message: `Password reset successfully for ${target.firstName} ${target.lastName}. All active sessions have been invalidated.`,
      userId: target.id,
    });
  } catch (err) { next(err); }
});

// ── PATCH /users/:id/status — SUPER_ADMIN or ADMIN: activate/deactivate a user ─
router.patch('/:id/status', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive must be a boolean' });
      return;
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });
    // If deactivating, also kill all their sessions
    if (!isActive) {
      await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });
    }
    res.json(user);
  } catch (err) { next(err); }
});

// ── POST /users/invite — ADMIN/SUPER_ADMIN: invite user by email ──────────────
// If user already exists → add membership; if new → create with temp password + send setup link
router.post('/invite', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const { email, role, firstName, lastName } = req.body;
    if (!email || !role) {
      res.status(400).json({ error: 'email and role are required' });
      return;
    }
    if (role === 'SUPER_ADMIN') {
      res.status(403).json({ error: 'SUPER_ADMIN role cannot be invited' });
      return;
    }

    const appUrl = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';
    const orgId  = req.user.organizationId;
    const org    = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });

    // Check if user already exists
    let targetUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (targetUser) {
      // User exists — update their org if they don't already belong to this org
      if (targetUser.organizationId !== orgId) {
        await prisma.user.update({
          where: { id: targetUser.id },
          data:  { organizationId: orgId, role: role as any },
        });
      } else {
        // Same org — just update role
        await prisma.user.update({
          where: { id: targetUser.id },
          data:  { role: role as any },
        });
      }
      // Send notification email
      sendInvitationEmail(targetUser.email, targetUser.firstName, org?.name ?? 'ARTIC VMS', role, `${appUrl}/login`, null)
        .catch(e => logger.warn(`[INVITE] Email failed: ${e.message}`));
      logger.info(`[INVITE] Existing user ${email} added to org ${orgId} with role ${role}`);
      res.json({ message: `${targetUser.firstName} has been added to your organization.`, type: 'existing' });
    } else {
      // New user — generate temp password and setup token
      const rawToken   = crypto.randomBytes(32).toString('hex');
      const tokenHash  = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt  = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
      const tempPass   = crypto.randomBytes(12).toString('hex');
      const passwordHash = await bcrypt.hash(tempPass, 12);

      await prisma.$transaction(async tx => {
        const newUser = await tx.user.create({
          data: {
            email:         email.toLowerCase(),
            passwordHash,
            firstName:     firstName ?? email.split('@')[0],
            lastName:      lastName  ?? '',
            role:          role as any,
            organizationId: orgId,
          },
        });
        // Reuse password reset tokens table for setup link
        await tx.passwordResetToken.create({
          data: { tokenHash, userId: newUser.id, expiresAt },
        });
        return newUser;
      });

      const setupUrl = `${appUrl}/reset-password?token=${rawToken}&setup=1`;
      sendInvitationEmail(email, firstName ?? email.split('@')[0], org?.name ?? 'ARTIC VMS', role, setupUrl, rawToken)
        .catch(e => logger.warn(`[INVITE] Email failed: ${e.message}`));
      logger.info(`[INVITE] New user invited: ${email} to org ${orgId} as ${role}`);
      res.status(201).json({ message: `Invitation sent to ${email}. They'll receive an email to set their password.`, type: 'new' });
    }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'This email is already in use' });
      return;
    }
    next(err);
  }
});

export default router;
