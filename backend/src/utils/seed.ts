import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding ARTIC VMS database...');

  const org = await prisma.organization.upsert({
    where: { slug: 'artic-demo' },
    update: {},
    create: {
      name: 'ARTIC Demo Organization',
      slug: 'artic-demo',
      description: 'Demo organization for ARTIC Vehicle Monitoring System',
      email: 'info@artic.io',
      phone: '+254 700 000000',
    },
  });

  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@artic.io' },
    update: {},
    create: {
      email: 'admin@artic.io',
      passwordHash: adminHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'SUPER_ADMIN',
      organizationId: org.id,
    },
  });

  const managerHash = await bcrypt.hash('Manager1234!', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@artic.io' },
    update: {},
    create: {
      email: 'manager@artic.io',
      passwordHash: managerHash,
      firstName: 'Fleet',
      lastName: 'Manager',
      role: 'FLEET_MANAGER',
      organizationId: org.id,
    },
  });

  const fleet = await prisma.fleet.upsert({
    where: { id: 'demo-fleet-01' },
    update: {},
    create: {
      id: 'demo-fleet-01',
      name: 'Nairobi City Fleet',
      description: 'Main city delivery fleet',
      color: '#3B82F6',
      organizationId: org.id,
      managerId: manager.id,
    },
  });

  const vehicles = [
    { name: 'Truck Alpha', licensePlate: 'KCA 001A', make: 'Isuzu', model: 'NQR', year: 2022, color: 'White' },
    { name: 'Van Beta', licensePlate: 'KBB 002B', make: 'Toyota', model: 'Hiace', year: 2021, color: 'Silver' },
    { name: 'Lorry Gamma', licensePlate: 'KCC 003C', make: 'Mercedes', model: 'Actros', year: 2023, color: 'Blue' },
    { name: 'Pickup Delta', licensePlate: 'KDD 004D', make: 'Toyota', model: 'Hilux', year: 2022, color: 'Red' },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { licensePlate: v.licensePlate },
      update: {},
      create: { ...v, organizationId: org.id, fleetId: fleet.id, fuelCapacity: 80 },
    });
  }

  // Default alert rules
  await prisma.alertRule.createMany({
    skipDuplicates: true,
    data: [
      { organizationId: org.id, name: 'Speed Limit 100km/h', type: 'SPEEDING', severity: 'HIGH', conditions: { maxSpeed: 100 } },
      { organizationId: org.id, name: 'Low Fuel Warning', type: 'LOW_FUEL', severity: 'MEDIUM', conditions: { minFuel: 15 } },
      { organizationId: org.id, name: 'Engine Overheat', type: 'ENGINE_OVERHEAT', severity: 'CRITICAL', conditions: { maxTemp: 105 } },
      { organizationId: org.id, name: 'Battery Low', type: 'BATTERY_LOW', severity: 'HIGH', conditions: { minVoltage: 11.5 } },
    ],
  });

  console.log('Seed complete!');
  console.log('Admin: admin@artic.io / Admin1234!');
  console.log('Manager: manager@artic.io / Manager1234!');
}

main().catch(console.error).finally(() => prisma.());