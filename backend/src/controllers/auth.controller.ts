import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { loginUser, refreshAccessToken, logoutUser } from '../services/auth.service';
import { sendPasswordResetEmail, sendPasswordChangedEmail, sendWelcomeEmail, sendNewRegistrationAlert } from '../services/email.service';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

// ── Register — create a new organization + admin account ─────────────────────
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { orgName, firstName, lastName, email, password, country, currency } = req.body;

    if (!orgName || !firstName || !lastName || !email || !password) {
      throw new AppError(400, 'orgName, firstName, lastName, email and password are required');
    }
    if (password.length < 8) throw new AppError(400, 'Password must be at least 8 characters');

    // Check email not already taken
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw new AppError(409, 'An account with this email already exists');

    // Generate a slug from org name
    const slug = orgName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50)
      + '-' + crypto.randomBytes(3).toString('hex');

    const passwordHash = await bcrypt.hash(password, 12);

    // Create org + admin user in a transaction
    const { org, user } = await prisma.$transaction(async tx => {
      const org = await tx.organization.create({
        data: {
          name:     orgName.trim(),
          slug,
          country:  country  ?? 'Rwanda',
          currency: currency ?? 'RWF',
          email:    email.toLowerCase(),
          status:   'PENDING',   // awaits Super Admin approval
        },
      });
      const user = await tx.user.create({
        data: {
          email:        email.toLowerCase(),
          passwordHash,
          firstName:    firstName.trim(),
          lastName:     lastName.trim(),
          role:         'ADMIN',
          organizationId: org.id,
        },
      });
      // Create active membership in the new identity system
      await tx.membership.create({
        data: {
          userId:         user.id,
          organizationId: org.id,
          role:           'COMPANY_ADMIN',
          status:         'ACTIVE',
          acceptedAt:     new Date(),
        },
      });
      return { org, user };
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.firstName).catch(err =>
      logger.warn(`[AUTH] Welcome email failed: ${err.message}`)
    );

    // FIX #7: Notify ALL super admins (not just the first one)
    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true },
      select: { email: true },
    });
    for (const sa of superAdmins) {
      sendNewRegistrationAlert(sa.email, org.name, `${user.firstName} ${user.lastName}`, org.id)
        .catch(err => logger.warn(`[AUTH] Super Admin notification failed: ${err.message}`));
    }

    // FIX #9: loginUser is already statically imported — use it directly (no dynamic re-import)
    const result = await loginUser(email, password);

    logger.info(`[AUTH] New organization registered (PENDING approval): ${org.name} (${org.id})`);
    res.status(201).json({ ...result, orgStatus: 'PENDING' });
  } catch (err) { next(err); }
}

