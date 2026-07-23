/**
 * Live GPS status — based on MQTT connectivity only.
 *
 * Device sends every 2s, so STALE = 10s (5 missed packets before offline).
 * Status is ONLINE as long as ANY message arrived in the last 10s.
 * Engine lock has NO effect on GPS status.
 *
 * ACTIVE  = message < STALE_MS ago AND speed >= SPEED_THRESHOLD km/h
 * IDLE    = message < STALE_MS ago AND speed <  SPEED_THRESHOLD km/h
 * OFFLINE = no message for > STALE_MS
 *
 * SPEED_THRESHOLD = 2 km/h — real movement threshold.
 * This is the single source of truth used across the entire codebase.
 */

export const STALE_MS        = 10_000; // 10s = 5x the 2s send interval
export const SPEED_THRESHOLD = 2;      // km/h

export type LiveStatus = 'ACTIVE' | 'IDLE' | 'OFFLINE';

export function getLiveStatus(
  updatedAt: string | null | undefined,
  speed?: number | null,
  _engineOn?: boolean,
): LiveStatus {
  if (!updatedAt) return 'OFFLINE';
  if (Date.now() - new Date(updatedAt).getTime() > STALE_MS) return 'OFFLINE';
  return (speed ?? 0) >= SPEED_THRESHOLD ? 'ACTIVE' : 'IDLE';
}
