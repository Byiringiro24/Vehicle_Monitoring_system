-- ============================================================================
-- Migration: business_models
-- Additive only.
-- ============================================================================

CREATE TYPE "BusinessModelType" AS ENUM (
  'DAILY_RENTAL','WEEKLY_RENTAL','MONTHLY_RENTAL','ANNUAL_RENTAL',
  'LEASE_TO_OWN','VEHICLE_SALE','DRIVER_SERVICE','TRANSPORT_CONTRACT',
  'FLEET_MANAGEMENT','CUSTOM'
);

CREATE TYPE "AgreementStatus" AS ENUM (
  'DRAFT','ACTIVE','COMPLETED','DEFAULTED','TERMINATED','SUSPENDED','PENDING_SIGNATURE'
);

CREATE TYPE "ScheduledPaymentStatus" AS ENUM (
  'PENDING','PAID','PARTIAL','OVERDUE','WAIVED','CANCELLED'
);

-- ── business_models ───────────────────────────────────────────────────────────
CREATE TABLE "business_models" (
  "id"                TEXT NOT NULL,
  "organizationId"    TEXT,
  "modelType"         "BusinessModelType" NOT NULL DEFAULT 'CUSTOM',
  "name"              TEXT NOT NULL,
  "description"       TEXT,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "isPublic"          BOOLEAN NOT NULL DEFAULT false,
  "currency"          TEXT NOT NULL DEFAULT 'RWF',
  "rateAmount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "ratePeriod"        TEXT NOT NULL DEFAULT 'daily',
  "depositAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maintenancePaidBy" TEXT NOT NULL DEFAULT 'company',
  "fuelPaidBy"        TEXT NOT NULL DEFAULT 'customer',
  "insurancePaidBy"   TEXT NOT NULL DEFAULT 'company',
  "gracePeriodDays"   INTEGER NOT NULL DEFAULT 3,
  "lateFeeAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lateFeePercent"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "transferCondition" TEXT,
  "metadata"          JSONB,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_models_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "business_models_organizationId_idx" ON "business_models"("organizationId");
ALTER TABLE "business_models"
  ADD CONSTRAINT "business_models_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- ── agreements ────────────────────────────────────────────────────────────────
CREATE TABLE "agreements" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "businessModelId"  TEXT,
  "vehicleId"        TEXT NOT NULL,
  "customerId"       TEXT NOT NULL,
  "driverId"         TEXT,
  "agreementNumber"  TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "modelType"        "BusinessModelType" NOT NULL DEFAULT 'CUSTOM',
  "status"           "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "currency"         TEXT NOT NULL DEFAULT 'RWF',
  "rateAmount"       DOUBLE PRECISION NOT NULL,
  "ratePeriod"       TEXT NOT NULL DEFAULT 'daily',
  "depositAmount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "depositPaid"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalValue"       DOUBLE PRECISION,
  "installmentCount" INTEGER,
  "startDate"        TIMESTAMP(3) NOT NULL,
  "endDate"          TIMESTAMP(3),
  "expectedEndDate"  TIMESTAMP(3),
  "totalPaid"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalBalance"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "overdueAmount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contractFileUrl"  TEXT,
  "signedAt"         TIMESTAMP(3),
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agreements_agreementNumber_key" ON "agreements"("agreementNumber");
CREATE INDEX "agreements_organizationId_idx" ON "agreements"("organizationId");
CREATE INDEX "agreements_vehicleId_idx"      ON "agreements"("vehicleId");
CREATE INDEX "agreements_customerId_idx"     ON "agreements"("customerId");
CREATE INDEX "agreements_status_idx"         ON "agreements"("status");
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON UPDATE CASCADE;
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON UPDATE CASCADE;
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_businessModelId_fkey"
  FOREIGN KEY ("businessModelId") REFERENCES "business_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── scheduled_payments ────────────────────────────────────────────────────────
CREATE TABLE "scheduled_payments" (
  "id"           TEXT NOT NULL,
  "agreementId"  TEXT NOT NULL,
  "periodLabel"  TEXT NOT NULL,
  "dueDate"      TIMESTAMP(3) NOT NULL,
  "amountDue"    DOUBLE PRECISION NOT NULL,
  "currency"     TEXT NOT NULL DEFAULT 'RWF',
  "status"       "ScheduledPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amountPaid"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAt"       TIMESTAMP(3),
  "lateFee"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"        TEXT,
  "reminderSent" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scheduled_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scheduled_payments_agreementId_idx" ON "scheduled_payments"("agreementId");
CREATE INDEX "scheduled_payments_dueDate_idx"     ON "scheduled_payments"("dueDate");
CREATE INDEX "scheduled_payments_status_idx"      ON "scheduled_payments"("status");
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── payment_records ───────────────────────────────────────────────────────────
CREATE TABLE "payment_records" (
  "id"                 TEXT NOT NULL,
  "organizationId"     TEXT NOT NULL,
  "agreementId"        TEXT NOT NULL,
  "scheduledPaymentId" TEXT,
  "amount"             DOUBLE PRECISION NOT NULL,
  "currency"           TEXT NOT NULL DEFAULT 'RWF',
  "paidAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method"             TEXT NOT NULL DEFAULT 'CASH',
  "reference"          TEXT,
  "notes"              TEXT,
  "recordedById"       TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payment_records_agreementId_idx"    ON "payment_records"("agreementId");
CREATE INDEX "payment_records_organizationId_idx" ON "payment_records"("organizationId");
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_scheduledPaymentId_fkey"
  FOREIGN KEY ("scheduledPaymentId") REFERENCES "scheduled_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Seed default business models (platform-level, organizationId = NULL) ──────
INSERT INTO "business_models" (
  "id","name","modelType","ratePeriod","rateAmount","depositAmount",
  "maintenancePaidBy","fuelPaidBy","currency","isActive","isPublic","updatedAt"
) VALUES
  (gen_random_uuid()::text,'Daily Motorcycle Rental',    'DAILY_RENTAL',   'daily',   5000, 20000,'company','customer','RWF',true,true,CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'Weekly Car Rental',          'WEEKLY_RENTAL',  'weekly',  50000,100000,'company','customer','RWF',true,true,CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'Monthly Lease',              'MONTHLY_RENTAL', 'monthly', 150000,200000,'company','customer','RWF',true,true,CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'Motorcycle Hire-Purchase',   'LEASE_TO_OWN',   'monthly', 80000,100000,'customer','customer','RWF',true,true,CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'Vehicle Sale (Installments)','VEHICLE_SALE',   'monthly', 200000,500000,'customer','customer','RWF',true,true,CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'Driver Daily Submission',    'DRIVER_SERVICE', 'daily',   8000, 0,     'company','customer','RWF',true,true,CURRENT_TIMESTAMP);
