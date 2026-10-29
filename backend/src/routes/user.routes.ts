import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendInvitationEmail, sendWelcomeEmail } from '../services/email.service';
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
    if (role === 'SUPER_ADMIN') {
      res.status(403).json({ error: 'SUPER_ADMIN role cannot be assigned through this endpoint' });
      return;
    }
    // ADMIN cannot create another ADMIN — only SUPER_ADMIN can
    if (role === 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only SUPER_ADMIN can create ADMIN users' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const orgId = req.user.organizationId;

    const user = await prisma.$transaction(async tx => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(), passwordHash,
          firstName, lastName, role, phone,
          organizationId: orgId,
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      });
      // Create membership record for the unified identity system
      await tx.membership.create({
        data: {
          userId: newUser.id,
          organizationId: orgId,
          role: role === 'ADMIN' ? 'COMPANY_ADMIN' : role as any,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      }).catch(() => {}); // membership may not exist in older DB — non-fatal
      return newUser;
    });

    // FIX C1: Send welcome email so the user knows their account exists
    const appUrl = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';
    sendWelcomeEmail(user.email, user.firstName).catch(e =>
      logger.warn(`[USERS] Welcome email failed for ${email}: ${e.message}`)
    );

    logger.info(`[USERS] User created by ${req.user.userId}: ${email} (${role}) in org ${orgId}`);
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
      // FIX D1a — CRITICAL: Never silently move a user out of their existing org.
      // If the user already belongs to a DIFFERENT org, we cannot re-assign them —
      // that would destroy their access to their current org with no warning.
      // Instead: if same org → update role only. If different org → reject with a
      // clear message so the admin knows what happened.
      if (targetUser.organizationId !== orgId) {
        // The user belongs to a different org. We CANNOT move them.
        // The correct flow is: they accept an invitation to a new membership (future feature).
        // For now, if the user was created by a personal account or a different org,
        // refuse silently moving them.
        res.status(409).json({
          error: `This email address belongs to a user in a different organization. They cannot be automatically moved. Ask them to contact support to join your organization.`,
          type: 'conflict',
        });
        return;
      }

      // Same org — update role only (safe)
      await prisma.user.update({
        where: { id: targetUser.id },
        data:  { role: role as any },
      });
      // Update or create membership
      await prisma.membership.upsert({
        where: { id: targetUser.id }, // will fail gracefully — use updateMany below
        update: { role: role as any },
        create: {
          userId: targetUser.id,
          organizationId: orgId,
          role: role === 'ADMIN' ? 'COMPANY_ADMIN' : role as any,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      }).catch(async () => {
        // Upsert by id won't work — try findFirst + update/create
        const existing = await prisma.membership.findFirst({
          where: { userId: targetUser!.id, organizationId: orgId },
        });
        if (existing) {
          await prisma.membership.update({ where: { id: existing.id }, data: { role: role as any } });
        } else {
          await prisma.membership.create({
            data: {
              userId: targetUser!.id,
              organizationId: orgId,
              role: role === 'ADMIN' ? 'COMPANY_ADMIN' : role as any,
              status: 'ACTIVE',
              acceptedAt: new Date(),
            },
          });
        }
      });

      sendInvitationEmail(targetUser.email, targetUser.firstName, org?.name ?? 'ARTIC VMS', role, `${appUrl}/login`, null)
        .catch(e => logger.warn(`[INVITE] Email failed: ${e.message}`));
      logger.info(`[INVITE] Existing user ${email} role updated to ${role} in org ${orgId}`);
      res.json({ message: `${targetUser.firstName}'s role has been updated to ${role.replace(/_/g,' ')}.`, type: 'existing' });
    } else {
      // New user — generate temp password and setup token
      const rawToken    = crypto.randomBytes(32).toString('hex');
      const tokenHash   = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt   = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
      const tempPass    = crypto.randomBytes(12).toString('hex');
      const passwordHash = await bcrypt.hash(tempPass, 12);

      // FIX D2b: use provided firstName/lastName; fall back to email prefix only if missing
      const resolvedFirst = (firstName && firstName.trim()) ? firstName.trim() : email.split('@')[0];
      const resolvedLast  = (lastName  && lastName.trim())  ? lastName.trim()  : '(invited)';

      await prisma.$transaction(async tx => {
        const newUser = await tx.user.create({
          data: {
            email:          email.toLowerCase(),
            passwordHash,
            firstName:      resolvedFirst,
            lastName:       resolvedLast,
            role:           role as any,
            organizationId: orgId,
          },
        });
        // Reuse password reset tokens table for setup link
        await tx.passwordResetToken.create({
          data: { tokenHash, userId: newUser.id, expiresAt },
        });
        // FIX D2c: Create Membership record for invited users
        await tx.membership.create({
          data: {
            userId:         newUser.id,
            organizationId: orgId,
            role:           role === 'ADMIN' ? 'COMPANY_ADMIN' : role as any,
            status:         'ACTIVE',
            acceptedAt:     new Date(),
          },
        }).catch(() => {}); // non-fatal if membership model differs
        return newUser;
      });

      const setupUrl = `${appUrl}/reset-password?token=${rawToken}&setup=1`;
      sendInvitationEmail(email, resolvedFirst, org?.name ?? 'ARTIC VMS', role, setupUrl, rawToken)
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
