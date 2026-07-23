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

    // ── All valid scalar fields from the Vehicle Prisma model ─────────────────
    // These are the ONLY keys allowed through to Prisma.update()
    // Grouped exactly as they appear in schema.prisma
    const VEHICLE_SCALAR_FIELDS = new Set([
      // Identity
      'name', 'licensePlate', 'fleetNumber', 'assetTag', 'vin', 'engineNumber', 'registrationNumber',
      // Classification
      'vehicleClass', 'vehicleType', 'purpose', 'manufacturer', 'model', 'year', 'trim', 'color',
      // Energy
      'energyType', 'fuelCapacity', 'recommendedFuel', 'avgConsumption', 'minFuelAlert',
      'fuelCardNumber', 'preferredStation',
      'batteryCapacityKwh', 'batterySerial', 'batteryManufacturer', 'batteryHealth',
      'batteryWarranty', 'chargerType', 'chargingSpeedKw', 'batteryReplaceCost',
      // Engine
      'engineType', 'engineCc', 'horsepower', 'transmission', 'driveType', 'maxSpeedKph',
      // Ownership
      'ownerName', 'ownerCompany', 'ownershipType', 'purchaseDate', 'purchasePrice',
      'currentValue', 'supplierName', 'warrantyExpiry',
      // Insurance
      'insuranceCompany', 'insurancePolicyNo', 'insuranceStart', 'insuranceExpiry',
      'insurancePremium', 'insuranceCoverage', 'insuranceAgent', 'insuranceEmergency',
      // Compliance
      'roadTaxExpiry', 'inspectionExpiry', 'transportPermit', 'transportPermitExpiry',
      'commercialLicense', 'commercialLicExpiry', 'taxiPermit', 'taxiPermitExpiry',
      'roadworthinessCert', 'emissionCert', 'emissionExpiry',
      // Maintenance
      'oilChangeKmInterval', 'nextServiceDate', 'lastServiceDate', 'lastServiceOdometer',
      // Tyres
      'tyreBrand', 'tyreSize', 'tyreFrontLeft', 'tyreFrontRight', 'tyreRearLeft',
      'tyreRearRight', 'tyreSpare', 'tyrePurchaseDate',
      // Documents
      'docRegistrationCard', 'docInsurancePdf', 'docInspectionCert',
      'docPurchaseInvoice', 'docPhoto', 'docOwnershipCert',
      // Odometer / hours
      'odometer', 'engineHours',
      // FK
      'fleetId',
      // Notes
      'notes', 'description',
    ]);

    // ── Date fields — need new Date() conversion ─────────────────────────────
    const DATE_FIELDS = new Set([
      'purchaseDate', 'insuranceStart', 'insuranceExpiry', 'roadTaxExpiry',
      'inspectionExpiry', 'transportPermitExpiry', 'commercialLicExpiry',
      'taxiPermitExpiry', 'emissionExpiry', 'batteryWarranty', 'warrantyExpiry',
      'nextServiceDate', 'lastServiceDate', 'tyrePurchaseDate',
    ]);

    // ── Numeric fields — need parseFloat/parseInt ────────────────────────────
    const INT_FIELDS   = new Set(['year', 'horsepower']);
    const FLOAT_FIELDS = new Set([
      'fuelCapacity', 'avgConsumption', 'minFuelAlert', 'batteryCapacityKwh',
      'chargingSpeedKw', 'batteryHealth', 'batteryReplaceCost', 'engineCc',
      'maxSpeedKph', 'purchasePrice', 'currentValue', 'insurancePremium',
      'oilChangeKmInterval', 'lastServiceOdometer', 'odometer', 'engineHours',
    ]);

    const body = req.body as Record<string, any>;
    const updateData: Record<string, any> = {};

    for (const [key, value] of Object.entries(body)) {
      // Skip unknown / relation / system fields
      if (!VEHICLE_SCALAR_FIELDS.has(key)) continue;

      // null / undefined → skip (don't overwrite with null unless explicitly set)
      if (value === undefined) continue;

      // Empty string for FK → null
      if (key === 'fleetId') {
        updateData.fleetId = value === '' ? null : value;
        continue;
      }

      // Date coercion
      if (DATE_FIELDS.has(key)) {
        updateData[key] = value && value !== '' ? new Date(value) : null;
        continue;
      }

      // Integer coercion
      if (INT_FIELDS.has(key)) {
        if (value !== null && value !== '') updateData[key] = parseInt(String(value), 10);
        continue;
      }

      // Float coercion
      if (FLOAT_FIELDS.has(key)) {
        if (value !== null && value !== '') updateData[key] = parseFloat(String(value));
        continue;
      }

      // String / enum — pass through as-is
      updateData[key] = value;
    }

    console.log(`[updateVehicle] id=${req.params.id} keys=${Object.keys(updateData).join(',')}`);

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data:  updateData,
      include: { fleet: { select: { id: true, name: true, color: true } } },
    });
    res.json(vehicle);
  } catch (err: any) {
    console.error(`[updateVehicle] ERROR code=${err?.code} msg=${err?.message}`, err?.meta ?? '');
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
