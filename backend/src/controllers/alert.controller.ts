import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { getAlerts, acknowledgeAlert, resolveAlert } from '../services/alert.service';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export async function listAlerts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await getAlerts(req.user!.organizationId, {
      status: req.query.status as string,
      severity: req.query.severity as string,
      vehicleId: req.query.vehicleId as string,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
      page: parseInt(req.query.page as string ?? '1', 10),
      limit: parseInt(req.query.limit as string ?? '20', 10),
    });
    res.json(result);
  } catch (err) { next(err); }
}

export async function acknowledge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const alert = await acknowledgeAlert(req.params.id, req.user!.userId);
    res.json(alert);
  } catch (err) { next(err); }
}

export async function resolve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const alert = await resolveAlert(req.params.id);
    res.json(alert);
  } catch (err) { next(err); }
}

export async function listRules(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const rules = await prisma.alertRule.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
  } catch (err) { next(err); }
}

export async function createRule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const rule = await prisma.alertRule.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
    });
    res.status(201).json(rule);
  } catch (err) { next(err); }
}

export async function deleteRule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.alertRule.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!existing) throw new AppError(404, 'Rule not found');
    await prisma.alertRule.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}