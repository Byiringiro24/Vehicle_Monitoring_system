import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendInvitationEmail, sendWelcomeEmail, sendSuperAdminRemovalConfirmationEmail, sendSensitiveAccountAlertEmail } from '../services/email.service';
import logger from '../utils/logger';

const VALID_ROLES = new Set([
  'SUPER_ADMIN', 'PLATFORM_SUPPORT', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT',
  'DRIVER', 'VIEWER', 'SALES_AGENT', 'DISPATCHER', 'HR_MANAGER', 'MECHANIC', 'COMPLIANCE_OFFICER',
  'RENTAL_MANAGER', 'AUDITOR',
]);

const ORG_APPROVAL_ROLES = new Set(['HR_MANAGER', 'MECHANIC', 'COMPLIANCE_OFFICER', 'FINANCE_MANAGER', 'DISPATCHER', 'RENTAL_MANAGER']);

function normalizeRoleList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(new Set(list.filter(Boolean).map(String).map(role => role.trim()).filter(role => VALID_ROLES.has(role))));
}

async function ensureSuperAdminLimit(targetRoles: string[], currentUserId: string, targetUserId?: string) {
  if (!targetRoles.includes('SUPER_ADMIN')) return;

  const superAdminCount = await prisma.user.count({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });

  if (superAdminCount >= 2 && (!targetUserId || targetUserId !== currentUserId)) {
    throw new Error('Only two Super Admins are allowed at the same time.');
  }
}

function getPrimaryRole(roles: string[]) {
  if (!roles.length) return 'VIEWER';
  return roles[0];
}

async function notifyOrgOwnersOfSensitiveUserAction(
  organizationId: string,
  targetUser: { email: string; firstName: string; lastName: string },
  action: string,
  actorName: string,
) {
  const owners = await prisma.membership.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      role: { in: ['COMPANY_OWNER', 'COMPANY_ADMIN'] },
    },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  const targetName = `${targetUser.firstName} ${targetUser.lastName}`.trim() || targetUser.email;

  for (const owner of owners) {
    if (!owner.user?.email) continue;
    await sendSensitiveAccountAlertEmail(
      owner.user.email,
      owner.user.firstName,
      targetName,
      action,
      actorName,
      organization?.name ?? 'your organization',
    ).catch((err) => logger.warn(`[USERS] Org owner alert failed for ${owner.user.email}: ${err.message}`));
  }
}

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

router.get('/super-admins', authorize('SUPER_ADMIN'), async (_req: any, res, next) => {
  try {
    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true, lastLoginAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(superAdmins);
  } catch (err) { next(err); }
});

router.post('/:id/request-super-admin-removal', authorize('SUPER_ADMIN'), async (req: any, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.userId) {
      res.status(400).json({ error: 'A Super Admin cannot remove their own account without a second confirmation.' });
      return;
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, roles: true },
    });

    if (!target) {
      res.status(404).json({ error: 'Super Admin not found.' });
      return;
    }

    const hasSuperRole = target.role === 'SUPER_ADMIN' || (Array.isArray(target.roles) && target.roles.includes('SUPER_ADMIN'));
    if (!hasSuperRole) {
      res.status(400).json({ error: 'Only Super Admin accounts can be removed through this flow.' });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { tokenHash, userId: target.id, expiresAt },
    });

    const confirmUrl = `${process.env.APP_URL ?? 'https://articvms.ddnsgeek.com'}/super-admin/confirm?token=${rawToken}`;
    await sendSuperAdminRemovalConfirmationEmail(
      target.email,
      target.firstName,
      `${target.firstName} ${target.lastName}`,
      confirmUrl,
    );

    res.json({
      message: 'Removal confirmation email sent. The Super Admin remains active until they confirm the deletion request.',
      expiresAt,
    });
  } catch (err) { next(err); }
});

router.post('/super-admins/confirm-removal', async (req: any, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Confirmation token is required.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, roles: true, pendingRoles: true } } },
    });

    if (!record || record.expiresAt < new Date() || record.used) {
      res.status(401).json({ error: 'The confirmation link is invalid or has expired.' });
      return;
    }

    const user = record.user;
    const hasSuperRole = user.role === 'SUPER_ADMIN' || (Array.isArray(user.roles) && user.roles.includes('SUPER_ADMIN'));
    if (!hasSuperRole) {
      res.status(400).json({ error: 'This account is no longer a Super Admin.' });
      return;
    }

    const nextRoles = (user.roles ?? []).filter(role => role !== 'SUPER_ADMIN');
    const nextPrimaryRole = nextRoles[0] ?? 'ADMIN';

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          role: nextPrimaryRole as any,
          roles: nextRoles as any,
          pendingRoles: (user.pendingRoles ?? []).filter(role => role !== 'SUPER_ADMIN') as any,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);

    res.json({
      message: 'Super Admin removal confirmed. The account has been downgraded and will no longer act as a Super Admin.',
      userId: user.id,
    });
  } catch (err) { next(err); }
});

