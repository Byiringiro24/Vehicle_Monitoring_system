-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'MOTORCYCLE', 'TRUCK', 'VAN', 'BUS', 'MINIBUS', 'PICKUP', 'OTHER');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('FUEL', 'MAINTENANCE', 'INSURANCE', 'REGISTRATION', 'SALARY', 'DRIVER_FEE', 'TOLL', 'FINE', 'INCOME', 'OTHER');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'FINANCE_MANAGER';

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "baseSalary" DOUBLE PRECISION,
ADD COLUMN     "commissionRate" DOUBLE PRECISION,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "joiningDate" TIMESTAMP(3),
ADD COLUMN     "licenseClass" TEXT,
ADD COLUMN     "nationalId" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'Rwanda',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'RWF';

-- AlterTable
ALTER TABLE "telemetry" ADD COLUMN     "batteryLevelPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "batteryCapacityKwh" DOUBLE PRECISION,
ADD COLUMN     "fuelType" "FuelType" NOT NULL DEFAULT 'PETROL',
ADD COLUMN     "insuranceExpiry" TIMESTAMP(3),
ADD COLUMN     "mileageAtPurchase" DOUBLE PRECISION,
ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "purchasePrice" DOUBLE PRECISION,
ADD COLUMN     "registrationExpiry" TIMESTAMP(3),
ADD COLUMN     "vehicleType" "VehicleType" NOT NULL DEFAULT 'CAR';

-- CreateTable
CREATE TABLE "driver_payments" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isIncome" BOOLEAN NOT NULL DEFAULT false,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_payments_driverId_month_year_key" ON "driver_payments"("driverId", "month", "year");

-- CreateIndex
CREATE INDEX "financial_transactions_organizationId_date_idx" ON "financial_transactions"("organizationId", "date" DESC);

-- CreateIndex
CREATE INDEX "financial_transactions_vehicleId_idx" ON "financial_transactions"("vehicleId");

-- AddForeignKey
ALTER TABLE "driver_payments" ADD CONSTRAINT "driver_payments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
