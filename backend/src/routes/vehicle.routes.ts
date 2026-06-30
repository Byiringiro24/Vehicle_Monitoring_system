import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { listVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle, regenerateToken } from '../controllers/vehicle.controller';

const router = Router();
router.use(authenticate);
router.get('/', listVehicles);
router.get('/:id', getVehicle);
router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), createVehicle);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), updateVehicle);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteVehicle);
router.post('/:id/regenerate-token', authorize('SUPER_ADMIN', 'ADMIN'), regenerateToken);
export default router;