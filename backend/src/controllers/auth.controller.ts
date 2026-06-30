import { Request, Response, NextFunction } from 'express';
import { loginUser, refreshAccessToken, logoutUser } from '../services/auth.service';
import { AuthenticatedRequest } from '../types';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    res.json(result);
  } catch (err) { next(err); }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const result = await refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err) { next(err); }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    await logoutUser(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../config/database');
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true,
        phone: true, avatarUrl: true, organization: { select: { id: true, name: true, slug: true } } },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) { next(err); }
}