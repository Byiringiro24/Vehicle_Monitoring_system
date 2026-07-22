import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../config/database';
import { getPagination, paginatedResponse } from '../middleware/paginate';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export async function listVehicles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, skip } = getPagination(req);
    const search   = req.query.search   as string | undefined;
    const fleetId  = req.query.fleetId  as string | undefined;
    const status   = req.query.status   as string | undefined;
    const energyType = req.query.energyType as string | undefined;

    const where: any = {
      organizationId: req.user!.organizationId,
      ...(search && { OR: [
        { name:         { contains: search, mode: 'insensitive' } },
        { licensePlate: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
      ]}),
      ...(fleetId    && { fleetId }),
      ...(status     && { status }),
      ...(energyType && { energyType }),
    };

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where, skip, take: limit,
        include: {
          fleet:          { select: { id: true, name: true, color: true } },
          lastLocation:   true,
          currentDriver:  {
            include: { user: { select: { firstName: true, lastName: true, phone: true } } }
          },
          gpsDevice:      { select: { deviceId: true, status: true, lastCommunication: true } },
          _count:         { select: { telemetry: true, alerts: true, trips: true } },
        },
        orderBy: { licensePlate: 'asc' },
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
        fleet:         true,
        lastLocation:  true,
        gpsDevice:     true,
        currentDriver: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } }
        },
        _count: { select: { telemetry: true, alerts: true, trips: true } },
      },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    res.json(vehicle);
  } catch (err) { next(err); }
}

export async function createVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const {
      purchaseDate, insuranceStart, insuranceExpiry, roadTaxExpiry,
      inspectionExpiry, batteryWarranty, warrantyExpiry,
      // Pull out fields that need type coercion or validation
      year, fuelCapacity, purchasePrice, currentValue, odometer, engineHours,
      horsepower, engineCc, batteryCapacityKwh, chargingSpeedKw, batteryReplaceCost,
      batteryHealth, avgConsumption, minFuelAlert, insurancePremium,
      oilChangeKmInterval, lastServiceOdometer, yearsDriving, baseSalary, commissionRate,
      ...rest
    } = req.body;

    // Required field check
    if (!rest.name)         throw new AppError(400, 'Vehicle name is required');
    if (!rest.licensePlate) throw new AppError(400, 'License plate is required');
    if (!rest.manufacturer) throw new AppError(400, 'Manufacturer is required');
    if (!rest.model)        throw new AppError(400, 'Model is required');
    if (!year)              throw new AppError(400, 'Year is required');

    const vehicle = await prisma.vehicle.create({
      data: {
        ...rest,
        organizationId:   req.user!.organizationId,
        deviceToken:      uuidv4(),
        year:             parseInt(year, 10),
        fuelCapacity:     fuelCapacity     ? parseFloat(fuelCapacity)     : undefined,
        purchasePrice:    purchasePrice    ? parseFloat(purchasePrice)    : undefined,
        currentValue:     currentValue     ? parseFloat(currentValue)     : undefined,
        odometer:         odometer         ? parseFloat(odometer)         : 0,
        engineHours:      engineHours      ? parseFloat(engineHours)      : 0,
        horsepower:       horsepower       ? parseInt(horsepower, 10)     : undefined,
        engineCc:         engineCc         ? parseFloat(engineCc)         : undefined,
        batteryCapacityKwh: batteryCapacityKwh ? parseFloat(batteryCapacityKwh) : undefined,
        chargingSpeedKw:  chargingSpeedKw  ? parseFloat(chargingSpeedKw)  : undefined,
        batteryReplaceCost: batteryReplaceCost ? parseFloat(batteryReplaceCost) : undefined,
        batteryHealth:    batteryHealth    ? parseFloat(batteryHealth)    : undefined,
        avgConsumption:   avgConsumption   ? parseFloat(avgConsumption)   : undefined,
        minFuelAlert:     minFuelAlert     ? parseFloat(minFuelAlert)     : undefined,
        insurancePremium: insurancePremium ? parseFloat(insurancePremium) : undefined,
        oilChangeKmInterval: oilChangeKmInterval ? parseFloat(oilChangeKmInterval) : undefined,
        lastServiceOdometer: lastServiceOdometer ? parseFloat(lastServiceOdometer) : undefined,
        purchaseDate:     purchaseDate     ? new Date(purchaseDate)       : undefined,
        insuranceExpiry:  insuranceExpiry  ? new Date(insuranceExpiry)    : undefined,
        roadTaxExpiry:    roadTaxExpiry    ? new Date(roadTaxExpiry)      : undefined,
        inspectionExpiry: inspectionExpiry ? new Date(inspectionExpiry)   : undefined,
        batteryWarranty:  batteryWarranty  ? new Date(batteryWarranty)    : undefined,
        warrantyExpiry:   warrantyExpiry   ? new Date(warrantyExpiry)     : undefined,
      },
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

    const {
      purchaseDate, insuranceExpiry, roadTaxExpiry, inspectionExpiry,
      transportPermitExpiry, batteryWarranty, warrantyExpiry, nextServiceDate,
      year, fuelCapacity, purchasePrice, currentValue, horsepower, engineCc,
      batteryCapacityKwh, chargingSpeedKw, batteryReplaceCost, batteryHealth,
      avgConsumption, minFuelAlert, insurancePremium, oilChangeKmInterval,
      lastServiceOdometer, odometer, engineHours,
      // Strip read-only / system fields
      id: _id, organizationId: _org, deviceToken: _dt, createdAt: _ca, updatedAt: _ua,
      status: _st, engineLocked: _el, lastLocation: _ll, gpsDevice: _gd,
      currentDriver: _cd, fleet: _fleet, _count: _cnt,
      ...rest
    } = req.body;

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        // Numeric coercions
        ...(year                !== undefined && year !== '' && { year:                parseInt(year, 10) }),
        ...(fuelCapacity        !== undefined && fuelCapacity !== '' && { fuelCapacity:        parseFloat(fuelCapacity) }),
        ...(purchasePrice       !== undefined && purchasePrice !== '' && { purchasePrice:       parseFloat(purchasePrice) }),
        ...(currentValue        !== undefined && currentValue !== '' && { currentValue:        parseFloat(currentValue) }),
        ...(horsepower          !== undefined && horsepower !== '' && { horsepower:          parseInt(horsepower, 10) }),
        ...(engineCc            !== undefined && engineCc !== '' && { engineCc:            parseFloat(engineCc) }),
        ...(batteryCapacityKwh  !== undefined && batteryCapacityKwh !== '' && { batteryCapacityKwh:  parseFloat(batteryCapacityKwh) }),
        ...(chargingSpeedKw     !== undefined && chargingSpeedKw !== '' && { chargingSpeedKw:     parseFloat(chargingSpeedKw) }),
        ...(batteryReplaceCost  !== undefined && batteryReplaceCost !== '' && { batteryReplaceCost:  parseFloat(batteryReplaceCost) }),
        ...(batteryHealth       !== undefined && batteryHealth !== '' && { batteryHealth:       parseFloat(batteryHealth) }),
        ...(avgConsumption      !== undefined && avgConsumption !== '' && { avgConsumption:      parseFloat(avgConsumption) }),
        ...(minFuelAlert        !== undefined && minFuelAlert !== '' && { minFuelAlert:        parseFloat(minFuelAlert) }),
        ...(insurancePremium    !== undefined && insurancePremium !== '' && { insurancePremium:    parseFloat(insurancePremium) }),
        ...(oilChangeKmInterval !== undefined && oilChangeKmInterval !== '' && { oilChangeKmInterval: parseFloat(oilChangeKmInterval) }),
        ...(lastServiceOdometer !== undefined && lastServiceOdometer !== '' && { lastServiceOdometer: parseFloat(lastServiceOdometer) }),
        ...(odometer            !== undefined && odometer !== '' && { odometer:            parseFloat(odometer) }),
        ...(engineHours         !== undefined && engineHours !== '' && { engineHours:         parseFloat(engineHours) }),
        // Date coercions
        ...(purchaseDate          && { purchaseDate:          new Date(purchaseDate) }),
        ...(insuranceExpiry       && { insuranceExpiry:       new Date(insuranceExpiry) }),
        ...(roadTaxExpiry         && { roadTaxExpiry:         new Date(roadTaxExpiry) }),
        ...(inspectionExpiry      && { inspectionExpiry:      new Date(inspectionExpiry) }),
        ...(transportPermitExpiry && { transportPermitExpiry: new Date(transportPermitExpiry) }),
        ...(batteryWarranty       && { batteryWarranty:       new Date(batteryWarranty) }),
        ...(warrantyExpiry        && { warrantyExpiry:        new Date(warrantyExpiry) }),
        ...(nextServiceDate       && { nextServiceDate:       new Date(nextServiceDate) }),
      },
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
      where: { id: req.params.id },
      data: { deviceToken: uuidv4() },
    });
    res.json({ deviceToken: vehicle.deviceToken });
  } catch (err) { next(err); }
}

