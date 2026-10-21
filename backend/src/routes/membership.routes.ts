/**
 * /api/v1/memberships
 * Manages multi-company membership: invite, accept, list, suspend, end.
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  inviteMember, acceptInvitation, updateMembershipStatus,
  getUserMemberships, auditLog,
} from '../services/membership.service';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// ── GET /memberships/me — get current user's memberships ──────────────────────
router.get('/me', async (req: any, res, next) => {
  try {
    const memberships = await getUserMemberships(req.user.userId);
    res.json(memberships);
  } catch (err) { next(err); }
});

// ── GET /memberships — list members of caller's org ───────────────────────────
router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const members = await prisma.membership.findMany({
      where: { organizationId: req.user.organizationId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, lastLoginAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch (err) { next(err); }
});

// ── POST /memberships/invite — invite a user to the caller's org ──────────────
router.post('/invite', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const { email, role, firstName, lastName } = req.body;
    if (!email || !role) throw new AppError(400, 'email and role are required');

    const result = await inviteMember({
      invitedByUserId: req.user.userId,
      organizationId:  req.user.organizationId,
      email, role, firstName, lastName,
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// ── POST /memberships/:id/accept — accept an invitation ──────────────────────
router.post('/:id/accept', async (req: any, res, next) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership || membership.userId !== req.user.userId) {
      throw new AppError(403, 'You cannot accept this invitation');
    }
    const updated = await acceptInvitation(req.user.userId, membership.organizationId);
    res.json(updated);
  } catch (err) { next(err); }
});

// ── PATCH /memberships/:id — suspend or end a membership ─────────────────────
router.patch('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req: any, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['SUSPENDED', 'ENDED'].includes(status)) {
      throw new AppError(400, 'status must be SUSPENDED or ENDED');
    }
    // Verify the membership belongs to the caller's org (unless SUPER_ADMIN)
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership) throw new AppError(404, 'Membership not found');
    if (req.user.role !== 'SUPER_ADMIN' && membership.organizationId !== req.user.organizationId) {
      throw new AppError(403, 'Cannot modify memberships outside your organization');
    }
    const updated = await updateMembershipStatus(req.params.id, status, req.user.userId, reason);
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
