/**
 * Membership Service
 * Handles multi-company membership: invite, accept, list, suspend, end.
 * Coexists with the legacy User.organizationId — existing code is unaffected.
 */
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { sendWelcomeEmail } from './email.service';
import logger from '../utils/logger';

// ── Feature key constants (source of truth for entitlement checks) ────────────
export const FEATURES = {
  GPS:           'fleet.gps',
  VEHICLES:      'fleet.vehicles',
  DRIVERS:       'fleet.drivers',
  ALERTS:        'alerts',
  MAINTENANCE:   'maintenance',
  FINANCE:       'finance.contracts',
  EXPENSES:      'finance.expenses',
  ACCOUNTING:    'finance.accounting',
  REPORTS:       'reports',
  AI_ASSISTANT:  'ai.assistant',
  GEOFENCES:     'fleet.geofences',
  DOCUMENTS:     'documents',
} as const;

export type FeatureKey = typeof FEATURES[keyof typeof FEATURES];

// ── Check if an org has an active entitlement for a feature ──────────────────
export async function hasEntitlement(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<boolean> {
  const e = await prisma.entitlement.findFirst({
    where: {
      organizationId,
      featureKey,
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  return !!e;
}

// ── Get all active entitlements for an org ────────────────────────────────────
export async function getOrgEntitlements(organizationId: string): Promise<string[]> {
  const entries = await prisma.entitlement.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { featureKey: true },
  });
  return entries.map(e => e.featureKey);
}

// ── Get a user's active membership in a specific org ─────────────────────────
export async function getUserMembership(userId: string, organizationId: string) {
  return prisma.membership.findFirst({
    where: { userId, organizationId, status: 'ACTIVE' },
    include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });
}

// ── Get all memberships for a user ────────────────────────────────────────────
export async function getUserMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId, status: { in: ['ACTIVE', 'INVITED'] } },
    include: {
      organization: { select: { id: true, name: true, slug: true, logoUrl: true, country: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

// ── Invite a user to an org (creates or reuses existing account) ─────────────
export async function inviteMember(params: {
  invitedByUserId: string;
  organizationId:  string;
  email:           string;
  role:            string;
  firstName?:      string;
  lastName?:       string;
}) {
  const { invitedByUserId, organizationId, email, role, firstName, lastName } = params;

  // Find or create the user
  let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  let isNew = false;

  if (!user) {
    if (!firstName || !lastName) {
      throw new AppError(400, 'firstName and lastName are required when inviting a new user');
    }
    // Create a placeholder account — user will set their password via reset-password flow
    const crypto = await import('crypto');
    const tempHash = await (await import('bcryptjs')).hash(
      crypto.randomBytes(32).toString('hex'), 10,
    );
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: tempHash,
        firstName,
        lastName,
        role: 'VIEWER',
        organizationId, // legacy field — set to invited org
        isActive: true,
      },
    });
    isNew = true;
  }

  // Check for existing membership
  const existing = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId },
  });
  if (existing && existing.status === 'ACTIVE') {
    throw new AppError(409, 'User is already an active member of this organization');
  }

  // Create or update membership
  const membership = existing
    ? await prisma.membership.update({
        where: { id: existing.id },
        data: { role: role as any, status: 'INVITED', invitedById: invitedByUserId, invitedAt: new Date() },
      })
    : await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId,
          role: role as any,
          status: 'INVITED',
          invitedById: invitedByUserId,
        },
      });

  // Send welcome / invitation email
  if (isNew) {
    sendWelcomeEmail(user.email, user.firstName).catch(err =>
      logger.warn(`[MEMBERSHIP] Failed to send welcome email: ${err.message}`)
    );
  }

  await auditLog({
    organizationId,
    userId: invitedByUserId,
    action: 'membership.invite',
    targetType: 'User',
    targetId: user.id,
    after: { email, role, membershipId: membership.id },
  });

  return { membership, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }, isNew };
}

// ── Accept a membership invitation ───────────────────────────────────────────
export async function acceptInvitation(userId: string, organizationId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId, organizationId, status: 'INVITED' },
  });
  if (!membership) throw new AppError(404, 'No pending invitation found');

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { status: 'ACTIVE', acceptedAt: new Date() },
  });

  await auditLog({
    organizationId,
    userId,
    action: 'membership.accept',
    targetType: 'Membership',
    targetId: membership.id,
  });

  return updated;
}

