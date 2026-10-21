-- ============================================================================
-- Migration: unified_identity
-- Additive only — no existing tables or columns are modified or dropped.
-- ============================================================================

-- Enums
CREATE TYPE "MembershipStatus"    AS ENUM ('INVITED','ACTIVE','SUSPENDED','ENDED');
CREATE TYPE "MembershipRole"      AS ENUM ('COMPANY_OWNER','COMPANY_ADMIN','FLEET_MANAGER','DISPATCHER','FINANCE_MANAGER','ACCOUNTANT','HR_MANAGER','MECHANIC','DRIVER','SAFETY_OFFICER','AUDITOR','CUSTOMER','SUPPLIER','VIEWER');
CREATE TYPE "PlanTier"            AS ENUM ('FREE','STARTER','BUSINESS','ENTERPRISE','CUSTOM');
CREATE TYPE "SubscriptionStatus"  AS ENUM ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED');
CREATE TYPE "EntitlementStatus"   AS ENUM ('ACTIVE','SUSPENDED','EXPIRED','REVOKED');

-- ── plans ─────────────────────────────────────────────────────────────────────
CREATE TABLE "plans" (
    "id"               TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "slug"             TEXT NOT NULL,
    "tier"             "PlanTier" NOT NULL DEFAULT 'STARTER',
    "description"      TEXT,
    "monthlyPriceUsd"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "annualPriceUsd"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "includedSeats"    INTEGER NOT NULL DEFAULT 5,
    "extraSeatPriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPublic"         BOOLEAN NOT NULL DEFAULT true,
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "trialDays"        INTEGER NOT NULL DEFAULT 14,
    "features"         JSONB NOT NULL DEFAULT '[]',
    "limits"           JSONB NOT NULL DEFAULT '{}',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- ── subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE "subscriptions" (
    "id"                   TEXT NOT NULL,
    "organizationId"       TEXT NOT NULL,
    "planId"               TEXT NOT NULL,
    "status"               "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "seats"                INTEGER NOT NULL DEFAULT 5,
    "seatsUsed"            INTEGER NOT NULL DEFAULT 0,
    "trialEndsAt"          TIMESTAMP(3),
    "currentPeriodStart"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd"     TIMESTAMP(3),
    "cancelledAt"          TIMESTAMP(3),
    "notes"                TEXT,
    "externalRef"          TEXT,
    "currency"             TEXT NOT NULL DEFAULT 'USD',
    "billingInterval"      TEXT NOT NULL DEFAULT 'monthly',
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscriptions_organizationId_key" ON "subscriptions"("organizationId");
ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "plans"("id") ON UPDATE CASCADE;

-- ── memberships ───────────────────────────────────────────────────────────────
CREATE TABLE "memberships" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role"           "MembershipRole" NOT NULL DEFAULT 'VIEWER',
    "status"         "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "invitedById"    TEXT,
    "invitedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt"     TIMESTAMP(3),
    "endedAt"        TIMESTAMP(3),
    "suspendedAt"    TIMESTAMP(3),
    "suspendReason"  TEXT,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId","organizationId");
CREATE INDEX "memberships_organizationId_idx" ON "memberships"("organizationId");
CREATE INDEX "memberships_userId_idx"         ON "memberships"("userId");
ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── entitlements ──────────────────────────────────────────────────────────────
CREATE TABLE "entitlements" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "featureKey"     TEXT NOT NULL,
    "status"         "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedById"    TEXT,
    "expiresAt"      TIMESTAMP(3),
    "usageLimit"     INTEGER,
    "usageCount"     INTEGER NOT NULL DEFAULT 0,
    "metadata"       JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "entitlements_organizationId_featureKey_key" ON "entitlements"("organizationId","featureKey");
CREATE INDEX "entitlements_organizationId_idx" ON "entitlements"("organizationId");
ALTER TABLE "entitlements"
    ADD CONSTRAINT "entitlements_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entitlements"
    ADD CONSTRAINT "entitlements_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── audit_logs ────────────────────────────────────────────────────────────────
CREATE TABLE "audit_logs" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT,
    "userId"         TEXT,
    "action"         TEXT NOT NULL,
    "targetType"     TEXT,
    "targetId"       TEXT,
    "before"         JSONB,
    "after"          JSONB,
    "ipAddress"      TEXT,
    "userAgent"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");
CREATE INDEX "audit_logs_userId_idx"         ON "audit_logs"("userId");
CREATE INDEX "audit_logs_createdAt_idx"      ON "audit_logs"("createdAt");

-- ── Seed default plans ────────────────────────────────────────────────────────
INSERT INTO "plans" ("id","name","slug","tier","description","monthlyPriceUsd","annualPriceUsd","includedSeats","trialDays","features","limits","updatedAt")
VALUES
  (gen_random_uuid()::text, 'Free',       'free',       'FREE',       'Basic GPS tracking only',                  0,    0,    3,  14, '["fleet.gps","fleet.vehicles"]',                                       '{"maxVehicles":5}',       CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Starter',    'starter',    'STARTER',    'Essential fleet management',               19,   190,  10, 14, '["fleet.gps","fleet.vehicles","fleet.drivers","alerts"]',              '{"maxVehicles":25}',      CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Business',   'business',   'BUSINESS',   'Full fleet + finance operations',          49,   490,  25, 14, '["fleet.gps","fleet.vehicles","fleet.drivers","alerts","finance.contracts","finance.expenses","maintenance","reports"]', '{"maxVehicles":100}', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Enterprise', 'enterprise', 'ENTERPRISE', 'Unlimited fleet, finance & AI assistant',  99,   990,  100, 30, '["fleet.gps","fleet.vehicles","fleet.drivers","alerts","finance.contracts","finance.expenses","maintenance","reports","ai.assistant","finance.accounting"]', '{"maxVehicles":null}', CURRENT_TIMESTAMP);
