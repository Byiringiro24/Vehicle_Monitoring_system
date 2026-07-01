import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt';
import { JwtPayload } from '../types';
import logger from '../utils/logger';

let io: SocketIOServer | null = null;

export function getSocketServer(): SocketIOServer | null { return io; }

export function initSocketServer(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true },
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
    socket.on('disconnect', () => logger.info(`WS disconnected: ${user.email}`));
  });

  logger.info('Socket.IO server initialised');
}
