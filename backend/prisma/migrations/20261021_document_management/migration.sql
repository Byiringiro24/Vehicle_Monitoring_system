-- ============================================================================
-- Migration: document_management
-- Additive only — creates the documents table and its enums.
-- ============================================================================

CREATE TYPE "DocumentOwnerType" AS ENUM (
  'VEHICLE','DRIVER','USER','ORGANIZATION','CUSTOMER','SUPPLIER'
);

CREATE TYPE "DocumentStatus" AS ENUM (
  'PENDING_UPLOAD','PENDING_REVIEW','VERIFIED','REJECTED','EXPIRED','SUPERSEDED'
);

CREATE TYPE "DocumentCategory" AS ENUM (
  'REGISTRATION_CARD','INSURANCE','INSPECTION_CERTIFICATE','ROAD_TAX',
  'TRANSPORT_PERMIT','COMMERCIAL_LICENSE','TAXI_PERMIT','ROADWORTHINESS',
  'EMISSION_CERTIFICATE','PURCHASE_INVOICE','OWNERSHIP_CERTIFICATE',
  'DRIVING_LICENSE','NATIONAL_ID','PASSPORT','MEDICAL_CERTIFICATE',
  'POLICE_CLEARANCE','EMPLOYMENT_CONTRACT','PHOTO','YELLOW_CARD','OTHER'
);

CREATE TABLE "documents" (
    "id"               TEXT NOT NULL,
    "organizationId"   TEXT NOT NULL,
    "ownerType"        "DocumentOwnerType" NOT NULL,
    "ownerId"          TEXT NOT NULL,
    "category"         "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "label"            TEXT NOT NULL,
    "fileUrl"          TEXT,
    "fileName"         TEXT,
    "fileMimeType"     TEXT,
    "fileSizeBytes"    INTEGER,
    "fileHash"         TEXT,
    "documentNumber"   TEXT,
    "issuer"           TEXT,
    "issuedAt"         TIMESTAMP(3),
    "expiresAt"        TIMESTAMP(3),
    "status"           "DocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "reviewedById"     TEXT,
    "reviewedAt"       TIMESTAMP(3),
    "rejectionReason"  TEXT,
    "notes"            TEXT,
    "version"          INTEGER NOT NULL DEFAULT 1,
    "supersededById"   TEXT,
    "reminderSent30d"  BOOLEAN NOT NULL DEFAULT false,
    "reminderSent7d"   BOOLEAN NOT NULL DEFAULT false,
    "reminderSentExpired" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById"     TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "documents_organizationId_idx"  ON "documents"("organizationId");
CREATE INDEX "documents_owner_idx"           ON "documents"("ownerType","ownerId");
CREATE INDEX "documents_expiresAt_idx"       ON "documents"("expiresAt");
CREATE INDEX "documents_status_idx"          ON "documents"("status");

ALTER TABLE "documents"
    ADD CONSTRAINT "documents_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
