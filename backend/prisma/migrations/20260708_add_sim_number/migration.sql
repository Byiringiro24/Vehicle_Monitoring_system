-- Add SIM card number field to vehicles
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "simNumber" TEXT;
