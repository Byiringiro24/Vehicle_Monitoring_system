import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { getVehicleTelemetry, getLatestTelemetry, processTelemetry } from '../services/telemetry.service';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export async function getTelemetry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { vehicleId } = req.params;
    const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const limit = parseInt(req.query.limit as string ?? '1000', 10);
    const data = await getVehicleTelemetry(vehicleId, from, to, limit);
    res.json({ data, from, to });
  } catch (err) { next(err); }
}

export async function getLatest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await getLatestTelemetry(req.params.vehicleId);
    res.json(data);
  } catch (err) { next(err); }
}

export async function ingestHttp(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { deviceToken: req.params.token },
    });
    if (!vehicle) throw new AppError(401, 'Invalid device token');
    const record = await processTelemetry(vehicle.id, req.body);
    res.status(201).json(record);
  } catch (err) { next(err); }
}

export async function getFleetLocations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const locations = await prisma.lastLocation.findMany({
      where: { vehicle: { organizationId: req.user!.organizationId } },
      include: {
        vehicle: { select: { id: true, name: true, licensePlate: true, status: true,
          fleet: { select: { id: true, name: true, color: true } } } },
      },
    });
    res.json(locations);
  } catch (err) { next(err); }
}