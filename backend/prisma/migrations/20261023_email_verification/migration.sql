-- Add email verification columns to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "emailVerified"            BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailVerificationToken"   TEXT,
  ADD COLUMN IF NOT EXISTS "emailVerificationExpiry"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "emailVerificationPending" TEXT;

-- Mark existing real (non-placeholder) emails as already verified
UPDATE "users"
SET "emailVerified" = true
WHERE email NOT LIKE '%@placeholder.local';
