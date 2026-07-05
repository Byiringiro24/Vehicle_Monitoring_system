import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { listGeofences, createGeofence, updateGeofence, deleteGeofence, getGeofenceEvents } from '../controllers/geofence.controller';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);
router.get('/', listGeofences);
router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), createGeofence);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), updateGeofence);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteGeofence);
router.get('/:id/events', getGeofenceEvents);

// Assign/update vehicles for a geofence
router.patch('/:id/vehicles', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), async (req: any, res, next) => {
  try {
    const { vehicleIds } = req.body; // array of vehicleIds or [] for all
    const geo = await prisma.geofence.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!geo) throw new AppError(404, 'Geofence not found');
    const updated = await (prisma.geofence as any).update({
      where: { id: req.params.id },
      data:  { vehicleIds: vehicleIds ?? [] },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;