// ── POST /users — SUPER_ADMIN or ADMIN: create a new user in their organisation ─
router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const { email, password, firstName, lastName, role, roles, phone } = req.body;
    const requestedRoles = normalizeRoleList(roles ?? role);
    if (!email || !password || !firstName || !lastName || !requestedRoles.length) {
      res.status(400).json({ error: 'email, password, firstName, lastName and at least one role are required' });
      return;
    }

    const currentSuperAdminCount = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
    if (requestedRoles.includes('SUPER_ADMIN') && currentSuperAdminCount >= 2) {
      res.status(403).json({ error: 'Only two Super Admins are allowed in the platform at the same time.' });
      return;
    }
    if (requestedRoles.includes('ADMIN') && req.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only SUPER_ADMIN can create ADMIN users' });
      return;
    }

    const orgId = req.user.organizationId;
    const subscription = await prisma.subscription.findUnique({ where: { organizationId: orgId }, select: { seats: true, seatsUsed: true, status: true } });
    if (subscription && subscription.status !== 'TRIAL' && subscription.status !== 'ACTIVE' && subscription.status !== 'PAST_DUE') {
      res.status(403).json({ error: 'This organization subscription is not active.' });
      return;
    }
    if (subscription && subscription.seatsUsed >= subscription.seats) {
      res.status(403).json({ error: 'This organization has reached its purchased seat limit.' });
      return;
    }

    const primaryRole = getPrimaryRole(requestedRoles);
    const pendingRoles = requestedRoles.filter(roleName => roleName !== primaryRole && Array.from(ORG_APPROVAL_ROLES).includes(roleName));
    const activeRoles = requestedRoles.filter(roleName => roleName === primaryRole || !Array.from(ORG_APPROVAL_ROLES).includes(roleName));

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async tx => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(), passwordHash,
          firstName, lastName, role: primaryRole as any, roles: activeRoles as any, pendingRoles: pendingRoles as any, phone,
          organizationId: orgId,
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, roles: true, pendingRoles: true },
      });

      if (subscription) {
        await tx.subscription.update({
          where: { organizationId: orgId },
          data: { seatsUsed: subscription.seatsUsed + 1 },
        });
      }

      await tx.membership.create({
        data: {
          userId: newUser.id,
          organizationId: orgId,
          role: primaryRole === 'ADMIN' ? 'COMPANY_ADMIN' : primaryRole as any,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      }).catch(() => {});
      return newUser;
    });

    sendWelcomeEmail(user.email, user.firstName).catch(e =>
      logger.warn(`[USERS] Welcome email failed for ${email}: ${e.message}`)
    );

    await notifyOrgOwnersOfSensitiveUserAction(
      orgId,
      { email: user.email, firstName: user.firstName, lastName: user.lastName },
      'User account created and access assigned',
      `${req.user.firstName ?? 'System'} ${req.user.lastName ?? ''}`.trim() || 'System Administrator',
    );

    logger.info(`[USERS] User created by ${req.user.userId}: ${email} (${primaryRole}) in org ${orgId}`);
    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    if (err instanceof Error && err.message.includes('Only two Super Admins')) {
      res.status(403).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ── PUT /users/:id — admins update users, users can update their own profile ─
router.put('/:id', async (req: any, res, next) => {
  try {
    const isSelfUpdate = req.user.userId === req.params.id;
    const isAdmin = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN';

    if (!isSelfUpdate && !isAdmin) {
      res.status(403).json({ error: 'You can only update your own profile or manage users as an admin' });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, organizationId: true, email: true, firstName: true, lastName: true, role: true, roles: true },
    });

    if (!targetUser && !isSelfUpdate) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!isSelfUpdate && req.user.role !== 'SUPER_ADMIN' && targetUser && targetUser.organizationId !== req.user.organizationId) {
      res.status(403).json({ error: 'You can only manage users inside your organization' });
      return;
    }

    if (isSelfUpdate && req.user.organizationId !== targetUser?.organizationId) {
      res.status(403).json({ error: 'You can only update your own profile in this organization' });
      return;
    }

    const { password, role, roles, ...rest } = req.body;
    const data: any = {};

    if (isSelfUpdate) {
      if (typeof rest.firstName === 'string' && rest.firstName.trim()) data.firstName = rest.firstName.trim();
      if (typeof rest.lastName === 'string' && rest.lastName.trim()) data.lastName = rest.lastName.trim();
      if ('phone' in rest) data.phone = rest.phone ?? null;
      if (password) {
        res.status(400).json({ error: 'Use the dedicated password change endpoint to update your password' });
        return;
      }
      if (role || roles) {
        res.status(403).json({ error: 'You cannot change your own role from this endpoint' });
        return;
      }
      if (!Object.keys(data).length) {
        res.status(400).json({ error: 'No editable profile fields were provided' });
        return;
      }
    } else {
      const adminData: any = { ...rest };
      if (role && role !== 'SUPER_ADMIN') adminData.role = role;
      if (role === 'SUPER_ADMIN') {
        res.status(403).json({ error: 'SUPER_ADMIN role cannot be assigned through this endpoint' });
        return;
      }
      if (Array.isArray(roles) && roles.length) {
        adminData.roles = roles;
        const primaryRole = roles[0];
        if (primaryRole) adminData.role = primaryRole;
      }
      if (password) adminData.passwordHash = await bcrypt.hash(password, 12);

      Object.assign(data, adminData);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, roles: true, pendingRoles: true, isActive: true, phone: true },
    });

    if (!isSelfUpdate || data.passwordHash || data.role || data.roles) {
      await notifyOrgOwnersOfSensitiveUserAction(
        req.user.organizationId,
        { email: user.email, firstName: user.firstName, lastName: user.lastName },
        isSelfUpdate ? 'User profile or credentials were changed' : 'User account was updated by an administrator',
        `${req.user.firstName ?? 'System'} ${req.user.lastName ?? ''}`.trim() || 'System Administrator',
      );
    }

    res.json(user);
  } catch (err) { next(err); }
});

