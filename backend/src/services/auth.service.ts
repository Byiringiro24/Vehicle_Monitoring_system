import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { jwtConfig } from '../config/jwt';
import { AppError } from '../middleware/errorHandler';
import { JwtPayload } from '../types';

function mapMembershipRoleToLegacyRole(role?: string | null) {
  switch (role) {
    case 'COMPANY_OWNER':
    case 'COMPANY_ADMIN':
      return 'ADMIN';
    case 'FLEET_MANAGER':
      return 'FLEET_MANAGER';
    case 'DISPATCHER':
      return 'DISPATCHER';
    case 'FINANCE_MANAGER':
    case 'ACCOUNTANT':
      return 'FINANCE_MANAGER';
    case 'HR_MANAGER':
      return 'HR_MANAGER';
    case 'MECHANIC':
      return 'MECHANIC';
    case 'DRIVER':
      return 'DRIVER';
    case 'SAFETY_OFFICER':
      return 'COMPLIANCE_OFFICER';
    case 'AUDITOR':
    case 'CUSTOMER':
    case 'SUPPLIER':
    case 'VIEWER':
      return 'VIEWER';
    default:
      return 'VIEWER';
  }
}

function normalizeRoleList(roles?: Array<string | null | undefined>) {
  const set = new Set<string>();
  for (const role of roles ?? []) {
    if (role) set.add(role);
  }
  return Array.from(set);
}

async function getEffectiveUserRoles(userId: string, organizationId: string, fallbackRole: any, userRoles?: string[], pendingRoles?: string[]) {
  const roleSet = new Set<string>();

  for (const role of normalizeRoleList(userRoles)) {
    roleSet.add(role);
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscription: { select: { status: true } } },
  });

  if (Array.isArray(pendingRoles) && pendingRoles.length && org?.subscription?.status === 'ACTIVE') {
    for (const role of pendingRoles) roleSet.add(role);
  }

  const memberships = await prisma.membership.findMany({
    where: { userId, organizationId, status: 'ACTIVE' },
    select: { role: true },
  });

  for (const membership of memberships) {
    roleSet.add(mapMembershipRoleToLegacyRole(membership.role));
  }

  if (roleSet.size === 0 && fallbackRole) roleSet.add(String(fallbackRole));

  return Array.from(roleSet) as string[];
}

async function getEffectiveUserRole(userId: string, organizationId: string, fallbackRole: any, userRoles?: string[], pendingRoles?: string[]) {
  const roles = await getEffectiveUserRoles(userId, organizationId, fallbackRole, userRoles, pendingRoles);
  return roles[0] ?? fallbackRole;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
  });
  if (!user || !user.isActive) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const activeRoles = await getEffectiveUserRoles(user.id, user.organizationId, user.role, user.roles ?? [], user.pendingRoles ?? []);
  const activeRole = (activeRoles[0] ?? user.role) as any;

  const payload: JwtPayload = {
    userId: user.id, email: user.email,
    role: activeRole, roles: activeRoles as any, pendingRoles: user.pendingRoles ?? [], organizationId: user.organizationId,
  };
  const accessToken = jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn } as jwt.SignOptions);
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

  return {
    accessToken, refreshToken,
    user: {
      id: user.id, email: user.email, firstName: user.firstName,
      lastName: user.lastName, role: activeRole, roles: activeRoles,
      pendingRoles: user.pendingRoles ?? [], phone: user.phone,
      organization: user.organization,
    },
  };
}

export async function refreshAccessToken(token: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token }, include: { user: true },
  });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError(401, 'Refresh token invalid or expired');
  }

  const activeRoles = await getEffectiveUserRoles(stored.user.id, stored.user.organizationId, stored.user.role, stored.user.roles ?? [], stored.user.pendingRoles ?? []);
  const activeRole = (activeRoles[0] ?? stored.user.role) as any;

  const payload: JwtPayload = {
    userId: stored.user.id, email: stored.user.email,
    role: activeRole, roles: activeRoles as any, pendingRoles: stored.user.pendingRoles ?? [], organizationId: stored.user.organizationId,
  };
  const accessToken = jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn } as jwt.SignOptions);
  return { accessToken };
}

export async function switchUserOrganization(userId: string, organizationId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
  });

  if (!user) throw new AppError(404, 'User not found');

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const hasAccess = isSuperAdmin || !!await prisma.membership.findFirst({
    where: { userId, organizationId, status: 'ACTIVE' },
  });

  if (!hasAccess) {
    throw new AppError(403, 'You do not have access to this organization');
  }

  const nextRoles = isSuperAdmin ? ['SUPER_ADMIN'] : await getEffectiveUserRoles(userId, organizationId, user.role, user.roles ?? [], user.pendingRoles ?? []);
  const nextRole = (nextRoles[0] ?? user.role) as any;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { organizationId, role: nextRole as any, roles: nextRoles as any },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      roles: true,
      pendingRoles: true,
      phone: true,
      organizationId: true,
      organization: { select: { id: true, name: true, slug: true, status: true } },
    },
  });

  const payload: JwtPayload = {
    userId: updatedUser.id,
    email: updatedUser.email,
    role: nextRole,
    roles: nextRoles as any,
    pendingRoles: updatedUser.pendingRoles ?? [],
    organizationId: updatedUser.organizationId,
  };

  const accessToken = jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn } as jwt.SignOptions);
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { token: refreshToken, userId: updatedUser.id, expiresAt } });

  return {
    accessToken,
    refreshToken,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: nextRole,
      roles: nextRoles,
      pendingRoles: updatedUser.pendingRoles ?? [],
      phone: updatedUser.phone,
      organization: user.organization,
    },
  };
}

export async function logoutUser(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}