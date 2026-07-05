import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getTelemetry, getLatest, ingestHttp, getFleetLocations, deleteTelemetry } from '../controllers/telemetry.controller';

const router = Router();
// Public device ingestion endpoint
router.post('/ingest/:token', ingestHttp);
// Authenticated endpoints
router.use(authenticate);
router.get('/locations', getFleetLocations);
router.get('/:vehicleId', getTelemetry);
router.get('/:vehicleId/latest', getLatest);
// Delete telemetry + GPS history for a vehicle within a date range
router.delete('/:vehicleId', authorize('SUPER_ADMIN', 'ADMIN'), deleteTelemetry);
export default router;