// ── Register personal — no org required ──────────────────────────────────────
// Creates a standalone user with no organizationId.
// intendedRole: 'owner' | 'driver' | 'customer' — stored for onboarding flow.
export async function registerPersonal(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, email, password, phone, intendedRole } = req.body;

    if (!firstName || !lastName || !email || !password) {
      throw new AppError(400, 'firstName, lastName, email and password are required');
    }
    if (password.length < 8) throw new AppError(400, 'Password must be at least 8 characters');

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw new AppError(409, 'An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, 12);

    // Map intendedRole to a UserRole — personal users get VIEWER by default
    // until they complete onboarding and get assigned to an org/fleet
    const roleMap: Record<string, string> = {
      owner:    'VIEWER',
      driver:   'DRIVER',
      customer: 'VIEWER',
    };
    const userRole = roleMap[intendedRole] ?? 'VIEWER';

    // Personal users need a "personal" org — or we allow null organizationId.
    // Current schema requires organizationId so we create a placeholder personal org.
    const slug = `personal-${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}-${crypto.randomBytes(3).toString('hex')}`;

    const { user } = await prisma.$transaction(async tx => {
      // Create a minimal personal org (not shown in platform list, status=ACTIVE)
      const org = await tx.organization.create({
        data: {
          name:   `${firstName} ${lastName}`,
          slug,
          country: 'Rwanda',
          currency: 'RWF',
          email:  email.toLowerCase(),
          status: 'ACTIVE',  // personal accounts are immediately active
        },
      });
      const user = await tx.user.create({
        data: {
          email:         email.toLowerCase(),
          passwordHash,
          firstName:     firstName.trim(),
          lastName:      lastName.trim(),
          phone:         phone ?? null,
          role:          userRole as any,
          organizationId: org.id,
        },
      });
      // FIX #5: Create Membership record for personal users (same as company path)
      await tx.membership.create({
        data: {
          userId:         user.id,
          organizationId: org.id,
          role:           userRole === 'DRIVER' ? 'DRIVER' : 'VIEWER' as any,
          status:         'ACTIVE',
          acceptedAt:     new Date(),
        },
      }).catch(() => {}); // non-fatal
      return { user, org };
    });

    // Send welcome email
    sendWelcomeEmail(user.email, user.firstName).catch(err =>
      logger.warn(`[AUTH] Welcome email failed: ${err.message}`)
    );

    // Auto-login
    const result = await loginUser(email, password);
    // Store intended role in metadata (used by onboarding page)
    logger.info(`[AUTH] Personal account registered: ${email} (${intendedRole})`);
    res.status(201).json({ ...result, intendedRole: intendedRole ?? null });
  } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError(400, 'Email and password required');
    const result = await loginUser(email, password);
    res.json(result);
  } catch (err) { next(err); }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError(400, 'Refresh token required');
    const result = await refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err) { next(err); }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await logoutUser(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, avatarUrl: true, lastLoginAt: true,
        organization: { select: { id: true, name: true, slug: true, status: true } },
      },
    });
    if (!user) throw new AppError(404, 'User not found');
    res.json(user);
  } catch (err) { next(err); }
}

export async function changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new AppError(400, 'Both passwords required');
    if (newPassword.length < 8) throw new AppError(400, 'New password must be at least 8 characters');

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw new AppError(404, 'User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError(401, 'Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    // Send confirmation email (non-blocking)
    sendPasswordChangedEmail(user.email, user.firstName).catch(err =>
      logger.warn(`[AUTH] Failed to send password-changed email: ${err.message}`)
    );

    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (err) { next(err); }
}

// ── Forgot password ───────────────────────────────────────────────────────────
// Always returns the same response regardless of whether the email exists,
// so this endpoint cannot be used to enumerate valid accounts.
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  const GENERIC_RESPONSE = { message: 'If that email is registered, a reset link has been sent.' };
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.json(GENERIC_RESPONSE);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, firstName: true, isActive: true },
    });

    // Silently succeed if user not found or inactive — do not reveal either
    if (!user || !user.isActive) {
      res.json(GENERIC_RESPONSE);
      return;
    }

    // Delete any existing unexpired tokens for this user (one active token at a time)
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Generate a cryptographically random token (32 bytes = 64 hex chars)
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    // Send email — non-blocking so a slow SMTP server doesn't hang the response
    sendPasswordResetEmail(user.email, user.firstName, rawToken).catch(err =>
      logger.error(`[AUTH] Failed to send password-reset email to ${user.email}: ${err.message}`)
    );

    res.json(GENERIC_RESPONSE);
  } catch (err) { next(err); }
}

// ── Reset password ────────────────────────────────────────────────────────────
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw new AppError(400, 'Token and newPassword are required');
    }
    if (newPassword.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters');
    }

    // Hash the incoming raw token to look it up — never store raw tokens
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, firstName: true, isActive: true } } },
    });

    if (!record || record.used || record.expiresAt < new Date() || !record.user.isActive) {
      throw new AppError(400, 'This reset link is invalid or has expired. Please request a new one.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password, mark token used, kill all sessions — all in one transaction
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
      prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    // Send confirmation email
    sendPasswordChangedEmail(record.user.email, record.user.firstName).catch(err =>
      logger.warn(`[AUTH] Failed to send password-changed confirmation: ${err.message}`)
    );

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) { next(err); }
}
