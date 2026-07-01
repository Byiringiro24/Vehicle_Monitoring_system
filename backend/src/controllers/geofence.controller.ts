import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export async function listGeofences(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const geofences = await prisma.geofence.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { _count: { select: { events: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(geofences);
  } catch (err) { next(err); }
}

export async function createGeofence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const geo = await prisma.geofence.create({
      data: { ...req.body, organizationId: req.user!.organizationId },
    });
    res.status(201).json(geo);
  } catch (err) { next(err); }
}

export async function updateGeofence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.geofence.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!existing) throw new AppError(404, 'Geofence not found');
    const geo = await prisma.geofence.update({ where: { id: req.params.id }, data: req.body });
    res.json(geo);
  } catch (err) { next(err); }
}

export async function deleteGeofence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.geofence.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!existing) throw new AppError(404, 'Geofence not found');
    await prisma.geofence.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function getGeofenceEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const events = await prisma.geofenceEvent.findMany({
      where: {
        geofenceId: req.params.id,
        geofence: { organizationId: req.user!.organizationId },
      },
      include: { vehicle: { select: { name: true, licensePlate: true } } },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
    res.json(events);
  } catch (err) { next(err); }
}