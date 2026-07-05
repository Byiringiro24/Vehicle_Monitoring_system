-- Add vehicleIds array to geofences for per-vehicle assignment
ALTER TABLE "geofences" ADD COLUMN "vehicleIds" TEXT[] NOT NULL DEFAULT '{}';
