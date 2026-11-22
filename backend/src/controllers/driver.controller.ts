import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { getDrivers, assignDriverToVehicle } from '../services/driver.service';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function listDrivers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const drivers = await getDrivers(req.user!.organizationId);
    res.json(drivers);
  } catch (err) { next(err); }
}

export async function createDriver(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const {
      email, firstName, lastName, middleName, phone, altPhone,
      licenseNumber, licenseExpiry, licenseClass, licenseClasses, licenseCountry,
      nationalId, passportNumber, gender, dateOfBirth, nationality,
      address, city, district, employeeNumber, department, position,
      employmentDate, baseSalary, commissionRate, bloodGroup,
      emergencyContact, emergencyPhone, bankName, bankAccount, mobileMoney,
      password,
    } = req.body;

    if (!firstName)     throw new AppError(400, 'First name is required');
    if (!lastName)      throw new AppError(400, 'Last name is required');
    if (!licenseNumber) throw new AppError(400, 'License number is required');

    // Require either email or phone
    if (!email && !phone) throw new AppError(400, 'Either email or phone number is required for a driver account');

    // Support single licenseClass (string) or multiple licenseClasses (array)
    // Store as JSON string for multi-class, plain string for single
    const resolvedLicenseClass: string = (() => {
      if (licenseClasses && Array.isArray(licenseClasses) && licenseClasses.length > 0) {
        return licenseClasses.join(','); // store as comma-separated e.g. "A,B,C1"
      }
      return licenseClass ?? '';
    })();

    // Check email uniqueness only if provided
    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existingUser) throw new AppError(409, 'A user with this email already exists');
    }

    // Check phone uniqueness if no email
    if (!email && phone) {
      const existingPhone = await prisma.user.findFirst({ where: { phone } });
      if (existingPhone) throw new AppError(409, 'A user with this phone number already exists');
    }

    // Check if license number already taken
    const existingLicense = await prisma.driver.findUnique({ where: { licenseNumber } });
    if (existingLicense) throw new AppError(409, 'A driver with this license number already exists');

    const passwordHash = await bcrypt.hash(password ?? uuidv4(), 12);

    // Build a unique email for phone-only drivers (not sent to anyone, just satisfies DB constraint)
    const userEmail = email
      ? email.toLowerCase()
      : `driver-${phone}-${Date.now()}@placeholder.local`;

    const user = await prisma.user.create({
      data: {
        email: userEmail,
        passwordHash,
        firstName,
        lastName,
        middleName,
        phone: phone ?? null,
        altPhone: altPhone ?? null,
        nationalId: nationalId ?? null,
        role: 'DRIVER',
        organizationId: req.user!.organizationId,
        emailVerified: !!email,
      },
    });

    const driver = await prisma.driver.create({
      data: {
        userId: user.id,
        organizationId: req.user!.organizationId,
        licenseNumber,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
        licenseClass: resolvedLicenseClass || null,
        licenseCountry,
        nationalId: nationalId || null,
        passportNumber,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        nationality,
        address, city, district,
        employeeNumber, department, position,
        employmentDate: employmentDate ? new Date(employmentDate) : null,
        baseSalary: baseSalary ? parseFloat(baseSalary) : null,
        commissionRate: commissionRate ? parseFloat(commissionRate) : null,
        bloodGroup,
        emergencyContact, emergencyPhone,
        bankName, bankAccount, mobileMoney,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    res.status(201).json(driver);
  } catch (err) { next(err); }
}

export async function assignDriver(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { vehicleId } = req.body;
    const result = await assignDriverToVehicle(
      req.params.id,
      vehicleId ?? null,
      req.user!.organizationId,
    );
    res.json(result);
  } catch (err) { next(err); }
}

export async function getDriverActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const driver = await prisma.driver.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { currentVehicle: true },
    });
    if (!driver || !driver.currentVehicleId) throw new AppError(404, 'Driver or vehicle not found');

    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [telemetry, trips] = await Promise.all([
      prisma.telemetry.aggregate({
        where: { vehicleId: driver.currentVehicleId, timestamp: { gte: from } },
        _count: { id: true },
        _max:   { speed: true },
        _avg:   { speed: true, fuelLevel: true },
      }),
      prisma.trip.count({ where: { vehicleId: driver.currentVehicleId, startTime: { gte: from } } }),
    ]);

    res.json({ driver, telemetry, tripCount: trips });
  } catch (err) { next(err); }
}
