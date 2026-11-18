-- Migration: add contract approval fields to MotoDriver, migrate DISPATCHER → FLEET_MANAGER

-- 1. Add contract workflow columns to MotoDriver
ALTER TABLE "MotoDriver"
  ADD COLUMN IF NOT EXISTS "contractStatus"     TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "contractCreatedBy"  TEXT,
  ADD COLUMN IF NOT EXISTS "contractApprovedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "contractApprovedAt" TIMESTAMPTZ;

-- 2. Back-fill: drivers who already have contractSignedAt → mark as APPROVED
UPDATE "MotoDriver"
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
