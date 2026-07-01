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
      description: 'Demo fleet management organization',
      email: 'info@artic.io',
      phone: '+250 788 000000',
      country: 'Rwanda',
      currency: 'RWF',
    },
  });

  const adminHash = await bcrypt.hash('Admin1234!', 12);
  await prisma.user.upsert({
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
  await prisma.user.upsert({
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

  const financeHash = await bcrypt.hash('Finance1234!', 12);
  await prisma.user.upsert({
    where: { email: 'finance@artic.io' },
    update: {},
    create: {
      email: 'finance@artic.io',
      passwordHash: financeHash,
      firstName: 'Finance',
      lastName: 'Manager',
      role: 'FINANCE_MANAGER',
      organizationId: org.id,
    },
  });

  const fleet = await prisma.fleet.upsert({
    where: { id: 'demo-fleet-01' },
    update: {},
    create: {
      id: 'demo-fleet-01',
      name: 'Kigali City Fleet',
      description: 'Main city operations fleet',
      color: '#3B82F6',
      organizationId: org.id,
    },
  });

  // Seed 4 vehicles with full fields
  const vehicles = [
    { name: 'Truck Alpha',    licensePlate: 'RAB 001 A', manufacturer: 'Isuzu',    model: 'NQR',    year: 2022, color: 'White',  energyType: 'DIESEL' as const,   vehicleClass: 'TRUCK' as const,    purpose: 'DELIVERY' as const },
    { name: 'Van Beta',       licensePlate: 'RAB 002 B', manufacturer: 'Toyota',   model: 'Hiace',  year: 2021, color: 'Silver', energyType: 'PETROL' as const,   vehicleClass: 'VAN' as const,      purpose: 'COMPANY' as const },
    { name: 'Moto Gamma',     licensePlate: 'RAC 003 C', manufacturer: 'Bajaj',    model: 'Boxer',  year: 2023, color: 'Red',    energyType: 'PETROL' as const,   vehicleClass: 'MOTORCYCLE' as const, purpose: 'TAXI' as const },
    { name: 'EV Delta',       licensePlate: 'RAD 004 D', manufacturer: 'BYD',      model: 'Atto 3', year: 2024, color: 'Blue',   energyType: 'ELECTRIC' as const, vehicleClass: 'SUV' as const,      purpose: 'COMPANY' as const },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { licensePlate: v.licensePlate },
      update: {},
      create: {
        ...v,
        vehicleType: v.vehicleClass,
        organizationId: org.id,
        fleetId: fleet.id,
        fuelCapacity: v.energyType === 'ELECTRIC' ? undefined : 60,
        batteryCapacityKwh: v.energyType === 'ELECTRIC' ? 60 : undefined,
        insuranceExpiry: new Date(Date.now() + 180 * 86400000),
        roadTaxExpiry:   new Date(Date.now() + 90  * 86400000),
        inspectionExpiry:new Date(Date.now() + 60  * 86400000),
        purchasePrice: 15000000 + Math.round(Math.random() * 5000000),
        currentValue:  12000000 + Math.round(Math.random() * 3000000),
      },
    });
  }

  // Default alert rules
  await prisma.alertRule.createMany({
    skipDuplicates: true,
    data: [
      { organizationId: org.id, name: 'Speed Limit 100km/h',  type: 'SPEEDING',           severity: 'HIGH',     conditions: { maxSpeed: 100 } },
      { organizationId: org.id, name: 'Low Fuel < 15%',       type: 'LOW_FUEL',            severity: 'MEDIUM',   conditions: { minFuel: 15 } },
      { organizationId: org.id, name: 'Engine Overheat',      type: 'ENGINE_OVERHEAT',     severity: 'CRITICAL', conditions: { maxTemp: 105 } },
      { organizationId: org.id, name: 'Low Battery Voltage',  type: 'BATTERY_LOW_VOLTAGE', severity: 'HIGH',     conditions: { minVoltage: 11.5 } },
      { organizationId: org.id, name: 'Insurance Expiry Alert', type: 'INSURANCE_EXPIRING', severity: 'HIGH',    conditions: { daysBeforeExpiry: 30 } },
    ],
  });

  console.log('');
  console.log('✅ Seed complete!');
  console.log('   Admin:   admin@artic.io   / Admin1234!');
  console.log('   Manager: manager@artic.io / Manager1234!');
  console.log('   Finance: finance@artic.io / Finance1234!');
  console.log(`   Org ID:  ${org.id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
