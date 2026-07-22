-- Add data plan tracking fields to vehicles for SIM internet alerts
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "dataPlanType"      TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "dataPlanExpiry"    TIMESTAMP(3);
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "dataPlanBoughtAt"  TIMESTAMP(3);
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "dataPlanAlertSent" BOOLEAN NOT NULL DEFAULT false;
