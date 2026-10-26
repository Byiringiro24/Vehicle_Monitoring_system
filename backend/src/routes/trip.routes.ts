/**
 * /api/v1/trips
 * Trip / dispatch management
 * Accessible to: SUPER_ADMIN, ADMIN, FLEET_MANAGER, DISPATCHER
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate as any);

const DISPATCH_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'DISPATCHER'] as const;

// ── GET /trips — list trips for this org ──────────────────────────────────────
router.get('/', async (req: any, res, next) => {
  try {
    const { status, vehicleId, driverId, date, limit = '50', page = '1' } = req.query;
    const orgId = req.user.organizationId;
    const take  = Math.min(parseInt(limit as string), 100);
    const skip  = (parseInt(page as string) - 1) * take;

    const where: any = { organizationId: orgId };
    if (status)    where.status    = status;
    if (vehicleId) where.vehicleId = vehicleId;
    if (driverId)  where.driverId  = driverId;
    if (date) {
      const d = new Date(date as string);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      where.scheduledAt = { gte: d, lt: next };
    }

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: {
          vehicle: { select: { id: true, name: true, licensePlate: true, status: true } },
        },
        orderBy: { startTime: 'asc' },
        take,
        skip,
      }),
      prisma.trip.count({ where }),
    ]);

    // Enrich with driver info from driverAssignments
    const enriched = await Promise.all(trips.map(async (t: any) => {
      if (!t.driverId) return { ...t, driver: null };
      const driver = await prisma.driver.findUnique({
        where: { id: t.driverId },
        include: { user: { select: { firstName: true, lastName: true, phone: true } } },
      });
      return { ...t, driver };
    }));

    res.json({ data: enriched, total, page: parseInt(page as string), limit: take });
  } catch (err) { next(err); }
});

// ── POST /trips — create a new trip ──────────────────────────────────────────
router.post('/', authorize(...DISPATCH_ROLES) as any, async (req: any, res, next) => {
  try {
    const {
      vehicleId, driverId, scheduledAt, origin, destination,
      purpose, notes, passengerCount,
    } = req.body;

    if (!vehicleId || !scheduledAt) {
      throw new AppError(400, 'vehicleId and scheduledAt are required');
    }

    // Check vehicle belongs to this org
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId: req.user.organizationId },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    const trip = await prisma.trip.create({
      data: {
        vehicleId,
        driverId:         driverId ?? null,
        startTime:        new Date(scheduledAt),
        startAddress:     origin ?? null,
        endAddress:       destination ?? null,
        distanceKm:       0,
        maxSpeedKph:      0,
        avgSpeedKph:      0,
        engineHours:      0,
        idleMinutes:      0,
        // store extra fields in pathPoints JSON as metadata
        pathPoints: {
          purpose:        purpose ?? null,
          notes:          notes ?? null,
          passengerCount: passengerCount ?? null,
          status:         'UNASSIGNED',
          organizationId: req.user.organizationId,
          createdBy:      req.user.userId,
          scheduledAt:    scheduledAt,
        },
      },
      include: {
        vehicle: { select: { id: true, name: true, licensePlate: true } },
      },
    });

    res.status(201).json(trip);
  } catch (err) { next(err); }
});

// ── PATCH /trips/:id/assign — assign driver + vehicle ────────────────────────
router.patch('/:id/assign', authorize(...DISPATCH_ROLES) as any, async (req: any, res, next) => {
  try {
    const { driverId, vehicleId } = req.body;
    const orgId = req.user.organizationId;

    const trip = await prisma.trip.findFirst({
      where: { id: req.params.id, vehicleId: { not: undefined } },
    });
    if (!trip) throw new AppError(404, 'Trip not found');

    // Verify vehicle belongs to org if vehicleId provided
    if (vehicleId) {
      const v = await prisma.vehicle.findFirst({ where: { id: vehicleId, organizationId: orgId } });
      if (!v) throw new AppError(404, 'Vehicle not found in your organization');
    }

    const meta = (trip.pathPoints as any) ?? {};
    const updated = await prisma.trip.update({
      where: { id: req.params.id },
      data: {
        driverId: driverId ?? trip.driverId,
        vehicleId: vehicleId ?? trip.vehicleId,
        pathPoints: { ...meta, status: driverId ? 'ASSIGNED' : meta.status },
      },
      include: {
        vehicle: { select: { id: true, name: true, licensePlate: true } },
      },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// ── PATCH /trips/:id/status — update trip status ─────────────────────────────
router.patch('/:id/status', authorize(...DISPATCH_ROLES) as any, async (req: any, res, next) => {
  try {
    const { status, notes } = req.body;
    const VALID = ['UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!VALID.includes(status)) throw new AppError(400, `status must be one of: ${VALID.join(', ')}`);

    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) throw new AppError(404, 'Trip not found');

    const meta = (trip.pathPoints as any) ?? {};
    const data: any = {
      pathPoints: { ...meta, status, notes: notes ?? meta.notes },
    };
    if (status === 'IN_PROGRESS' && !trip.startTime) data.startTime = new Date();
    if (status === 'COMPLETED')    data.endTime   = new Date();

    const updated = await prisma.trip.update({
      where: { id: req.params.id },
      data,
      include: { vehicle: { select: { id: true, name: true, licensePlate: true } } },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// ── DELETE /trips/:id — cancel a trip ────────────────────────────────────────
router.delete('/:id', authorize(...DISPATCH_ROLES) as any, async (req: any, res, next) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) throw new AppError(404, 'Trip not found');
    const meta = (trip.pathPoints as any) ?? {};
    await prisma.trip.update({
      where: { id: req.params.id },
      data:  { pathPoints: { ...meta, status: 'CANCELLED' } },
    });
    res.json({ message: 'Trip cancelled' });
  } catch (err) { next(err); }
});

export default router;