// ─── GPS History for a vehicle ────────────────────────────────────────────────
export async function getGpsHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { vehicleId } = req.params;
    const from  = req.query.from  ? new Date(req.query.from  as string) : new Date(Date.now() - 86400000);
    const to    = req.query.to    ? new Date(req.query.to    as string) : new Date();
    const limit = Math.min(5000, parseInt(req.query.limit as string ?? '2000', 10));

    // Verify vehicle belongs to org
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId: req.user!.organizationId },
      select: { id: true, name: true, licensePlate: true },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    const history = await prisma.gpsHistory.findMany({
      where: { vehicleId, timestamp: { gte: from, lte: to } },
      orderBy: { timestamp: 'asc' },
      take: limit,
      select: { id: true, latitude: true, longitude: true, speed: true, heading: true, timestamp: true },
    });

    res.json({ vehicle, from, to, points: history, count: history.length });
  } catch (err) { next(err); }
}

// ─── Trips for a vehicle ──────────────────────────────────────────────────────
export async function getTrips(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { vehicleId } = req.params;
    const { page, limit, skip } = getPagination(req);
    const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 86400000);
    const to   = req.query.to   ? new Date(req.query.to   as string) : new Date();

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where: { vehicleId, startTime: { gte: from, lte: to } },
        orderBy: { startTime: 'desc' },
        skip, take: limit,
      }),
      prisma.trip.count({ where: { vehicleId, startTime: { gte: from, lte: to } } }),
    ]);

    res.json(paginatedResponse(trips, total, page, limit));
  } catch (err) { next(err); }
}
