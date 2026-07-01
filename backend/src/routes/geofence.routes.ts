import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { listGeofences, createGeofence, updateGeofence, deleteGeofence, getGeofenceEvents } from '../controllers/geofence.controller';

const router = Router();
router.use(authenticate);
router.get('/', listGeofences);
router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), createGeofence);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), updateGeofence);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteGeofence);
router.get('/:id/events', getGeofenceEvents);
export default router;