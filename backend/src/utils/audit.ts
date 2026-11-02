/**
 * ARTIC VMS — Audit Logger
 * Logs sensitive actions to the audit_logs table.
 * Fire-and-forget — never crashes a request.
 */
import { prisma } from '../config/database';
import logger from './logger';

interface AuditParams {
  organizationId?: string | null;
  userId?:         string;
  action:          string;   // e.g. 'vehicle.lock', 'org.approve', 'user.create'
  targetType?:     string;
  targetId?:       string;
  before?:         object;
  after?:          object;
  ipAddress?:      string;
  userAgent?:      string;
}

export async function auditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        userId:         params.userId         ?? null,
        action:         params.action,
        targetType:     params.targetType     ?? null,
        targetId:       params.targetId       ?? null,
        before:         params.before         ?? undefined,
        after:          params.after          ?? undefined,
        ipAddress:      params.ipAddress      ?? null,
        userAgent:      params.userAgent      ?? null,
      },
    });
  } catch (err: any) {
    logger.warn(`[AUDIT] Failed to write log: ${err.message}`);
  }
}

export function getIp(req: any): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.ip ??
    'unknown'
  );
}
