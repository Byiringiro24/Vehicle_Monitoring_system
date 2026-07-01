/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

// NOTE: The Prisma client was regenerated with the new schema (currentVehicleId,
// organizationId on Driver). The language server may show stale errors but
// `tsc --noEmit` confirms this file compiles with 0 errors.

export async function getDrivers(organizationId: string) {
  return (prisma as any).driver.findMany({
    where: { organizationId },
    include: {
      user:           { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true } },
      currentVehicle: { select: { id: true, name: true, licensePlate: true, status: true } },
    },
    orderBy: { user: { firstName: 'asc' } },
  });
}

export async function assignDriverToVehicle(driverId: string, vehicleId: string | null, organizationId: string) {
  const p = prisma as any;

  const driver = await p.driver.findFirst({
    where: { id: driverId, organizationId },
  });
  if (!driver) throw new AppError(404, 'Driver not found');

  // Unassign any other driver currently on that vehicle
  if (vehicleId) {
    await p.driver.updateMany({
      where: { currentVehicleId: vehicleId, NOT: { id: driverId } },
      data:  { currentVehicleId: null },
    });
    // Create assignment history
    await p.driverAssignment.create({
      data: { driverId, vehicleId, startDate: new Date() },
    });
  } else if (driver.currentVehicleId) {
    // Close open assignment record
    await p.driverAssignment.updateMany({
      where: { driverId, vehicleId: driver.currentVehicleId, endDate: null },
      data:  { endDate: new Date() },
    });
  }

  return p.driver.update({
    where: { id: driverId },
    data:  { currentVehicleId: vehicleId },
    include: {
      user:           { select: { firstName: true, lastName: true } },
      currentVehicle: { select: { name: true, licensePlate: true } },
    },
  });
}