router.patch('/:id/approve-roles', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles) || !roles.length) {
      res.status(400).json({ error: 'roles must be a non-empty array' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { roles: true, pendingRoles: true, role: true, organizationId: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (req.user.role !== 'SUPER_ADMIN' && req.user.organizationId !== user.organizationId) {
      res.status(403).json({ error: 'Only the assigned organization can approve internal staff roles.' });
      return;
    }

    const approvedRoles = Array.from(new Set([...(user.roles ?? []), ...normalizeRoleList(roles)]));
    const nextPending = (user.pendingRoles ?? []).filter(role => !normalizeRoleList(roles).includes(role));

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        roles: approvedRoles as any,
        pendingRoles: nextPending as any,
        role: (approvedRoles[0] ?? user.role) as any,
      },
      select: { id: true, email: true, role: true, roles: true, pendingRoles: true, organizationId: true, firstName: true, lastName: true },
    });

    await notifyOrgOwnersOfSensitiveUserAction(
      updated.organizationId,
      { email: updated.email, firstName: updated.firstName, lastName: updated.lastName },
      'User access roles were approved and updated',
      `${req.user.firstName ?? 'System'} ${req.user.lastName ?? ''}`.trim() || 'System Administrator',
    );

    res.json({ message: 'Additional roles approved successfully.', user: updated });
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
      select: { id: true, email: true, firstName: true, lastName: true, organizationId: true },
    });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (req.user.role !== 'SUPER_ADMIN' && target.organizationId !== req.user.organizationId) {
      res.status(403).json({ error: 'You can only reset passwords for users in your organization' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and invalidate all existing sessions for the user
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } }),
      prisma.refreshToken.deleteMany({ where: { userId: req.params.id } }),
    ]);

    await notifyOrgOwnersOfSensitiveUserAction(
      target.organizationId,
      { email: target.email, firstName: target.firstName, lastName: target.lastName },
      'Password was reset by an administrator',
      `${req.user.firstName ?? 'System'} ${req.user.lastName ?? ''}`.trim() || 'System Administrator',
    );

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
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, organizationId: true, email: true, firstName: true, lastName: true },
    });

    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (req.user.role !== 'SUPER_ADMIN' && target.organizationId !== req.user.organizationId) {
      res.status(403).json({ error: 'You can only manage user status inside your organization' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive },
      select: { id: true, email: true, isActive: true, firstName: true, lastName: true },
    });
    // If deactivating, also kill all their sessions
    if (!isActive) {
      await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });
    }

    await notifyOrgOwnersOfSensitiveUserAction(
      target.organizationId,
      { email: user.email, firstName: user.firstName, lastName: user.lastName },
      isActive ? 'User account reactivated' : 'User account deactivated',
      `${req.user.firstName ?? 'System'} ${req.user.lastName ?? ''}`.trim() || 'System Administrator',
    );

    res.json(user);
  } catch (err) { next(err); }
});

