import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import authRoutes         from './routes/auth.routes';
import vehicleRoutes      from './routes/vehicle.routes';
import telemetryRoutes    from './routes/telemetry.routes';
import alertRoutes        from './routes/alert.routes';
import fleetRoutes        from './routes/fleet.routes';
import userRoutes         from './routes/user.routes';
import driverRoutes       from './routes/driver.routes';
import geofenceRoutes     from './routes/geofence.routes';
import reportRoutes       from './routes/report.routes';
import dashboardRoutes    from './routes/dashboard.routes';
import organizationRoutes from './routes/organization.routes';
import financialRoutes    from './routes/financial.routes';
import contractRoutes     from './routes/contracts.routes';
import expenseRoutes      from './routes/expenses.routes';
import deviceRoutes       from './routes/device.routes';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Too many requests' }, standardHeaders: true, legacyHeaders: false,
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'artic-vms-backend', version: '1.0.0', timestamp: new Date().toISOString() });
});

const api = '/api/v1';
app.use(`${api}/auth`,          authLimiter, authRoutes);
app.use(`${api}/organizations`, apiLimiter,  organizationRoutes);
app.use(`${api}/users`,         apiLimiter,  userRoutes);
app.use(`${api}/fleets`,        apiLimiter,  fleetRoutes);
app.use(`${api}/vehicles`,      apiLimiter,  vehicleRoutes);
app.use(`${api}/telemetry`,     apiLimiter,  telemetryRoutes);
app.use(`${api}/alerts`,        apiLimiter,  alertRoutes);
app.use(`${api}/drivers`,       apiLimiter,  driverRoutes);
app.use(`${api}/geofences`,     apiLimiter,  geofenceRoutes);
app.use(`${api}/reports`,       apiLimiter,  reportRoutes);
app.use(`${api}/dashboard`,     apiLimiter,  dashboardRoutes);
app.use(`${api}/financial`,     apiLimiter,  financialRoutes);
app.use(`${api}/contracts`,     apiLimiter,  contractRoutes);
app.use(`${api}/expenses`,      apiLimiter,  expenseRoutes);
app.use(`${api}/devices`,       apiLimiter,  deviceRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
