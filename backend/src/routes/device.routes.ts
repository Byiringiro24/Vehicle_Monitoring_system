/**
 * Device remote command routes
 * Allows sending AT commands, USSD codes, and control commands to GPS devices via MQTT
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { publishCommand } from '../services/mqttClient';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// ─── Send a remote command to the GPS device via MQTT ─────────────────────────
// Commands the ESP32 understands on artic/<TOKEN>/command:
//   {"command":"check_internet"}   → device responds with signal quality + IP
//   {"command":"restart"}          → device restarts the SIM808 module
//   {"command":"ussd","code":"*175#"}  → run USSD (e.g. buy data)
//   {"command":"ping"}             → device responds with pong
router.post('/:vehicleId/command', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'),
  async (req: any, res, next) => {
    try {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: req.params.vehicleId, organizationId: req.user.organizationId },
        select: { id: true, licensePlate: true, deviceToken: true },
      });
      if (!vehicle) throw new AppError(404, 'Vehicle not found');

      const { command, ...params } = req.body;
      if (!command) throw new AppError(400, 'command is required');

      const topic = `artic/${vehicle.deviceToken}/command`;
      const sent  = publishCommand(topic, { command, ...params, ts: Date.now() });

      if (!sent) throw new AppError(503, 'MQTT client not connected — cannot send command');

      res.json({
        sent: true,
        vehicleId:    vehicle.id,
        licensePlate: vehicle.licensePlate,
        command,
        topic,
        timestamp:    new Date().toISOString(),
        message:      `Command "${command}" sent to device`,
      });
    } catch (err) { next(err); }
  }
);

// ─── Update SIM card number for a vehicle (with verification) ────────────────
// The ESP32 sends simNumber in its telemetry payload.
// When user sets the SIM on the website, we check if it matches what the device reported.
router.patch('/:vehicleId/sim', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'),
  async (req: any, res, next) => {
    try {
      const { simNumber } = req.body;
      if (!simNumber) throw new AppError(400, 'simNumber is required');

      const vehicle = await prisma.vehicle.findFirst({
        where: { id: req.params.vehicleId, organizationId: req.user.organizationId },
        include: { gpsDevice: { select: { simNumber: true } } },
      });
      if (!vehicle) throw new AppError(404, 'Vehicle not found');

      // Check if the device has reported a SIM number via telemetry
      // It's stored on the gpsDevice record when the device sends it
      const deviceReportedSim = (vehicle as any).gpsDevice?.simNumber ?? null;

      let verified = false;
      let message  = '';

      if (!deviceReportedSim) {
        // Device hasn't reported its SIM yet — save without verification
        message  = 'SIM number saved. Device has not reported its SIM yet — will verify on next connection.';
        verified = false;
      } else if (deviceReportedSim.replace(/\s+/g,'') === simNumber.replace(/\s+/g,'')) {
        message  = `✅ SIM number verified! Matches the SIM reported by the GPS device for ${vehicle.licensePlate}.`;
        verified = true;
      } else {
        message  = `⚠ Warning: The number you entered (${simNumber}) does not match what the GPS device reported (${deviceReportedSim}). Please double-check.`;
        verified = false;
      }

      await (prisma.vehicle as any).update({
        where: { id: req.params.vehicleId },
        data:  { simNumber: simNumber.trim() },
      });

      res.json({ success: true, simNumber: simNumber.trim(), verified, message });
    } catch (err) { next(err); }
  }
);

// ─── Update data plan (internet purchase tracking) ────────────────────────────
router.patch('/:vehicleId/data-plan', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'),
  async (req: any, res, next) => {
    try {
      const { dataPlanType, dataPlanBoughtAt, dataPlanExpiry } = req.body;
      if (!dataPlanType) throw new AppError(400, 'dataPlanType is required (DAILY/WEEKLY/MONTHLY)');

      const vehicle = await prisma.vehicle.findFirst({
        where: { id: req.params.vehicleId, organizationId: req.user.organizationId },
      });
      if (!vehicle) throw new AppError(404, 'Vehicle not found');

      const updated = await (prisma.vehicle as any).update({
        where: { id: req.params.vehicleId },
        data:  {
          dataPlanType,
          dataPlanBoughtAt: dataPlanBoughtAt ? new Date(dataPlanBoughtAt) : new Date(),
          dataPlanExpiry:   dataPlanExpiry   ? new Date(dataPlanExpiry)   : null,
          dataPlanAlertSent: false, // reset alert flag when plan is renewed
        },
      });

      res.json({
        success: true,
        vehicleId:     updated.id,
        dataPlanType:  updated.dataPlanType,
        dataPlanBoughtAt: updated.dataPlanBoughtAt,
        dataPlanExpiry:   updated.dataPlanExpiry,
        message: `${dataPlanType} data plan recorded successfully`,
      });
    } catch (err) { next(err); }
  }
);

export default router;
