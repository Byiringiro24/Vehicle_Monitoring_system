import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { listVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle,
         regenerateToken, getGpsHistory, getTrips } from '../controllers/vehicle.controller';
import { prisma } from '../config/database';
import { getSocketServer } from '../websocket/socketServer';

const router = Router();
router.use(authenticate);

router.get('/',    listVehicles);
router.get('/:id', getVehicle);
router.post('/',      authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), createVehicle);
router.put('/:id',    authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), updateVehicle);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteVehicle);
router.post('/:id/regenerate-token', authorize('SUPER_ADMIN', 'ADMIN'), regenerateToken);

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
