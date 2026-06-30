import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { jwtConfig } from '../config/jwt';
import { AppError } from '../middleware/errorHandler';
import { JwtPayload } from '../types';

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
  if (!user || !user.isActive) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const payload: JwtPayload = {
    userId: user.id, email: user.email,
    role: user.role, organizationId: user.organizationId,
  };
  const accessToken = jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn } as jwt.SignOptions);
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

  return {
    accessToken, refreshToken,
    user: {
      id: user.id, email: user.email, firstName: user.firstName,
      lastName: user.lastName, role: user.role, organization: user.organization,
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
  const payload: JwtPayload = {
    userId: stored.user.id, email: stored.user.email,
    role: stored.user.role, organizationId: stored.user.organizationId,
  };
  const accessToken = jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn } as jwt.SignOptions);
  return { accessToken };
}

export async function logoutUser(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}