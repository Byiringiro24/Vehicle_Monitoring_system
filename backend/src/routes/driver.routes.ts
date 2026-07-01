import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { listDrivers, createDriver, assignDriver, getDriverActivity } from '../controllers/driver.controller';

const router = Router();
router.use(authenticate);
router.get('/', listDrivers);
router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), createDriver);
router.patch('/:id/assign', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), assignDriver);
router.get('/:id/activity', getDriverActivity);
export default router;