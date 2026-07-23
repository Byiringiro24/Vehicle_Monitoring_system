import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt';
import { JwtPayload } from '../types';
import { prisma } from '../config/database';
import logger from '../utils/logger';

let io: SocketIOServer | null = null;

export function getSocketServer(): SocketIOServer | null { return io; }

// Exported so mqttClient can share its lastSeen state
const lastSeenByVehicleId = new Map<string, number>();
export function markVehicleSeen(vehicleId: string) { lastSeenByVehicleId.set(vehicleId, Date.now()); }
export function markVehicleOffline(vehicleId: string) { lastSeenByVehicleId.delete(vehicleId); }
export function isVehicleOnline(vehicleId: string, thresholdMs = 15_000): boolean {
  const ts = lastSeenByVehicleId.get(vehicleId);
  return ts !== undefined && Date.now() - ts < thresholdMs;
}

// Grace period after a lock command — device may restart momentarily when relay cuts
// Don't emit gps:offline for this vehicle during this window
const lockGracePeriod = new Map<string, number>();
const LOCK_GRACE_MS = 30_000; // 30s grace after lock command

export function markLockCommandSent(vehicleId: string) {
  lockGracePeriod.set(vehicleId, Date.now());
  logger.info(`[LOCK] Grace period started for vehicle ${vehicleId}`);
}

export function isInLockGrace(vehicleId: string): boolean {
  const ts = lockGracePeriod.get(vehicleId);
  if (!ts) return false;
  if (Date.now() - ts > LOCK_GRACE_MS) {
    lockGracePeriod.delete(vehicleId);
    return false;
  }
  return true;
}

export function initSocketServer(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
        .split(',').map(o => o.trim()),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token ?? socket.handshake.headers.authorization?.replace('Bearer ', '');
    if (!token) { next(new Error('Authentication required')); return; }
    try {
      const payload = jwt.verify(token, jwtConfig.secret) as JwtPayload;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as JwtPayload;
    logger.info(`WS connected: ${user.email}`);

    // Join organisation room for scoped broadcasts
    socket.join(`org:${user.organizationId}`);

    socket.on('subscribe:vehicle', (vehicleId: string) => {
      socket.join(`vehicle:${vehicleId}`);
    });
    socket.on('unsubscribe:vehicle', (vehicleId: string) => {
      socket.leave(`vehicle:${vehicleId}`);
    });

    // Frontend reconnected and is asking: is this device currently online?
    // We reply immediately with the live status from our in-memory tracker
    socket.on('request:status', async (vehicleId: string) => {
      try {
        const online = isVehicleOnline(vehicleId);
        if (online) {
          // Fetch last known location to send back
          const last = await prisma.lastLocation.findUnique({ where: { vehicleId } });
          socket.emit('gps:online', {
            vehicleId,
            timestamp: new Date().toISOString(),
            ...(last ? { speed: last.speed, updatedAt: last.updatedAt?.toISOString() } : {}),
          });
          socket.emit('device:heartbeat', {
            vehicleId,
            updatedAt: last?.updatedAt?.toISOString() ?? new Date().toISOString(),
          });
        }
      } catch (err) {
        logger.warn(`request:status error: ${err}`);
      }
    });

    socket.on('disconnect', () => logger.info(`WS disconnected: ${user.email}`));
  });

  logger.info('Socket.IO server initialised');
}
