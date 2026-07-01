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
      licenseNumber, licenseExpiry, licenseClass, licenseCountry,
      nationalId, passportNumber, gender, dateOfBirth, nationality,
      address, city, district, employeeNumber, department, position,
      employmentDate, baseSalary, commissionRate, bloodGroup,
      emergencyContact, emergencyPhone, bankName, bankAccount, mobileMoney,
      password,
    } = req.body;

    const passwordHash = await bcrypt.hash(password ?? uuidv4(), 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        middleName,
        phone,
        altPhone,
        nationalId,
        role: 'DRIVER',
        organizationId: req.user!.organizationId,
      },
    });

    const driver = await prisma.driver.create({
      data: {
        userId: user.id,
        organizationId: req.user!.organizationId,
        licenseNumber,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
        licenseClass,
        licenseCountry,
        nationalId,
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
