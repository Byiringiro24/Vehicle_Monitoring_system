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

    // Destructure ALL known fields — anything not listed here goes into `rest`
    const {
      // Date fields (need new Date() conversion)
      purchaseDate, insuranceExpiry, roadTaxExpiry, inspectionExpiry,
      transportPermitExpiry, batteryWarranty, warrantyExpiry, nextServiceDate,
      insuranceStart,
      // Numeric fields (need parseFloat/parseInt)
      year, fuelCapacity, purchasePrice, currentValue, horsepower, engineCc,
      batteryCapacityKwh, chargingSpeedKw, batteryReplaceCost, batteryHealth,
      avgConsumption, minFuelAlert, insurancePremium, oilChangeKmInterval,
      lastServiceOdometer, odometer, engineHours,
      // Strip ALL read-only / system / relation fields
      id: _id, organizationId: _org, deviceToken: _dt, createdAt: _ca, updatedAt: _ua,
      status: _st, engineLocked: _el,
      lastLocation: _ll, gpsDevice: _gd, currentDriver: _cd,
      fleet: _fleet, _count: _cnt,
      // Strip relation objects that aren't scalar FK fields
      alerts: _al, telemetry: _tel, trips: _tr, gpsHistory: _gh,
      ...rest
    } = req.body;

    // Build the update data object
    const updateData: any = { ...rest };

    // fleetId empty string → null (disconnect from fleet)
    if (rest.fleetId === '') updateData.fleetId = null;

    // Numeric coercions — only set if provided and not empty
    if (year                != null && year !== '')                updateData.year                = parseInt(String(year), 10);
    if (fuelCapacity        != null && fuelCapacity !== '')        updateData.fuelCapacity        = parseFloat(String(fuelCapacity));
    if (purchasePrice       != null && purchasePrice !== '')       updateData.purchasePrice       = parseFloat(String(purchasePrice));
    if (currentValue        != null && currentValue !== '')        updateData.currentValue        = parseFloat(String(currentValue));
    if (horsepower          != null && horsepower !== '')          updateData.horsepower          = parseInt(String(horsepower), 10);
    if (engineCc            != null && engineCc !== '')            updateData.engineCc            = parseFloat(String(engineCc));
    if (batteryCapacityKwh  != null && batteryCapacityKwh !== '')  updateData.batteryCapacityKwh  = parseFloat(String(batteryCapacityKwh));
    if (chargingSpeedKw     != null && chargingSpeedKw !== '')     updateData.chargingSpeedKw     = parseFloat(String(chargingSpeedKw));
    if (batteryReplaceCost  != null && batteryReplaceCost !== '')  updateData.batteryReplaceCost  = parseFloat(String(batteryReplaceCost));
    if (batteryHealth       != null && batteryHealth !== '')       updateData.batteryHealth       = parseFloat(String(batteryHealth));
    if (avgConsumption      != null && avgConsumption !== '')      updateData.avgConsumption      = parseFloat(String(avgConsumption));
    if (minFuelAlert        != null && minFuelAlert !== '')        updateData.minFuelAlert        = parseFloat(String(minFuelAlert));
    if (insurancePremium    != null && insurancePremium !== '')    updateData.insurancePremium    = parseFloat(String(insurancePremium));
    if (oilChangeKmInterval != null && oilChangeKmInterval !== '') updateData.oilChangeKmInterval = parseFloat(String(oilChangeKmInterval));
    if (lastServiceOdometer != null && lastServiceOdometer !== '') updateData.lastServiceOdometer = parseFloat(String(lastServiceOdometer));
    if (odometer            != null && odometer !== '')            updateData.odometer            = parseFloat(String(odometer));
    if (engineHours         != null && engineHours !== '')         updateData.engineHours         = parseFloat(String(engineHours));

    // Date coercions — only set if non-empty string
    if (purchaseDate          && purchaseDate !== '')          updateData.purchaseDate          = new Date(purchaseDate);
    if (insuranceExpiry       && insuranceExpiry !== '')       updateData.insuranceExpiry       = new Date(insuranceExpiry);
    if (roadTaxExpiry         && roadTaxExpiry !== '')         updateData.roadTaxExpiry         = new Date(roadTaxExpiry);
    if (inspectionExpiry      && inspectionExpiry !== '')      updateData.inspectionExpiry      = new Date(inspectionExpiry);
    if (transportPermitExpiry && transportPermitExpiry !== '') updateData.transportPermitExpiry = new Date(transportPermitExpiry);
    if (batteryWarranty       && batteryWarranty !== '')       updateData.batteryWarranty       = new Date(batteryWarranty);
    if (warrantyExpiry        && warrantyExpiry !== '')        updateData.warrantyExpiry        = new Date(warrantyExpiry);
    if (nextServiceDate       && nextServiceDate !== '')       updateData.nextServiceDate       = new Date(nextServiceDate);

    // Remove any keys that are undefined or not valid Prisma scalar fields
    const knownFields = new Set([
      'name','licensePlate','manufacturer','model','year','color','vin','engineNumber',
      'registrationNumber','fleetNumber','assetTag','vehicleClass','vehicleType','purpose',
      'energyType','fuelCapacity','recommendedFuel','avgConsumption','minFuelAlert',
      'batteryCapacityKwh','chargingSpeedKw','batteryHealth','batteryReplaceCost',
      'engineType','engineCc','horsepower','transmission','driveType',
      'ownershipType','purchaseDate','purchasePrice','currentValue','ownerName',
      'insuranceCompany','insurancePolicyNo','insuranceExpiry','insurancePremium','insuranceCoverage',
      'roadTaxExpiry','inspectionExpiry','transportPermit','transportPermitExpiry',
      'oilChangeKmInterval','lastServiceOdometer','nextServiceDate','tyreBrand','tyreSize',
      'batteryWarranty','warrantyExpiry','odometer','engineHours','fleetId',
      'notes','description',
    ]);

    // Delete any unknown keys to prevent Prisma errors
    for (const key of Object.keys(updateData)) {
      if (!knownFields.has(key)) {
        delete updateData[key];
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: updateData,
      include: { fleet: { select: { id: true, name: true } } },
    });
    res.json(vehicle);
  } catch (err: any) {
    // Log the actual Prisma error for debugging
    if (err?.code) {
      console.error(`[updateVehicle] Prisma error ${err.code}:`, err.message, err.meta);
    }
    next(err);
  }
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
