import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { listAlerts, acknowledge, resolve, listRules, createRule, deleteRule } from '../controllers/alert.controller';

const router = Router();
router.use(authenticate);
router.get('/', listAlerts);
router.patch('/:id/acknowledge', acknowledge);
router.patch('/:id/resolve', resolve);
router.get('/rules', listRules);
router.post('/rules', authorize('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'), createRule);
router.delete('/rules/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteRule);
export default router;