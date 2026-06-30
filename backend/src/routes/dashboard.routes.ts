import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboardStats } from '../controllers/dashboard.controller';

const router = Router();
router.use(authenticate);
router.get('/stats', getDashboardStats);
export default router;