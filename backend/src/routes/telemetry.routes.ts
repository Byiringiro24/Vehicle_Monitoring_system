import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getTelemetry, getLatest, ingestHttp, getFleetLocations } from '../controllers/telemetry.controller';

const router = Router();
// Public device ingestion endpoint
router.post('/ingest/:token', ingestHttp);
// Authenticated endpoints
router.use(authenticate);
router.get('/locations', getFleetLocations);
router.get('/:vehicleId', getTelemetry);
router.get('/:vehicleId/latest', getLatest);
export default router;