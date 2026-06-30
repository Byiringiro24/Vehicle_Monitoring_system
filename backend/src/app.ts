import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import authRoutes from './routes/auth.routes';
import vehicleRoutes from './routes/vehicle.routes';
import telemetryRoutes from './routes/telemetry.routes';
import alertRoutes from './routes/alert.routes';
import fleetRoutes from './routes/fleet.routes';
import userRoutes from './routes/user.routes';
import geofenceRoutes from './routes/geofence.routes';
import reportRoutes from './routes/report.routes';
import dashboardRoutes from './routes/dashboard.routes';
import organizationRoutes from './routes/organization.routes';

const app = express();

// ─── Security & Middleware ────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'artic-vms-backend', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const api = '/api/v1';
app.use(${api}/auth, authRoutes);
app.use(${api}/organizations, organizationRoutes);
app.use(${api}/users, userRoutes);
app.use(${api}/fleets, fleetRoutes);
app.use(${api}/vehicles, vehicleRoutes);
app.use(${api}/telemetry, telemetryRoutes);
app.use(${api}/alerts, alertRoutes);
app.use(${api}/geofences, geofenceRoutes);
app.use(${api}/reports, reportRoutes);
app.use(${api}/dashboard, dashboardRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;