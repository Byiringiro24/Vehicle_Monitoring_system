import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { initSocketServer } from './websocket/socketServer';
import { initMqttBroker } from './services/mqttBroker';
import { initMqttClient } from './services/mqttClient';
import { verifySmtpConnection } from './services/email.service';
import { prisma } from './config/database';
import { redis } from './config/redis';
import logger from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const MQTT_PORT = parseInt(process.env.MQTT_PORT ?? '1883', 10);

async function bootstrap() {
  // Test DB connection
  await prisma.$connect();
  logger.info('PostgreSQL connected');

  // Test Redis
  await redis.ping();
  logger.info('Redis connected');

  // Verify SMTP (non-blocking — a misconfigured SMTP should not prevent startup)
  verifySmtpConnection().catch(() => {});

  // HTTP + Socket.IO server
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  // MQTT broker on port 1884 (Aedes) — ESP32 connects to mosquitto on 1883
  // Backend bridges mosquitto↔Aedes via mqttClient subscription
  const AEDES_PORT = parseInt(process.env.AEDES_PORT ?? '1884', 10);
  try {
    initMqttBroker(AEDES_PORT);
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      logger.warn(`Aedes port ${AEDES_PORT} already in use.`);
    } else {
      throw err;
    }
  }

  // MQTT publisher client — used to send lock/unlock commands to devices
  initMqttClient();

  // ── Auto-ping job — ping all vehicles every 15 seconds ────────────────────
  // This keeps the gps:online/gps:offline events accurate and auto-resolves
  // GPS status without requiring manual button clicks
  setInterval(async () => {
    try {
      const { getMqttClient } = await import('./services/mqttClient');
      const mqttClient = getMqttClient();
      if (!mqttClient?.connected) return;

      // Get all vehicles with device tokens
      const vehicles = await prisma.vehicle.findMany({
        select: { id: true, deviceToken: true, organizationId: true },
      });

      for (const vehicle of vehicles) {
        const pingTopic = `artic/${vehicle.deviceToken}/ping`;
        mqttClient.publish(pingTopic, JSON.stringify({ ts: Date.now(), auto: true }), { qos: 0 });
      }

      if (vehicles.length > 0) {
        logger.debug(`Auto-pinged ${vehicles.length} device(s)`);
      }
    } catch (err) {
      logger.error('Auto-ping error', err);
    }
  }, 15_000);

  // ── Offline detection job ──────────────────────────────────────────────────
  // Every 60 seconds: mark vehicles OFFLINE if their last telemetry is > 3 minutes old
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
      const stale = await prisma.vehicle.findMany({
        where: {
          status: { in: ['ACTIVE', 'IDLE'] },
          lastLocation: { updatedAt: { lt: cutoff } },
        },
        select: { id: true, licensePlate: true, organizationId: true },
      });
      if (stale.length > 0) {
        await prisma.vehicle.updateMany({
          where: { id: { in: stale.map(v => v.id) } },
          data:  { status: 'OFFLINE' },
        });
        // Notify dashboard via Socket.IO
        const io = (await import('./websocket/socketServer')).getSocketServer();
        if (io) {
          const orgGroups = stale.reduce((acc: Record<string, string[]>, v) => {
            (acc[v.organizationId] ??= []).push(v.id);
            return acc;
          }, {});
          for (const [orgId, ids] of Object.entries(orgGroups)) {
            io.to(`org:${orgId}`).emit('vehicles:offline', { vehicleIds: ids, timestamp: new Date().toISOString() });
          }
        }
        logger.info(`Marked ${stale.length} vehicle(s) OFFLINE: ${stale.map(v => v.licensePlate).join(', ')}`);
      }
    } catch (err) {
      logger.error('Offline detection error', err);
    }
  }, 60_000);

  // ── Payment overdue escalation — runs daily at midnight UTC ──────────────
  // Marks PENDING scheduled payments as OVERDUE when dueDate has passed.
  setInterval(async () => {
    try {
      const now = new Date();
      const result = await prisma.scheduledPayment.updateMany({
        where: { status: 'PENDING', dueDate: { lt: now } },
        data:  { status: 'OVERDUE' },
      });
      if (result.count > 0) {
        logger.info(`[AGREEMENTS] Marked ${result.count} payment(s) OVERDUE`);
        // Update overdueAmount on affected agreements
        const overdueSPs = await prisma.scheduledPayment.findMany({
          where: { status: 'OVERDUE' },
          select: { agreementId: true, amountDue: true, amountPaid: true },
        });
        const overdueByAgreement = overdueSPs.reduce((acc: Record<string, number>, sp) => {
          acc[sp.agreementId] = (acc[sp.agreementId] ?? 0) + (sp.amountDue - sp.amountPaid);
          return acc;
        }, {});
        await Promise.all(
          Object.entries(overdueByAgreement).map(([id, overdueAmount]) =>
            prisma.agreement.update({ where: { id }, data: { overdueAmount } })
          )
        );
      }
    } catch (err) {
      logger.error('Payment overdue escalation error', err);
    }
  }, 24 * 60 * 60 * 1000); // every 24 hours

  // ── Document expiry monitoring — runs every 6 hours ──────────────────────  // Marks expired documents, sends 30-day, 7-day and expiry email alerts.
  setInterval(async () => {
    try {
      const now   = new Date();
      const in30d = new Date(Date.now() + 30 * 86400000);
      const in7d  = new Date(Date.now() +  7 * 86400000);

      // 1. Auto-mark expired documents
      await prisma.document.updateMany({
        where: { expiresAt: { lt: now }, status: { in: ['VERIFIED', 'PENDING_REVIEW', 'PENDING_UPLOAD'] } },
        data:  { status: 'EXPIRED' },
      });

      // 2. Find docs expiring in 30d that haven't been alerted yet
      const expiring30 = await prisma.document.findMany({
        where: { expiresAt: { gte: now, lte: in30d }, status: 'VERIFIED', reminderSent30d: false },
        select: { id: true, label: true, category: true, expiresAt: true, ownerId: true, ownerType: true, organizationId: true },
        take: 50,
      });

      // 3. Find docs expiring in 7d that haven't been alerted yet
      const expiring7 = await prisma.document.findMany({
        where: { expiresAt: { gte: now, lte: in7d }, status: 'VERIFIED', reminderSent7d: false },
        select: { id: true, label: true, category: true, expiresAt: true, ownerId: true, ownerType: true, organizationId: true },
        take: 50,
      });

      // Group by org and send one email per org per batch
      const { sendDocumentExpiryEmail } = await import('./services/email.service');
      const orgMap = new Map<string, typeof expiring30>();

      for (const doc of [...expiring30, ...expiring7]) {
        const existing = orgMap.get(doc.organizationId) ?? [];
        existing.push(doc);
        orgMap.set(doc.organizationId, existing);
      }

      for (const [orgId, docs] of orgMap.entries()) {
        const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { email: true, name: true } });
        if (!org?.email) continue;

        const docItems = docs.map(d => ({
          label:      d.label,
          identifier: d.ownerType + ':' + d.ownerId.slice(0, 8),
          expiryDate: d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : '—',
          daysLeft:   d.expiresAt ? Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86400000) : 0,
        }));

        sendDocumentExpiryEmail(org.email, org.name, docItems).catch(() => {});

        // Mark reminders sent
        const ids30 = expiring30.filter(d => d.organizationId === orgId).map(d => d.id);
        const ids7  = expiring7.filter(d => d.organizationId === orgId).map(d => d.id);
        if (ids30.length) await prisma.document.updateMany({ where: { id: { in: ids30 } }, data: { reminderSent30d: true } });
        if (ids7.length)  await prisma.document.updateMany({ where: { id: { in: ids7  } }, data: { reminderSent7d:  true } });
      }

      if (expiring30.length + expiring7.length > 0) {
        logger.info(`[DOCS] Expiry check: ${expiring30.length} 30d alerts, ${expiring7.length} 7d alerts sent`);
      }
    } catch (err) {
      logger.error('Document expiry check error', err);
    }
  }, 6 * 60 * 60 * 1000); // every 6 hours

  // ── Data plan expiry alert job — runs every hour ──────────────────────────  // Sends alerts when a vehicle's SIM data plan is about to expire:
  //   Monthly plan → alert 3 days before
  //   Weekly plan  → alert 1 day before
  //   Daily plan   → alert 3 hours before
  setInterval(async () => {
    try {
      const vehicles = await (prisma.vehicle as any).findMany({
        where: {
          dataPlanExpiry:    { not: null },
          dataPlanAlertSent: false,
        },
        select: {
          id: true, licensePlate: true, name: true,
          organizationId: true, dataPlanType: true, dataPlanExpiry: true,
        },
      });

      const now = Date.now();
      const io  = (await import('./websocket/socketServer')).getSocketServer();

      for (const v of vehicles) {
        const expiryMs  = new Date(v.dataPlanExpiry).getTime();
        const remaining = expiryMs - now;
        if (remaining <= 0) continue;

        const alertThreshold =
          v.dataPlanType === 'MONTHLY' ? 3 * 24 * 60 * 60 * 1000  // 3 days
          : v.dataPlanType === 'WEEKLY' ?     24 * 60 * 60 * 1000  // 1 day
          : v.dataPlanType === 'DAILY'  ?      3 * 60 * 60 * 1000  // 3 hours
          : null;

        if (alertThreshold && remaining <= alertThreshold) {
          // Create alert
          await prisma.alert.create({
            data: {
              vehicleId: v.id,
              type:      'CUSTOM' as any,
              severity:  'HIGH',
              title:     `Data Plan Expiring: ${v.licensePlate}`,
              message:   `${v.name} (${v.licensePlate}) ${v.dataPlanType} data plan expires in ${Math.round(remaining / 3600000)}h`,
              metadata:  { dataPlanType: v.dataPlanType, expiry: v.dataPlanExpiry },
            },
          });

          // Mark as alerted so we don't spam
          await (prisma.vehicle as any).update({
            where: { id: v.id },
            data:  { dataPlanAlertSent: true },
          });

          // Notify dashboard
          if (io) {
            io.to(`org:${v.organizationId}`).emit('alert:new', {
              title:   `Data Plan Expiring: ${v.licensePlate}`,
              message: `${v.dataPlanType} plan expires soon`,
              severity: 'HIGH',
              vehicle: { name: v.name },
            });
          }

          logger.info(`[DATA PLAN] Alert sent for ${v.licensePlate} — ${v.dataPlanType} expires soon`);
        }
      }
    } catch (err) {
      logger.error('Data plan alert job error', err);
    }
  }, 60 * 60 * 1000); // run every hour

  httpServer.listen(PORT, () => {
    logger.info(`ARTIC VMS backend running on port ${PORT}`);
    logger.info(`MQTT broker running on port ${MQTT_PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
