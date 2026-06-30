import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../config/database';
import { getPagination, paginatedResponse } from '../middleware/paginate';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export async function listVehicles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, skip } = getPagination(req);
    const search = req.query.search as string | undefined;
    const fleetId = req.query.fleetId as string | undefined;
    const status = req.query.status as string | undefined;

    const where: any = {
      organizationId: req.user!.organizationId,
      ...(search && { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { licensePlate: { contains: search, mode: 'insensitive' } },
      ]}),
      ...(fleetId && { fleetId }),
      ...(status && { status }),
    };

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where, skip, take: limit,
        include: {
          fleet: { select: { id: true, name: true, color: true } },
          lastLocation: true,
          driver: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.vehicle.count({ where }),
    ]);
    res.json(paginatedResponse(vehicles, total, page, limit));
  } catch (err) { next(err); }
}

export async function getVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: {
        fleet: true, lastLocation: true,
        driver: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } },
        _count: { select: { telemetry: true, alerts: true } },
      },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    res.json(vehicle);
  } catch (err) { next(err); }
}

export async function createVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const vehicle = await prisma.vehicle.create({
      data: { ...req.body, organizationId: req.user!.organizationId, deviceToken: uuidv4() },
      include: { fleet: { select: { id: true, name: true } } },
    });
    res.status(201).json(vehicle);
  } catch (err) { next(err); }
}

export async function updateVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.vehicle.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!existing) throw new AppError(404, 'Vehicle not found');
    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id }, data: req.body,
      include: { fleet: { select: { id: true, name: true } } },
    });
    res.json(vehicle);
  } catch (err) { next(err); }
}

export async function deleteVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.vehicle.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!existing) throw new AppError(404, 'Vehicle not found');
    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function regenerateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id }, data: { deviceToken: uuidv4() },
    });
    res.json({ deviceToken: vehicle.deviceToken });
  } catch (err) { next(err); }
}