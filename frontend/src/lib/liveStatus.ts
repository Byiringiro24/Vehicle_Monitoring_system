/**
 * Live GPS status — based on MQTT connectivity only.
 *
 * Device sends every 2s, so STALE = 10s (5 missed packets before offline).
 * Status is ONLINE as long as ANY message arrived in the last 10s.
 * Engine lock has no effect on GPS status.
 *
 * ACTIVE  = message < 10s ago AND speed > 5 km/h  → moving
 * IDLE    = message < 10s ago AND speed ≤ 5 km/h  → stationary but online
 * OFFLINE = no message for > 10s                  → connection lost
 *
 * Threshold is 5 km/h (not 2) because SIM808 GPS noise can reach 3–4 km/h
 * when truly stationary due to satellite geometry drift.
 */

export const STALE_MS    = 10_000; // 10s = 5× the 2s send interval
export const SPEED_THRESHOLD = 5;  // km/h — below this = IDLE

export type LiveStatus = 'ACTIVE' | 'IDLE' | 'OFFLINE';

export function getLiveStatus(
  updatedAt: string | null | undefined,
  speed?: number | null,
  _engineOn?: boolean,
): LiveStatus {
  if (!updatedAt) return 'OFFLINE';
  if (Date.now() - new Date(updatedAt).getTime() > STALE_MS) return 'OFFLINE';
  return (speed ?? 0) > SPEED_THRESHOLD ? 'ACTIVE' : 'IDLE';
}
