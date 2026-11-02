-- Migration: missing features — new roles, audit, entitlements, notifications, attendance, payouts

-- ── Add new UserRole enum values ──────────────────────────────────────────────
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_SUPPORT';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SALES_AGENT';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'AUDITOR';

-- ── Audit log ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"             TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT,
  "userId"         TEXT,
  "action"         TEXT NOT NULL,
  "targetType"     TEXT,
  "targetId"       TEXT,
  "before"         JSONB,
  "after"          JSONB,
  "ipAddress"      TEXT,
  "userAgent"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "audit_logs_org_idx"    ON "audit_logs"("organizationId");
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx"   ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_date_idx"   ON "audit_logs"("createdAt");

-- ── Feature entitlements ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "feature_entitlements" (
  "id"             TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "featureCode"    TEXT NOT NULL,
  "enabled"        BOOLEAN NOT NULL DEFAULT true,
  "grantedBy"      TEXT,
  "expiresAt"      TIMESTAMP(3),
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("organizationId", "featureCode")
);
CREATE INDEX IF NOT EXISTS "feature_entitlements_org_idx" ON "feature_entitlements"("organizationId");

-- ── Notification preferences ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id"             TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"         TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "alertType"      TEXT NOT NULL,
  "emailEnabled"   BOOLEAN NOT NULL DEFAULT true,
  "inAppEnabled"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "organizationId", "alertType")
);

-- ── Attendance ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "attendance" (
  "id"             TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"         TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "date"           TIMESTAMP(3) NOT NULL,
  "checkIn"        TIMESTAMP(3),
  "checkOut"       TIMESTAMP(3),
  "status"         TEXT NOT NULL DEFAULT 'PRESENT',
  "notes"          TEXT,
  "approvedBy"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "date")
);
CREATE INDEX IF NOT EXISTS "attendance_org_date_idx" ON "attendance"("organizationId", "date" DESC);

-- ── Payouts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payouts" (
  "id"              TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId"  TEXT NOT NULL,
  "ownerId"         TEXT NOT NULL,
  "vehicleId"       TEXT,
  "amount"          DOUBLE PRECISION NOT NULL,
  "currency"        TEXT NOT NULL DEFAULT 'RWF',
  "periodFrom"      TIMESTAMP(3) NOT NULL,
  "periodTo"        TIMESTAMP(3) NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "requestedBy"     TEXT NOT NULL,
  "approvedBy"      TEXT,
  "executedBy"      TEXT,
  "rejectedBy"      TEXT,
  "rejectionReason" TEXT,
  "notes"           TEXT,
  "method"          TEXT,
  "reference"       TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "payouts_org_status_idx" ON "payouts"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "payouts_owner_idx"      ON "payouts"("ownerId");

-- ── Extend refresh_tokens ─────────────────────────────────────────────────────
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
