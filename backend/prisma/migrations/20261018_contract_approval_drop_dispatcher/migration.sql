-- Migration: add contract approval fields to moto_drivers, migrate DISPATCHER → FLEET_MANAGER

-- 1. Add contract workflow columns (moto_drivers table uses lowercase snake_case)
ALTER TABLE "moto_drivers"
  ADD COLUMN IF NOT EXISTS "contractStatus"     TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "contractCreatedBy"  TEXT,
  ADD COLUMN IF NOT EXISTS "contractApprovedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "contractApprovedAt" TIMESTAMPTZ;

-- 2. Back-fill: drivers who already have contractSignedAt → mark as APPROVED
UPDATE "moto_drivers"
SET "contractStatus" = 'APPROVED'
WHERE "contractSignedAt" IS NOT NULL AND "contractStatus" = 'DRAFT';

-- 3. Migrate existing DISPATCHER users → FLEET_MANAGER
UPDATE "User"
SET role = 'FLEET_MANAGER'
WHERE role = 'DISPATCHER';

-- 4. Remove DISPATCHER from the roles JSON array for all users
UPDATE "User"
SET roles = (
  SELECT jsonb_agg(r)
  FROM jsonb_array_elements_text(roles::jsonb) AS r
  WHERE r <> 'DISPATCHER'
)
WHERE roles::text LIKE '%DISPATCHER%';

-- 5. Same for pendingRoles
UPDATE "User"
SET "pendingRoles" = (
  SELECT jsonb_agg(r)
  FROM jsonb_array_elements_text("pendingRoles"::jsonb) AS r
  WHERE r <> 'DISPATCHER'
)
WHERE "pendingRoles"::text LIKE '%DISPATCHER%';
