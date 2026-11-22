/**
 * /api/v1/auth/verify-email
 *
 * Flow for phone-only accounts that want to link a real email:
 *
 * 1. POST /auth/verify-email/request  { email }
 *    — authenticated. Generates a 6-digit OTP, stores its hash + expiry + pending email,
 *      sends OTP to the proposed email. Does NOT change the account email yet.
 *
 * 2. POST /auth/verify-email/confirm  { otp }
 *    — authenticated. Checks OTP hash + expiry.
 *      If valid: sets email = pendingEmail, emailVerified = true, clears token fields.
 *      From this point the user can log in with the new email.
 *
 * Also:
 * GET /auth/verify-email/status  — returns whether email is verified for current user.
 */

import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { sendEmailVerificationOTP } from '../services/email.service';
import logger from '../utils/logger';

const router = Router();
router.use(authenticate as any);

// ── GET /auth/verify-email/status ─────────────────────────────────────────────
router.get('/status', async (req: any, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        email: true,
        emailVerified: true,
        emailVerificationPending: true,
        phone: true,
      },
    });
    if (!user) throw new AppError(404, 'User not found');

    const isPlaceholder = user.email.includes('@placeholder.local');
    res.json({
      email:               isPlaceholder ? null : user.email,
      emailVerified:       isPlaceholder ? false : (user as any).emailVerified,
      hasPlaceholderEmail: isPlaceholder,
      pendingEmail:        (user as any).emailVerificationPending ?? null,
      phone:               user.phone,
    });
  } catch (err) { next(err); }
});

// ── POST /auth/verify-email/request ──────────────────────────────────────────
router.post('/request', async (req: any, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      throw new AppError(400, 'A valid email address is required');
    }

    // Check email isn't already taken by another real account
    const existing = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        id: { not: req.user.userId },
      },
    });
    if (existing && !existing.email.includes('@placeholder.local')) {
      throw new AppError(409, 'This email address is already in use by another account');
    }

    // Generate a 6-digit OTP
    const otp      = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash  = crypto.createHash('sha256').update(otp).digest('hex');
    const expiry   = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store hashed OTP + pending email (don't change real email yet)
    await (prisma.user as any).update({
      where: { id: req.user.userId },
      data: {
        emailVerificationToken:   otpHash,
        emailVerificationExpiry:  expiry,
        emailVerificationPending: email.toLowerCase(),
      },
    });

    // Get user name for the email
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { firstName: true },
    });

    // Send OTP to the proposed email
    await sendEmailVerificationOTP(email.toLowerCase(), user?.firstName ?? 'there', otp);
    logger.info(`[EMAIL-VERIFY] OTP sent to ${email} for user ${req.user.userId}`);

    res.json({
      message: `A 6-digit verification code has been sent to ${email}. It expires in 15 minutes.`,
      pendingEmail: email.toLowerCase(),
    });
  } catch (err) { next(err); }
});

// ── POST /auth/verify-email/confirm ──────────────────────────────────────────
router.post('/confirm', async (req: any, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) throw new AppError(400, 'Verification code is required');

    const user = await (prisma.user as any).findUnique({
      where: { id: req.user.userId },
      select: {
        id: true, firstName: true,
        emailVerificationToken:   true,
        emailVerificationExpiry:  true,
        emailVerificationPending: true,
      },
    });

    if (!user) throw new AppError(404, 'User not found');
    if (!user.emailVerificationToken || !user.emailVerificationPending) {
      throw new AppError(400, 'No pending email verification. Request a new code first.');
    }
    if (new Date() > new Date(user.emailVerificationExpiry)) {
      throw new AppError(400, 'Verification code has expired. Please request a new one.');
    }

    const otpHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
    if (otpHash !== user.emailVerificationToken) {
      throw new AppError(400, 'Invalid verification code. Please check and try again.');
    }

    // Check the pending email isn't now taken by someone else (race condition guard)
    const conflict = await prisma.user.findFirst({
      where: {
        email: user.emailVerificationPending,
        id:    { not: req.user.userId },
      },
    });
    if (conflict) {
      throw new AppError(409, 'This email was just registered by another user. Please use a different email.');
    }

    // Promote pending email → real email, mark verified, clear token fields
    const updated = await (prisma.user as any).update({
      where: { id: req.user.userId },
      data: {
        email:                    user.emailVerificationPending,
        emailVerified:            true,
        emailVerificationToken:   null,
        emailVerificationExpiry:  null,
        emailVerificationPending: null,
      },
      select: { id: true, email: true, firstName: true, emailVerified: true },
    });

    logger.info(`[EMAIL-VERIFY] Email verified for user ${req.user.userId}: ${updated.email}`);

    res.json({
      message:       `Email ${updated.email} verified successfully. You can now log in with this email.`,
      email:         updated.email,
      emailVerified: true,
    });
  } catch (err) { next(err); }
});

// ── POST /auth/verify-email/resend ────────────────────────────────────────────
router.post('/resend', async (req: any, res, next) => {
  try {
    const user = await (prisma.user as any).findUnique({
      where: { id: req.user.userId },
      select: {
        firstName: true,
        emailVerificationPending: true,
        emailVerificationExpiry:  true,
      },
    });

    if (!user?.emailVerificationPending) {
      throw new AppError(400, 'No pending email to verify. Use /request first.');
    }

    // Rate limit: don't allow resend within 60 seconds of last send
    if (user.emailVerificationExpiry) {
      const msUntilExpiry = new Date(user.emailVerificationExpiry).getTime() - Date.now();
      const msIssuedAgo   = 15 * 60 * 1000 - msUntilExpiry;
      if (msIssuedAgo < 60_000) {
        throw new AppError(429, 'Please wait at least 60 seconds before requesting a new code.');
      }
    }

    const otp     = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiry  = new Date(Date.now() + 15 * 60 * 1000);

    await (prisma.user as any).update({
      where: { id: req.user.userId },
      data: {
        emailVerificationToken:  otpHash,
        emailVerificationExpiry: expiry,
      },
    });

    await sendEmailVerificationOTP(user.emailVerificationPending, user.firstName ?? 'there', otp);

    res.json({
      message:     `New code sent to ${user.emailVerificationPending}.`,
      pendingEmail: user.emailVerificationPending,
    });
  } catch (err) { next(err); }
});

export default router;
