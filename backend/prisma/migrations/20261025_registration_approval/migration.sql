-- ============================================================================
-- Migration: registration_approval
-- Adds org status, support contacts, support tickets. Additive only.
-- ============================================================================

-- Enums
CREATE TYPE "OrgStatus"       AS ENUM ('PENDING','ACTIVE','REJECTED','SUSPENDED');
CREATE TYPE "TicketStatus"    AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','CLOSED');
CREATE TYPE "TicketPriority"  AS ENUM ('LOW','MEDIUM','HIGH','URGENT');

-- Add status + rejectionReason to organizations
ALTER TABLE "organizations"
  ADD COLUMN "status"          "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "rejectionReason" TEXT;

-- Existing orgs are already active
UPDATE "organizations" SET "status" = 'ACTIVE';

-- ── support_contacts ──────────────────────────────────────────────────────────
CREATE TABLE "support_contacts" (
  "id"        TEXT NOT NULL,
  "platform"  TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "label"     TEXT,
  "icon"      TEXT,
  "url"       TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_contacts_pkey" PRIMARY KEY ("id")
);

-- ── support_tickets ───────────────────────────────────────────────────────────
CREATE TABLE "support_tickets" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT,
  "userId"         TEXT,
  "userEmail"      TEXT NOT NULL,
  "userName"       TEXT NOT NULL,
  "subject"        TEXT NOT NULL,
  "message"        TEXT NOT NULL,
  "status"         "TicketStatus"   NOT NULL DEFAULT 'OPEN',
  "priority"       "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "category"       TEXT NOT NULL DEFAULT 'general',
  "adminNotes"     TEXT,
  "resolvedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_tickets_organizationId_idx" ON "support_tickets"("organizationId");
CREATE INDEX "support_tickets_status_idx"         ON "support_tickets"("status");

-- ── Seed default support contacts ─────────────────────────────────────────────
INSERT INTO "support_contacts" ("id","platform","value","label","icon","url","sortOrder","updatedAt") VALUES
  (gen_random_uuid()::text, 'WhatsApp',  '+250787585826',               'WhatsApp — fastest response',  'whatsapp',  'https://wa.me/250787585826',                          1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Phone',     '+250787585826',               'Call us directly',              'phone',     'tel:+250787585826',                                   2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Email',     'byiringirofabrice6@gmail.com','Email support',                 'mail',      'mailto:byiringirofabrice6@gmail.com',                 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Instagram', '@artic_vms',                  'Follow us on Instagram',        'instagram', 'https://instagram.com/artic_vms',                     4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TikTok',    '@artic_vms',                  'Find us on TikTok',             'tiktok',    'https://tiktok.com/@artic_vms',                       5, CURRENT_TIMESTAMP);
