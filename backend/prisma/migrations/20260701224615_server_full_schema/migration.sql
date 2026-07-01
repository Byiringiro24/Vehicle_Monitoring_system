/*
  Warnings:

  - The values [BATTERY_LOW] on the enum `AlertType` will be removed. If these variants are still used in the database, this will fail.
  - The values [CANCELLED] on the enum `ContractStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [RENTAL,CUSTOM_AGREEMENT] on the enum `ContractType` will be removed. If these variants are still used in the database, this will fail.
  - The values [BATTERY,SALARY] on the enum `ExpenseCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `expectedAmount` on the `contract_payments` table. All the data in the column will be lost.
  - You are about to drop the column `receiptRef` on the `contract_payments` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `expectedDailyAmount` on the `drivers` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleId` on the `drivers` table. All the data in the column will be lost.
  - You are about to drop the column `avgSpeed` on the `trips` table. All the data in the column will be lost.
  - You are about to drop the column `durationMin` on the `trips` table. All the data in the column will be lost.
  - You are about to drop the column `endLng` on the `trips` table. All the data in the column will be lost.
  - You are about to drop the column `maxSpeed` on the `trips` table. All the data in the column will be lost.
  - You are about to drop the column `startLng` on the `trips` table. All the data in the column will be lost.
  - You are about to drop the column `documentUrl` on the `vehicle_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `installmentFrequency` on the `vehicle_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `nextPaymentDate` on the `vehicle_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `remainingBalance` on the `vehicle_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `vehicle_contracts` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `vehicle_expenses` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `vehicle_expenses` table. All the data in the column will be lost.
  - You are about to drop the column `odometer` on the `vehicle_expenses` table. All the data in the column will be lost.
  - You are about to drop the column `vendor` on the `vehicle_expenses` table. All the data in the column will be lost.
  - You are about to drop the column `fuelType` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the column `isLocked` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the column `make` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the column `mileageAtPurchase` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the column `registrationExpiry` on the `vehicles` table. All the data in the column will be lost.
  - The `vehicleType` column on the `vehicles` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `driver_daily_returns` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[nationalId]` on the table `drivers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[currentVehicleId]` on the table `drivers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[contractNumber]` on the table `vehicle_contracts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `contract_payments` table without a default value. This is not possible if the table is not empty.
  - Made the column `phone` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `organizationId` to the `drivers` table without a default value. This is not possible if the table is not empty.
  - The required column `contractNumber` was added to the `vehicle_contracts` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `periodicAmount` to the `vehicle_contracts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalValue` to the `vehicle_contracts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `manufacturer` to the `vehicles` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VehicleClass" AS ENUM ('SEDAN', 'SUV', 'PICKUP', 'VAN', 'TRUCK', 'BUS', 'MINIBUS', 'MOTORCYCLE', 'BICYCLE', 'TRAILER', 'TRACTOR', 'FORKLIFT', 'HEAVY_EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "VehiclePurpose" AS ENUM ('TAXI', 'DELIVERY', 'COMPANY', 'CONSTRUCTION', 'AGRICULTURE', 'LOGISTICS', 'AMBULANCE', 'GOVERNMENT', 'RENTAL', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EnergyType" AS ENUM ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PHEV', 'HYDROGEN', 'LPG', 'CNG');

-- CreateEnum
CREATE TYPE "TransmissionType" AS ENUM ('MANUAL', 'AUTOMATIC', 'CVT', 'SEMI_AUTO');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('COMPANY_OWNED', 'LEASED', 'CUSTOMER_OWNED', 'FINANCED');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "AlertType_new" AS ENUM ('SPEEDING', 'GEOFENCE_ENTRY', 'GEOFENCE_EXIT', 'LOW_FUEL', 'LOW_BATTERY', 'ENGINE_OVERHEAT', 'BATTERY_LOW_VOLTAGE', 'HARSH_BRAKING', 'HARSH_ACCELERATION', 'ACCIDENT', 'IDLE_TOO_LONG', 'OFFLINE', 'INSURANCE_EXPIRING', 'ROAD_TAX_EXPIRING', 'INSPECTION_DUE', 'MAINTENANCE_DUE', 'CUSTOM');
ALTER TABLE "alerts" ALTER COLUMN "type" TYPE "AlertType_new" USING ("type"::text::"AlertType_new");
ALTER TABLE "alert_rules" ALTER COLUMN "type" TYPE "AlertType_new" USING ("type"::text::"AlertType_new");
ALTER TYPE "AlertType" RENAME TO "AlertType_old";
ALTER TYPE "AlertType_new" RENAME TO "AlertType";
DROP TYPE "AlertType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ContractStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'DEFAULTED', 'TERMINATED', 'SUSPENDED', 'PENDING');
ALTER TABLE "vehicle_contracts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "vehicle_contracts" ALTER COLUMN "status" TYPE "ContractStatus_new" USING ("status"::text::"ContractStatus_new");
ALTER TYPE "ContractStatus" RENAME TO "ContractStatus_old";
ALTER TYPE "ContractStatus_new" RENAME TO "ContractStatus";
DROP TYPE "ContractStatus_old";
ALTER TABLE "vehicle_contracts" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ContractType_new" AS ENUM ('RENTAL_DAILY', 'RENTAL_WEEKLY', 'RENTAL_MONTHLY', 'RENTAL_QUARTERLY', 'RENTAL_YEARLY', 'LEASE', 'INSTALLMENT_SALE', 'HIRE_PURCHASE', 'DRIVER_DAILY_SUBMISSION', 'DELIVERY', 'CARGO', 'PASSENGER', 'TAXI', 'CUSTOM');
ALTER TABLE "vehicle_contracts" ALTER COLUMN "contractType" TYPE "ContractType_new" USING ("contractType"::text::"ContractType_new");
ALTER TYPE "ContractType" RENAME TO "ContractType_old";
ALTER TYPE "ContractType_new" RENAME TO "ContractType";
DROP TYPE "ContractType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ExpenseCategory_new" AS ENUM ('FUEL', 'CHARGING', 'MAINTENANCE', 'INSURANCE', 'ROAD_TAX', 'INSPECTION', 'PERMIT', 'GPS_SIM', 'TYRE', 'BATTERY_REPLACE', 'ACCIDENT_REPAIR', 'PARKING', 'FINE', 'CLEANING', 'TOWING', 'DRIVER_SALARY', 'LOAN_PAYMENT', 'ACCESSORIES', 'REPAIR', 'OTHER');
ALTER TABLE "vehicle_expenses" ALTER COLUMN "category" TYPE "ExpenseCategory_new" USING ("category"::text::"ExpenseCategory_new");
ALTER TYPE "ExpenseCategory" RENAME TO "ExpenseCategory_old";
ALTER TYPE "ExpenseCategory_new" RENAME TO "ExpenseCategory";
DROP TYPE "ExpenseCategory_old";
COMMIT;

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VehicleStatus" ADD VALUE 'AVAILABLE';
ALTER TYPE "VehicleStatus" ADD VALUE 'RENTED';
ALTER TYPE "VehicleStatus" ADD VALUE 'LEASED';
ALTER TYPE "VehicleStatus" ADD VALUE 'SOLD_INSTALLMENT';
ALTER TYPE "VehicleStatus" ADD VALUE 'RESERVED';
ALTER TYPE "VehicleStatus" ADD VALUE 'OUT_OF_SERVICE';
ALTER TYPE "VehicleStatus" ADD VALUE 'STOLEN';
ALTER TYPE "VehicleStatus" ADD VALUE 'RETIRED';

-- DropForeignKey
ALTER TABLE "driver_daily_returns" DROP CONSTRAINT "driver_daily_returns_driverId_fkey";

-- DropForeignKey
ALTER TABLE "drivers" DROP CONSTRAINT "drivers_vehicleId_fkey";

-- DropIndex
DROP INDEX "contract_payments_contractId_dueDate_idx";

-- DropIndex
DROP INDEX "drivers_vehicleId_key";

-- DropIndex
DROP INDEX "vehicle_expenses_organizationId_category_idx";

-- DropIndex
DROP INDEX "vehicle_expenses_vehicleId_date_idx";

-- AlterTable
ALTER TABLE "contract_payments" DROP COLUMN "expectedAmount",
DROP COLUMN "receiptRef",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'RWF',
ADD COLUMN     "method" TEXT,
ADD COLUMN     "receiptUrl" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "isActive",
ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "creditScore" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "creditStatus" TEXT NOT NULL DEFAULT 'GOOD',
ADD COLUMN     "district" TEXT,
ADD COLUMN     "docNationalIdUrl" TEXT,
ADD COLUMN     "docOtherUrl" TEXT,
ADD COLUMN     "docPassportUrl" TEXT,
ADD COLUMN     "docPhotoUrl" TEXT,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "employer" TEXT,
ADD COLUMN     "guarantorName" TEXT,
ADD COLUMN     "guarantorPhone" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ALTER COLUMN "phone" SET NOT NULL;

-- AlterTable
ALTER TABLE "drivers" DROP COLUMN "expectedDailyAmount",
DROP COLUMN "vehicleId",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "busExperience" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "currentVehicleId" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "department" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "docContractUrl" TEXT,
ADD COLUMN     "docLicenseUrl" TEXT,
ADD COLUMN     "docMedicalUrl" TEXT,
ADD COLUMN     "docNationalIdUrl" TEXT,
ADD COLUMN     "docPassportUrl" TEXT,
ADD COLUMN     "docPoliceUrl" TEXT,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "employeeNumber" TEXT,
ADD COLUMN     "employmentDate" TIMESTAMP(3),
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "licenseCountry" TEXT,
ADD COLUMN     "licenseIssueDate" TIMESTAMP(3),
ADD COLUMN     "licensePhotoUrl" TEXT,
ADD COLUMN     "licenseRestrictions" TEXT,
ADD COLUMN     "medicalCertUrl" TEXT,
ADD COLUMN     "medicalExpiry" TIMESTAMP(3),
ADD COLUMN     "medicalNotes" TEXT,
ADD COLUMN     "mobileMoney" TEXT,
ADD COLUMN     "motoExperience" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "specialSkills" TEXT,
ADD COLUMN     "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "taxiExperience" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "truckExperience" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visionTest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "yearsDriving" INTEGER;

-- AlterTable
ALTER TABLE "last_locations" ADD COLUMN     "batteryLevelPct" DOUBLE PRECISION,
ADD COLUMN     "distanceMonthKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "distanceTodayKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "trips" DROP COLUMN "avgSpeed",
DROP COLUMN "durationMin",
DROP COLUMN "endLng",
DROP COLUMN "maxSpeed",
DROP COLUMN "startLng",
ADD COLUMN     "avgSpeedKph" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "driverId" TEXT,
ADD COLUMN     "endLon" DOUBLE PRECISION,
ADD COLUMN     "engineHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "idleMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "maxSpeedKph" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pathPoints" JSONB,
ADD COLUMN     "startLon" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "nationalId" TEXT;

-- AlterTable
ALTER TABLE "vehicle_contracts" DROP COLUMN "documentUrl",
DROP COLUMN "installmentFrequency",
DROP COLUMN "nextPaymentDate",
DROP COLUMN "remainingBalance",
DROP COLUMN "totalAmount",
ADD COLUMN     "contractFileUrl" TEXT,
ADD COLUMN     "contractNumber" TEXT NOT NULL,
ADD COLUMN     "customSchedule" TEXT,
ADD COLUMN     "dailyRate" DOUBLE PRECISION,
ADD COLUMN     "depositPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "driverId" TEXT,
ADD COLUMN     "expectedEndDate" TIMESTAMP(3),
ADD COLUMN     "installmentCount" INTEGER,
ADD COLUMN     "lateFees" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyRate" DOUBLE PRECISION,
ADD COLUMN     "overdueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ownershipTransferDate" TIMESTAMP(3),
ADD COLUMN     "periodDays" INTEGER,
ADD COLUMN     "periodicAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalValue" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "weeklyRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "vehicle_expenses" DROP COLUMN "expiryDate",
DROP COLUMN "location",
DROP COLUMN "odometer",
DROP COLUMN "vendor",
ADD COLUMN     "coverType" TEXT,
ADD COLUMN     "driverId" TEXT,
ADD COLUMN     "fineDate" TIMESTAMP(3),
ADD COLUMN     "fineLocation" TEXT,
ADD COLUMN     "fuelStation" TEXT,
ADD COLUMN     "fuelTypePumped" TEXT,
ADD COLUMN     "garageAddress" TEXT,
ADD COLUMN     "gpsDeviceId" TEXT,
ADD COLUMN     "insuranceCompany" TEXT,
ADD COLUMN     "maintenanceType" TEXT,
ADD COLUMN     "mechanicName" TEXT,
ADD COLUMN     "mileageAtFuel" DOUBLE PRECISION,
ADD COLUMN     "mileageAtService" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "officerName" TEXT,
ADD COLUMN     "policyEndDate" TIMESTAMP(3),
ADD COLUMN     "policyStartDate" TIMESTAMP(3),
ADD COLUMN     "simNumber" TEXT,
ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "tyreBrand" TEXT,
ADD COLUMN     "tyrePosition" TEXT,
ADD COLUMN     "tyreSerial" TEXT;

-- AlterTable
ALTER TABLE "vehicles" DROP COLUMN "fuelType",
DROP COLUMN "isLocked",
DROP COLUMN "make",
DROP COLUMN "mileageAtPurchase",
DROP COLUMN "registrationExpiry",
ADD COLUMN     "assetTag" TEXT,
ADD COLUMN     "avgConsumption" DOUBLE PRECISION,
ADD COLUMN     "batteryHealth" DOUBLE PRECISION,
ADD COLUMN     "batteryManufacturer" TEXT,
ADD COLUMN     "batteryReplaceCost" DOUBLE PRECISION,
ADD COLUMN     "batterySerial" TEXT,
ADD COLUMN     "batteryWarranty" TIMESTAMP(3),
ADD COLUMN     "chargerType" TEXT,
ADD COLUMN     "chargingSpeedKw" DOUBLE PRECISION,
ADD COLUMN     "commercialLicExpiry" TIMESTAMP(3),
ADD COLUMN     "commercialLicense" TEXT,
ADD COLUMN     "docInspectionCert" TEXT,
ADD COLUMN     "docInsurancePdf" TEXT,
ADD COLUMN     "docOwnershipCert" TEXT,
ADD COLUMN     "docPhoto" TEXT,
ADD COLUMN     "docPurchaseInvoice" TEXT,
ADD COLUMN     "docRegistrationCard" TEXT,
ADD COLUMN     "driveType" TEXT,
ADD COLUMN     "emissionCert" TEXT,
ADD COLUMN     "emissionExpiry" TIMESTAMP(3),
ADD COLUMN     "energyType" "EnergyType" NOT NULL DEFAULT 'PETROL',
ADD COLUMN     "engineCc" DOUBLE PRECISION,
ADD COLUMN     "engineHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "engineLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "engineNumber" TEXT,
ADD COLUMN     "engineType" TEXT,
ADD COLUMN     "fleetNumber" TEXT,
ADD COLUMN     "fuelCardNumber" TEXT,
ADD COLUMN     "horsepower" INTEGER,
ADD COLUMN     "insuranceAgent" TEXT,
ADD COLUMN     "insuranceCompany" TEXT,
ADD COLUMN     "insuranceCoverage" TEXT,
ADD COLUMN     "insuranceEmergency" TEXT,
ADD COLUMN     "insurancePolicyNo" TEXT,
ADD COLUMN     "insurancePremium" DOUBLE PRECISION,
ADD COLUMN     "insuranceStart" TIMESTAMP(3),
ADD COLUMN     "lastServiceDate" TIMESTAMP(3),
ADD COLUMN     "lastServiceOdometer" DOUBLE PRECISION,
ADD COLUMN     "manufacturer" TEXT NOT NULL,
ADD COLUMN     "maxSpeedKph" DOUBLE PRECISION,
ADD COLUMN     "minFuelAlert" DOUBLE PRECISION,
ADD COLUMN     "nextServiceDate" TIMESTAMP(3),
ADD COLUMN     "odometer" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "oilChangeKmInterval" DOUBLE PRECISION,
ADD COLUMN     "ownerCompany" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "ownershipType" "OwnershipType" NOT NULL DEFAULT 'COMPANY_OWNED',
ADD COLUMN     "preferredStation" TEXT,
ADD COLUMN     "purpose" "VehiclePurpose" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "recommendedFuel" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "roadTaxExpiry" TIMESTAMP(3),
ADD COLUMN     "roadworthinessCert" TEXT,
ADD COLUMN     "supplierName" TEXT,
ADD COLUMN     "taxiPermit" TEXT,
ADD COLUMN     "taxiPermitExpiry" TIMESTAMP(3),
ADD COLUMN     "transmission" "TransmissionType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "transportPermit" TEXT,
ADD COLUMN     "transportPermitExpiry" TIMESTAMP(3),
ADD COLUMN     "trim" TEXT,
ADD COLUMN     "tyreBrand" TEXT,
ADD COLUMN     "tyreFrontLeft" TEXT,
ADD COLUMN     "tyreFrontRight" TEXT,
ADD COLUMN     "tyrePurchaseDate" TIMESTAMP(3),
ADD COLUMN     "tyreRearLeft" TEXT,
ADD COLUMN     "tyreRearRight" TEXT,
ADD COLUMN     "tyreSize" TEXT,
ADD COLUMN     "tyreSpare" TEXT,
ADD COLUMN     "vehicleClass" "VehicleClass" NOT NULL DEFAULT 'SEDAN',
ADD COLUMN     "warrantyExpiry" TIMESTAMP(3),
ALTER COLUMN "fuelCapacity" DROP NOT NULL,
ALTER COLUMN "fuelCapacity" DROP DEFAULT,
DROP COLUMN "vehicleType",
ADD COLUMN     "vehicleType" TEXT NOT NULL DEFAULT 'CAR';

-- DropTable
DROP TABLE "driver_daily_returns";

-- DropEnum
DROP TYPE "FuelType";

-- DropEnum
DROP TYPE "VehicleType";

-- CreateTable
CREATE TABLE "gps_devices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "imei" TEXT,
    "simNumber" TEXT,
    "networkProvider" TEXT,
    "dataPlan" TEXT,
    "firmwareVersion" TEXT,
    "installationDate" TIMESTAMP(3),
    "removedDate" TIMESTAMP(3),
    "technicianName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastCommunication" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" TEXT,

    CONSTRAINT "gps_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_assignments" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "purpose" TEXT,
    "department" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_payments" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "expectedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difference" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "energyType" "EnergyType" NOT NULL,
    "fuelStation" TEXT,
    "stationCity" TEXT,
    "litres" DOUBLE PRECISION,
    "pricePerLitre" DOUBLE PRECISION,
    "isHomeCharging" BOOLEAN NOT NULL DEFAULT false,
    "startBatteryPct" DOUBLE PRECISION,
    "endBatteryPct" DOUBLE PRECISION,
    "kwhAdded" DOUBLE PRECISION,
    "pricePerKwh" DOUBLE PRECISION,
    "chargingMinutes" INTEGER,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "mileageAtFuel" DOUBLE PRECISION,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maintenanceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "garage" TEXT,
    "garageAddress" TEXT,
    "mechanicName" TEXT,
    "invoiceNumber" TEXT,
    "cost" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "mileageAtService" DOUBLE PRECISION,
    "nextServiceDate" TIMESTAMP(3),
    "nextServiceOdometer" DOUBLE PRECISION,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_history" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tripId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heading" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION,

    CONSTRAINT "gps_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_flows" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_flows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gps_devices_deviceId_key" ON "gps_devices"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "gps_devices_imei_key" ON "gps_devices"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "gps_devices_vehicleId_key" ON "gps_devices"("vehicleId");

-- CreateIndex
CREATE INDEX "driver_assignments_driverId_idx" ON "driver_assignments"("driverId");

-- CreateIndex
CREATE INDEX "driver_assignments_vehicleId_idx" ON "driver_assignments"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "driver_payments_driverId_month_year_key" ON "driver_payments"("driverId", "month", "year");

-- CreateIndex
CREATE INDEX "fuel_records_vehicleId_date_idx" ON "fuel_records"("vehicleId", "date" DESC);

-- CreateIndex
CREATE INDEX "maintenance_records_vehicleId_date_idx" ON "maintenance_records"("vehicleId", "date" DESC);

-- CreateIndex
CREATE INDEX "gps_history_vehicleId_timestamp_idx" ON "gps_history"("vehicleId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "gps_history_tripId_idx" ON "gps_history"("tripId");

-- CreateIndex
CREATE INDEX "cash_flows_organizationId_date_idx" ON "cash_flows"("organizationId", "date" DESC);

-- CreateIndex
CREATE INDEX "contract_payments_contractId_dueDate_idx" ON "contract_payments"("contractId", "dueDate");

-- CreateIndex
CREATE INDEX "contract_payments_status_idx" ON "contract_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_nationalId_key" ON "drivers"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_currentVehicleId_key" ON "drivers"("currentVehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_contracts_contractNumber_key" ON "vehicle_contracts"("contractNumber");

-- CreateIndex
CREATE INDEX "vehicle_contracts_organizationId_status_idx" ON "vehicle_contracts"("organizationId", "status");

-- CreateIndex
CREATE INDEX "vehicle_contracts_vehicleId_idx" ON "vehicle_contracts"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_contracts_customerId_idx" ON "vehicle_contracts"("customerId");

-- CreateIndex
CREATE INDEX "vehicle_expenses_organizationId_date_idx" ON "vehicle_expenses"("organizationId", "date" DESC);

-- CreateIndex
CREATE INDEX "vehicle_expenses_vehicleId_category_idx" ON "vehicle_expenses"("vehicleId", "category");

-- AddForeignKey
ALTER TABLE "gps_devices" ADD CONSTRAINT "gps_devices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_devices" ADD CONSTRAINT "gps_devices_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_currentVehicleId_fkey" FOREIGN KEY ("currentVehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_contracts" ADD CONSTRAINT "vehicle_contracts_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_payments" ADD CONSTRAINT "driver_payments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_expenses" ADD CONSTRAINT "vehicle_expenses_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