// ── POST /users/invite — ADMIN/SUPER_ADMIN: invite user by email ──────────────
// If user already exists → add membership; if new → create with temp password + send setup link
router.post('/invite', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const { email, role, roles, firstName, lastName } = req.body;
    const requestedRoles = Array.isArray(roles) && roles.length ? roles : [role].filter(Boolean);
    if (!email || !requestedRoles.length) {
      res.status(400).json({ error: 'email and at least one role are required' });
      return;
    }
    if (requestedRoles.includes('SUPER_ADMIN')) {
      res.status(403).json({ error: 'SUPER_ADMIN role cannot be invited' });
      return;
    }
    if (requestedRoles.includes('ADMIN') && req.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only SUPER_ADMIN can invite ADMIN users' });
      return;
    }

    const appUrl = process.env.APP_URL ?? 'https://articvms.ddnsgeek.com';
    const orgId  = req.user.organizationId;
    const org    = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    const primaryRole = requestedRoles[0];
    const pendingRoles = requestedRoles.length > 1 ? requestedRoles.slice(1) : [];

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
        data:  { role: primaryRole as any, roles: [primaryRole], pendingRoles },
      });
      const membershipRole = primaryRole === 'ADMIN' ? 'COMPANY_ADMIN' : primaryRole as any;
      await prisma.membership.upsert({
        where: {
          userId_organizationId: {
            userId: targetUser.id,
            organizationId: orgId,
          },
        },
        update: {
          role: membershipRole,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
        create: {
          userId: targetUser.id,
          organizationId: orgId,
          role: membershipRole,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      });

      sendInvitationEmail(targetUser.email, targetUser.firstName, org?.name ?? 'ARTIC VMS', primaryRole, `${appUrl}/login`, null)
        .catch(e => logger.warn(`[INVITE] Email failed: ${e.message}`));
      await notifyOrgOwnersOfSensitiveUserAction(
        orgId,
        { email: targetUser.email, firstName: targetUser.firstName, lastName: targetUser.lastName },
        'User access was updated via invitation workflow',
        `${req.user.firstName ?? 'System'} ${req.user.lastName ?? ''}`.trim() || 'System Administrator',
      );
      logger.info(`[INVITE] Existing user ${email} primary role updated to ${primaryRole} in org ${orgId}`);
      res.json({ message: `${targetUser.firstName}'s access has been updated. Additional roles are pending Super Admin approval.`, type: 'existing' });
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
            role:           primaryRole as any,
            roles:          [primaryRole],
            pendingRoles,
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
            role:           primaryRole === 'ADMIN' ? 'COMPANY_ADMIN' : primaryRole as any,
            status:         'ACTIVE',
            acceptedAt:     new Date(),
          },
        }).catch(() => {}); // non-fatal if membership model differs
        return newUser;
      });

      const setupUrl = `${appUrl}/reset-password?token=${rawToken}&setup=1`;
      sendInvitationEmail(email, resolvedFirst, org?.name ?? 'ARTIC VMS', primaryRole, setupUrl, rawToken)
        .catch(e => logger.warn(`[INVITE] Email failed: ${e.message}`));
      await notifyOrgOwnersOfSensitiveUserAction(
        orgId,
        { email, firstName: resolvedFirst, lastName: resolvedLast },
        'New user account created via invitation workflow',
        `${req.user.firstName ?? 'System'} ${req.user.lastName ?? ''}`.trim() || 'System Administrator',
      );
      logger.info(`[INVITE] New user invited: ${email} to org ${orgId} as ${primaryRole}`);
      res.status(201).json({ message: `Invitation sent to ${email}. Any additional access roles remain pending Super Admin approval or active subscription unlock.`, type: 'new' });
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
