-- Phase B: Add new roles to UserRole enum + ownerUserId to vehicles

-- Add new enum values (PostgreSQL requires separate ALTER TYPE statements)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DISPATCHER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'HR_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MECHANIC';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COMPLIANCE_OFFICER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'RENTAL_MANAGER';

-- Add ownerUserId to vehicles table (nullable, links to users.id)
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
CREATE INDEX IF NOT EXISTS "vehicles_ownerUserId_idx" ON "vehicles"("ownerUserId");
