/**
 * ARTIC VMS — Demo Seed Script
 * Run: npx tsx src/utils/seed-demo.ts
 *
 * Creates:
 * 1. SUPER_ADMIN: fabricebyiringiro67@gmail.com / Admin1234!
 * 2. Testing Company (org) with admin: byiringirofabrice6@gmail.com / Admin1234!
 * 3. Demo team users (all roles, mix of email/phone/both, single/multi-role)
 * 4. 6 drivers with varied license classes
 * 5. 6 vehicles of different types
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const PASS = 'Admin1234!';

async function hash(pw: string) { return bcrypt.hash(pw, 12); }
function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').slice(0,40)
    + '-' + crypto.randomBytes(3).toString('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀  ARTIC VMS Demo Seed\n');

  // ── 1. Ensure original ARTIC VMS org exists ──────────────────────────────
  const articOrg = await prisma.organization.upsert({
    where:  { slug: 'artic-vms-d0218a' },
    update: { name: 'ARTIC VMS', status: 'ACTIVE' },
    create: {
      name: 'ARTIC VMS', slug: 'artic-vms-d0218a',
      country: 'Rwanda', currency: 'RWF',
      email: 'admin@artic.io', status: 'ACTIVE',
    },
  });
  console.log(`✔  Org: ${articOrg.name} (${articOrg.id.slice(0,8)})`);

  // ── 2. SUPER_ADMIN — fabricebyiringiro67@gmail.com ───────────────────────
  const saHash = await hash(PASS);
  const superAdmin = await prisma.user.upsert({
    where:  { email: 'fabricebyiringiro67@gmail.com' },
    update: {
      passwordHash: saHash,
      role: 'SUPER_ADMIN',
      roles: ['SUPER_ADMIN'] as any,
      isActive: true,
      emailVerified: true,
      phone: '0787585826',
    },
    create: {
      email: 'fabricebyiringiro67@gmail.com',
      passwordHash: saHash,
      firstName: 'Fabrice', lastName: 'Byiringiro',
      role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] as any,
      phone: '0787585826',
      organizationId: articOrg.id,
      isActive: true, emailVerified: true,
    },
  });
  console.log(`✔  SUPER_ADMIN: ${superAdmin.email}`);

  // Keep original admin@artic.io as SUPER_ADMIN too
  await prisma.user.upsert({
    where:  { email: 'admin@artic.io' },
    update: { role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] as any, isActive: true, emailVerified: true },
    create: {
      email: 'admin@artic.io', passwordHash: saHash,
      firstName: 'Super', lastName: 'Admin',
      role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] as any,
      organizationId: articOrg.id, isActive: true, emailVerified: true,
    },
  });

  // ── 3. Testing Company org ───────────────────────────────────────────────
  const testingOrg = await prisma.organization.upsert({
    where:  { slug: 'testing-company-main' },
    update: { name: 'Testing Company', status: 'ACTIVE' },
    create: {
      name: 'Testing Company', slug: 'testing-company-main',
      country: 'Rwanda', currency: 'RWF',
      email: 'byiringirofabrice6@gmail.com',
      phone: '+250787585826', status: 'ACTIVE',
    },
  });
  console.log(`✔  Org: ${testingOrg.name} (${testingOrg.id.slice(0,8)})`);

  // ── 4. Testing Company ADMIN ─────────────────────────────────────────────
  const adminHash = await hash(PASS);
  const tcAdmin = await prisma.user.upsert({
    where:  { email: 'byiringirofabrice6@gmail.com' },
    update: {
      passwordHash: adminHash,
      role: 'ADMIN', roles: ['ADMIN'] as any,
      organizationId: testingOrg.id, isActive: true, emailVerified: true,
      phone: '0787585826',
    },
    create: {
      email: 'byiringirofabrice6@gmail.com', passwordHash: adminHash,
      firstName: 'Fabrice', lastName: 'Admin',
      role: 'ADMIN', roles: ['ADMIN'] as any,
      phone: '0787585826',
      organizationId: testingOrg.id, isActive: true, emailVerified: true,
    },
  });
  console.log(`✔  Company Admin: ${tcAdmin.email}`);

  // ── 5. Demo team users (all roles) ───────────────────────────────────────
  const teamMembers = [
    // Single role, email only
    { first: 'Jean',    last: 'Uwimana',    email: 'fleet@testing.artic',   phone: null,         roles: ['FLEET_MANAGER'] },
    { first: 'Marie',   last: 'Ingabire',   email: 'finance@testing.artic', phone: null,         roles: ['FINANCE_MANAGER'] },
    // Multi-role, email + phone
    { first: 'David',   last: 'Nkurunziza', email: 'david@testing.artic',   phone: '0788001001', roles: ['FLEET_MANAGER', 'COMPLIANCE_OFFICER'] },
    { first: 'Grace',   last: 'Mukamana',   email: 'grace@testing.artic',   phone: '0788001002', roles: ['HR_MANAGER', 'AUDITOR'] },
    // Phone only
    { first: 'Patrick', last: 'Habimana',   email: null,                    phone: '0788001003', roles: ['MECHANIC'] },
    { first: 'Agnes',   last: 'Uwase',      email: null,                    phone: '0788001004', roles: ['RENTAL_MANAGER'] },
    { first: 'Eric',    last: 'Bizimana',   email: 'eric@testing.artic',    phone: '0788001005', roles: ['SALES_AGENT', 'FINANCE_MANAGER'] },
    { first: 'Ruth',    last: 'Mukarubibi', email: 'ruth@testing.artic',    phone: null,         roles: ['AUDITOR'] },
    { first: 'Samuel',  last: 'Ndahimana',  email: null,                    phone: '0788001006', roles: ['FLEET_MANAGER', 'MECHANIC', 'DRIVER'] },
    { first: 'Alice',   last: 'Kayitesi',   email: 'alice@testing.artic',   phone: '0788001007', roles: ['VIEWER'] },
  ];

  const userH = await hash(PASS);
  for (const m of teamMembers) {
    const emailForDb = m.email ?? `phone-${m.phone}-demo@placeholder.local`;
    const primaryRole = m.roles[0] as any;
    try {
      const existing = await prisma.user.findFirst({
        where: m.email ? { email: m.email } : { phone: m.phone! },
      });
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash: userH,
            role: primaryRole,
            roles: m.roles as any,
            organizationId: testingOrg.id,
            isActive: true,
            emailVerified: !!m.email,
            phone: m.phone ?? undefined,
          },
        });
      } else {
        await prisma.user.create({
          data: {
            email: emailForDb, passwordHash: userH,
            firstName: m.first, lastName: m.last,
            role: primaryRole, roles: m.roles as any,
            phone: m.phone ?? null,
            organizationId: testingOrg.id,
            isActive: true, emailVerified: !!m.email,
          },
        });
      }
      const id = m.email ?? `phone:${m.phone}`;
      console.log(`  ✔  ${m.first} ${m.last} [${m.roles.join('+')}] — ${id}`);
    } catch (e: any) {
      console.log(`  ⚠  ${m.first} ${m.last}: ${e.message.slice(0,60)}`);
    }
  }

  // ── 6. Drivers (create User + Driver record) ─────────────────────────────
  const driverData = [
    { first: 'Kalisa',  last: 'Mugabo',     email: 'kalisa@testing.artic',   phone: '0789101001', license: 'RW001001', classes: 'A,B',    expiry: '2026-12-31' },
    { first: 'Uwera',   last: 'Chantal',    email: null,                     phone: '0789101002', license: 'RW001002', classes: 'B',      expiry: '2027-06-30' },
    { first: 'Ntwali',  last: 'Pacifique',  email: 'ntwali@testing.artic',   phone: '0789101003', license: 'RW001003', classes: 'A,B,C1', expiry: '2025-09-15' },
    { first: 'Mukiza',  last: 'Christian',  email: null,                     phone: '0789101004', license: 'RW001004', classes: 'B,D',    expiry: '2027-03-20' },
    { first: 'Ingrid',  last: 'Uwimana',    email: 'ingrid@testing.artic',   phone: '0789101005', license: 'RW001005', classes: 'B',      expiry: '2026-08-10' },
    { first: 'Remy',    last: 'Nshimiyimana', email: null,                   phone: '0789101006', license: 'RW001006', classes: 'A,B,C',  expiry: '2028-01-01' },
  ];

  const driverH = await hash(PASS);
  for (const d of driverData) {
    const emailForDb = d.email ?? `driver-${d.phone}-demo@placeholder.local`;
    try {
      // Upsert user
      let dUser = await prisma.user.findFirst({
        where: d.email ? { email: d.email } : { phone: d.phone },
      });
      if (!dUser) {
        dUser = await prisma.user.create({
          data: {
            email: emailForDb, passwordHash: driverH,
            firstName: d.first, lastName: d.last,
            role: 'DRIVER', roles: ['DRIVER'] as any,
            phone: d.phone,
            organizationId: testingOrg.id,
            isActive: true, emailVerified: !!d.email,
          },
        });
      }

      // Upsert driver record
      const existingDriver = await prisma.driver.findFirst({
        where: { licenseNumber: d.license },
      });
      if (!existingDriver) {
        await prisma.driver.create({
          data: {
            userId: dUser.id,
            organizationId: testingOrg.id,
            licenseNumber: d.license,
            licenseClass: d.classes,
            licenseExpiry: new Date(d.expiry),
            licenseCountry: 'Rwanda',
            nationality: 'Rwandan',
            address: 'Kigali, Rwanda',
          },
        });
      }
      console.log(`  ✔  Driver: ${d.first} ${d.last} [${d.classes}] — ${d.license}`);
    } catch (e: any) {
      console.log(`  ⚠  Driver ${d.first}: ${e.message.slice(0,60)}`);
    }
  }

  // ── 7. Vehicles ──────────────────────────────────────────────────────────
  const vehicleData = [
    { name: 'Toyota Land Cruiser',   plate: 'RAB 001 A', make: 'Toyota',     mdl: 'Land Cruiser', cls: 'SUV',         color: 'White',  year: 2022, status: 'ACTIVE'      },
    { name: 'Toyota Hiace Bus',      plate: 'RAB 002 B', make: 'Toyota',     mdl: 'Hiace',        cls: 'BUS',         color: 'White',  year: 2021, status: 'ACTIVE'      },
    { name: 'Mitsubishi L200',       plate: 'RAB 003 C', make: 'Mitsubishi', mdl: 'L200',         cls: 'PICKUP',      color: 'Silver', year: 2023, status: 'AVAILABLE'   },
    { name: 'Bajaj Boxer 150',       plate: 'RAE 001 M', make: 'Bajaj',      mdl: 'Boxer 150',    cls: 'MOTORCYCLE',  color: 'Red',    year: 2024, status: 'ACTIVE'      },
    { name: 'Honda CB 125',          plate: 'RAE 002 M', make: 'Honda',      mdl: 'CB 125',       cls: 'MOTORCYCLE',  color: 'Blue',   year: 2023, status: 'AVAILABLE'   },
    { name: 'Isuzu NPR Truck',       plate: 'RAB 004 D', make: 'Isuzu',      mdl: 'NPR',          cls: 'TRUCK',       color: 'Blue',   year: 2020, status: 'MAINTENANCE' },
    { name: 'VW Passat Sedan',       plate: 'RAB 005 E', make: 'Volkswagen', mdl: 'Passat',       cls: 'SEDAN',       color: 'Black',  year: 2022, status: 'AVAILABLE'   },
  ];

  for (const v of vehicleData) {
    try {
      const existing = await prisma.vehicle.findFirst({
        where: { licensePlate: v.plate, organizationId: testingOrg.id },
      });
      if (!existing) {
        await prisma.vehicle.create({
          data: {
            organizationId: testingOrg.id,
            name:         v.name,
            licensePlate: v.plate,
            manufacturer: v.make,
            model:        v.mdl,
            vehicleClass: v.cls as any,
            vehicleType:  v.name,
            color:        v.color,
            year:         v.year,
            status:       v.status as any,
            deviceToken:  'demo-' + v.plate.replace(/\s/g,'-').toLowerCase(),
            purchasePrice: 15000000 + Math.floor(Math.random() * 20000000),
            currentValue:  10000000 + Math.floor(Math.random() * 15000000),
          },
        });
        console.log(`  ✔  Vehicle: ${v.name} [${v.plate}] — ${v.status}`);
      } else {
        console.log(`  –  Vehicle exists: ${v.plate}`);
      }
    } catch (e: any) {
      console.log(`  ⚠  Vehicle ${v.plate}: ${e.message.slice(0,200)}`);
    }
  }

  // ── 8. Summary ────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  Seed complete!\n');
  console.log('  SUPER ADMIN accounts:');
  console.log('    email: admin@artic.io              / Admin1234!');
  console.log('    email: fabricebyiringiro67@gmail.com / Admin1234!');
  console.log('    phone: 0787585826                  / Admin1234!  (also SUPER_ADMIN)');
  console.log('\n  Testing Company admin:');
  console.log('    email: byiringirofabrice6@gmail.com / Admin1234!');
  console.log('    phone: 0787585826                  / Admin1234!');
  console.log('\n  Demo team (all password: Admin1234!):');
  console.log('    fleet@testing.artic   — FLEET_MANAGER');
  console.log('    finance@testing.artic — FINANCE_MANAGER');
  console.log('    david@testing.artic   — FLEET_MANAGER + COMPLIANCE_OFFICER');
  console.log('    grace@testing.artic   — HR_MANAGER + AUDITOR');
  console.log('    phone: 0788001003     — MECHANIC (phone only)');
  console.log('    phone: 0788001004     — RENTAL_MANAGER (phone only)');
  console.log('    eric@testing.artic    — SALES_AGENT + FINANCE_MANAGER');
  console.log('    ruth@testing.artic    — AUDITOR');
  console.log('    phone: 0788001006     — FLEET_MANAGER + MECHANIC + DRIVER');
  console.log('    alice@testing.artic   — VIEWER');
  console.log('\n  6 Drivers + 7 Vehicles in Testing Company');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
