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

// ─── Update SIM card number for a vehicle ─────────────────────────────────────
router.patch('/:vehicleId/sim', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'),
  async (req: any, res, next) => {
    try {
      const { simNumber } = req.body;
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: req.params.vehicleId, organizationId: req.user.organizationId },
      });
      if (!vehicle) throw new AppError(404, 'Vehicle not found');

      const updated = await (prisma.vehicle as any).update({
        where: { id: req.params.vehicleId },
        data:  { simNumber: simNumber ?? null },
      });
      res.json({ id: updated.id, licensePlate: updated.licensePlate, simNumber: updated.simNumber ?? null });
    } catch (err) { next(err); }
  }
);

export default router;
