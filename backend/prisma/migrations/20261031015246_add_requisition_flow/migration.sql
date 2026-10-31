-- CreateEnum
CREATE TYPE "RequisitionType" AS ENUM ('EXPENSE_REIMBURSEMENT', 'PURCHASE_ADVANCE', 'DRIVER_ADVANCE', 'PER_DIEM', 'FUEL_ADVANCE', 'PETTY_CASH', 'SALARY_ADJUSTMENT', 'DRIVER_DEDUCTION', 'OWNER_PAYOUT', 'SUPPLIER_PAYMENT', 'REFUND', 'SUBCONTRACTOR_PAY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED', 'PAID', 'RECONCILED', 'ON_HOLD', 'REJECTED', 'CANCELLED', 'VOID');

-- DropForeignKey
ALTER TABLE "agreements" DROP CONSTRAINT "agreements_customerId_fkey";

-- DropForeignKey
ALTER TABLE "agreements" DROP CONSTRAINT "agreements_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "entitlements" DROP CONSTRAINT "entitlements_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_planId_fkey";

-- DropIndex
DROP INDEX "vehicles_ownerUserId_idx";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pendingRoles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[],
ADD COLUMN     "roles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[];

-- CreateTable
CREATE TABLE "requisitions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "type" "RequisitionType" NOT NULL,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "amount" DOUBLE PRECISION NOT NULL,
    "neededBy" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "paymentPreference" TEXT,
    "vehicleId" TEXT,
    "tripReference" TEXT,
    "workOrderRef" TEXT,
    "agreementRef" TEXT,
    "notes" TEXT,
    "rejectedReason" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requisitions_organizationId_status_idx" ON "requisitions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "requisitions_requesterId_idx" ON "requisitions"("requesterId");

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "documents_owner_idx" RENAME TO "documents_ownerType_ownerId_idx";