// ── Suspend or end a membership ───────────────────────────────────────────────
export async function updateMembershipStatus(
  membershipId: string,
  status: 'SUSPENDED' | 'ENDED',
  actorUserId: string,
  reason?: string,
) {
  const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new AppError(404, 'Membership not found');

  const data: any = { status };
  if (status === 'SUSPENDED') { data.suspendedAt = new Date(); data.suspendReason = reason; }
  if (status === 'ENDED')     { data.endedAt = new Date(); }

  const updated = await prisma.membership.update({ where: { id: membershipId }, data });

  await auditLog({
    organizationId: membership.organizationId,
    userId: actorUserId,
    action: `membership.${status.toLowerCase()}`,
    targetType: 'Membership',
    targetId: membershipId,
    after: { status, reason },
  });

  return updated;
}

// ── Grant an entitlement to an org (Super Admin only) ─────────────────────────
export async function grantEntitlement(params: {
  organizationId: string;
  featureKey:     string;
  grantedById:    string;
  subscriptionId?: string;
  expiresAt?:     Date;
  usageLimit?:    number;
  metadata?:      object;
}) {
  const { organizationId, featureKey, grantedById, subscriptionId, expiresAt, usageLimit, metadata } = params;

  const entitlement = await prisma.entitlement.upsert({
    where:  { organizationId_featureKey: { organizationId, featureKey } },
    create: { organizationId, featureKey, grantedById, subscriptionId, expiresAt, usageLimit, metadata: metadata as any, status: 'ACTIVE' },
    update: { status: 'ACTIVE', grantedById, expiresAt, usageLimit, metadata: metadata as any, updatedAt: new Date() },
  });

  await auditLog({
    organizationId,
    userId: grantedById,
    action: 'entitlement.grant',
    targetType: 'Entitlement',
    targetId: entitlement.id,
    after: { featureKey, expiresAt, usageLimit },
  });

  return entitlement;
}

// ── Revoke an entitlement ─────────────────────────────────────────────────────
export async function revokeEntitlement(
  organizationId: string,
  featureKey: string,
  actorUserId: string,
) {
  const existing = await prisma.entitlement.findFirst({ where: { organizationId, featureKey } });
  if (!existing) throw new AppError(404, 'Entitlement not found');

  const updated = await prisma.entitlement.update({
    where: { id: existing.id },
    data: { status: 'REVOKED' },
  });

  await auditLog({
    organizationId,
    userId: actorUserId,
    action: 'entitlement.revoke',
    targetType: 'Entitlement',
    targetId: existing.id,
    after: { featureKey, status: 'REVOKED' },
  });

  return updated;
}

// ── Activate a subscription + grant plan features to an org ──────────────────
export async function activateSubscription(params: {
  organizationId: string;
  planId:         string;
  actorUserId:    string;
  seats?:         number;
  trialDays?:     number;
  notes?:         string;
}) {
  const { organizationId, planId, actorUserId, seats, trialDays, notes } = params;

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(404, 'Plan not found');

  const trialEndsAt = trialDays != null
    ? new Date(Date.now() + trialDays * 86400000)
    : plan.trialDays > 0 ? new Date(Date.now() + plan.trialDays * 86400000) : null;

  const subscription = await prisma.subscription.upsert({
    where:  { organizationId },
    create: {
      organizationId, planId,
      status:   trialEndsAt ? 'TRIAL' : 'ACTIVE',
      seats:    seats ?? plan.includedSeats,
      trialEndsAt,
      notes,
      currentPeriodStart: new Date(),
      currentPeriodEnd:   new Date(Date.now() + 30 * 86400000),
    },
    update: {
      planId,
      status:   trialEndsAt ? 'TRIAL' : 'ACTIVE',
      seats:    seats ?? plan.includedSeats,
      trialEndsAt,
      notes,
      currentPeriodStart: new Date(),
      currentPeriodEnd:   new Date(Date.now() + 30 * 86400000),
    },
  });

  // Grant all features included in this plan
  const features: string[] = Array.isArray(plan.features) ? plan.features as string[] : [];
  await Promise.all(
    features.map(featureKey =>
      grantEntitlement({ organizationId, featureKey, grantedById: actorUserId, subscriptionId: subscription.id })
    )
  );

  await auditLog({
    organizationId,
    userId: actorUserId,
    action: 'subscription.activate',
    targetType: 'Subscription',
    targetId: subscription.id,
    after: { planId, status: subscription.status, seats: subscription.seats },
  });

  return subscription;
}

// ── Internal audit log helper ─────────────────────────────────────────────────
export async function auditLog(params: {
  organizationId?: string;
  userId?:         string;
  action:          string;
  targetType?:     string;
  targetId?:       string;
  before?:         object;
  after?:          object;
  ipAddress?:      string;
}) {
  try {
    await prisma.auditLog.create({ data: params as any });
  } catch (err: any) {
    // Never crash the main request due to an audit failure
    logger.warn(`[AUDIT] Failed to write audit log: ${err.message}`);
  }
}
