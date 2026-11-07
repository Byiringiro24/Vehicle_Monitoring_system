-- Motorcycle fleet management tables
-- Based on FABU.xlsx, AUTOEARN daily report, AMASEZERANO contract

CREATE TABLE IF NOT EXISTS "moto_drivers" (
  "id"               TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId"   TEXT NOT NULL,
  "firstName"        TEXT NOT NULL,
  "lastName"         TEXT NOT NULL,
  "phone"            TEXT NOT NULL,
  "altPhone"         TEXT,
  "nationalId"       TEXT,
  "licenseNumber"    TEXT,
  "licenseClass"     TEXT DEFAULT 'B',
  "address"          TEXT,
  "referral1Name"    TEXT,
  "referral1Phone"   TEXT,
  "referral2Name"    TEXT,
  "referral2Phone"   TEXT,
  "contractSignedAt" TIMESTAMP(3),
  "contractNotes"    TEXT,
  "plateNumber"      TEXT,
  "bikeModel"        TEXT,
  "bikeAssignedAt"   TIMESTAMP(3),
  "dailyRate"        DOUBLE PRECISION NOT NULL DEFAULT 6000,
  "weeklyRate"       DOUBLE PRECISION NOT NULL DEFAULT 42000,
  "paymentType"      TEXT NOT NULL DEFAULT 'DAILY',
  "paymentDeadline"  TEXT NOT NULL DEFAULT '21:00',
  "status"           TEXT NOT NULL DEFAULT 'ACTIVE',
  "totalDebt"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "moto_drivers_org_status_idx" ON "moto_drivers"("organizationId","status");
CREATE INDEX IF NOT EXISTS "moto_drivers_plate_idx"      ON "moto_drivers"("plateNumber");

CREATE TABLE IF NOT EXISTS "daily_payments" (
  "id"             TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "driverId"       TEXT NOT NULL REFERENCES "moto_drivers"("id"),
  "plateNumber"    TEXT NOT NULL,
  "date"           TIMESTAMP(3) NOT NULL,
  "expectedAmount" DOUBLE PRECISION NOT NULL,
  "paidAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "difference"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "recordedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedBy"     TEXT,
  "paidViaPhone"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidViaCash"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"          TEXT,
  "debtBefore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "debtAfter"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  UNIQUE("driverId","date")
);
CREATE INDEX IF NOT EXISTS "daily_payments_org_date_idx"    ON "daily_payments"("organizationId","date" DESC);
CREATE INDEX IF NOT EXISTS "daily_payments_driver_date_idx" ON "daily_payments"("driverId","date" DESC);
CREATE INDEX IF NOT EXISTS "daily_payments_plate_idx"       ON "daily_payments"("plateNumber");

CREATE TABLE IF NOT EXISTS "moto_fines" (
  "id"             TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "driverId"       TEXT REFERENCES "moto_drivers"("id"),
  "plateNumber"    TEXT NOT NULL,
  "fineDate"       TIMESTAMP(3) NOT NULL,
  "reason"         TEXT NOT NULL,
  "amount"         DOUBLE PRECISION NOT NULL,
  "paidByDriver"   BOOLEAN NOT NULL DEFAULT false,
  "paidByCompany"  BOOLEAN NOT NULL DEFAULT false,
  "recovered"      BOOLEAN NOT NULL DEFAULT false,
  "recoveredDate"  TIMESTAMP(3),
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "moto_fines_org_date_idx" ON "moto_fines"("organizationId","fineDate" DESC);
CREATE INDEX IF NOT EXISTS "moto_fines_plate_idx"    ON "moto_fines"("plateNumber");

CREATE TABLE IF NOT EXISTS "garage_expenses" (
  "id"             TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "date"           TIMESTAMP(3) NOT NULL,
  "plateNumber"    TEXT,
  "product"        TEXT NOT NULL,
  "amount"         DOUBLE PRECISION NOT NULL,
  "category"       TEXT NOT NULL DEFAULT 'MAINTENANCE',
  "recordedBy"     TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "garage_expenses_org_date_idx" ON "garage_expenses"("organizationId","date" DESC);
