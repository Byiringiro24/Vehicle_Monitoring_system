import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { listVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle,
         regenerateToken, getGpsHistory, getTrips } from '../controllers/vehicle.controller';
import { prisma } from '../config/database';
import { getSocketServer, markLockCommandSent } from '../websocket/socketServer';
import { publishCommand } from '../services/mqttClient';
import { pingGpsDevice } from '../services/mqttBroker';

const router = Router();
router.use(authenticate);

router.get('/',    listVehicles);
router.get('/:id', getVehicle);
router.post('/',      authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), createVehicle);
router.put('/:id',    authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), updateVehicle);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteVehicle);
router.post('/:id/regenerate-token', authorize('SUPER_ADMIN', 'ADMIN'), regenerateToken);

// ─── GPS Ping — check if GPS module is online ─────────────────────────────────
router.post('/:id/gps-ping', async (req: any, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where:  { id: req.params.id, organizationId: req.user.organizationId },
      select: { id: true, licensePlate: true, gpsDevice: { select: { status: true, lastCommunication: true } } },
    });
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return; }

    const responded = await pingGpsDevice(vehicle.id, 8000);

    // Update gpsDevice lastCommunication if responded
    if (responded) {
      await prisma.gpsDevice.updateMany({
        where: { vehicleId: vehicle.id },
        data:  { lastCommunication: new Date(), status: 'ACTIVE' },
      });
    }

    res.json({
      vehicleId:   vehicle.id,
      licensePlate: vehicle.licensePlate,
      gpsOnline:   responded,
      checkedAt:   new Date().toISOString(),
      message:     responded ? 'GPS module is online and responding' : 'GPS module did not respond — device may be offline or out of range',
    });
  } catch (err) { next(err); }
});

// ─── GPS history for map replay ───────────────────────────────────────────────
router.get('/:vehicleId/gps-history', getGpsHistory);
router.get('/:vehicleId/trips',       getTrips);

// ─── Lock / Unlock engine relay ───────────────────────────────────────────────
router.patch('/:id/lock', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const locked = !!req.body.locked;
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return; }
    await prisma.vehicle.update({ where: { id: req.params.id }, data: { engineLocked: locked } });

    // 1. Publish MQTT command → ESP32 on its specific token topic
    publishCommand(`artic/${vehicle.deviceToken}/command`, {
      command:   locked ? 'lock' : 'unlock',
      vehicleId: vehicle.id,
      timestamp: new Date().toISOString(),
    });

    // Mark lock grace period — suppress false OFFLINE events for 30s
    // (device may briefly restart if relay cuts its power source)
    if (locked) markLockCommandSent(vehicle.id);

    // 2. Broadcast via Socket.IO → dashboard updates in real-time
    const io = getSocketServer();
    if (io) {
      io.to(`org:${req.user.organizationId}`).emit('vehicle:lock', {
        vehicleId:    vehicle.id,
        licensePlate: vehicle.licensePlate,
        locked,
        triggeredBy:  req.user.email,
        timestamp:    new Date().toISOString(),
      });
    }
    res.json({ vehicleId: vehicle.id, licensePlate: vehicle.licensePlate, engineLocked: locked,
      message: locked ? 'Engine lock command sent' : 'Engine unlock command sent' });
  } catch (err) { next(err); }
});

export default router;
