/**
 * Live GPS status utility — completely independent of engine lock state.
 *
 * GPS status is based ONLY on:
 *   - Whether telemetry is being received (timestamp freshness)
 *   - Speed (for ACTIVE vs IDLE)
 *
 * Engine lock (relay) does NOT affect GPS status.
 * A locked vehicle still has GPS running if the SIM808 is powered.
 *
 * ACTIVE  = GPS packet received < 45s ago AND speed > 2 km/h
 * IDLE    = GPS packet received < 45s ago AND speed ≤ 2 km/h
 * OFFLINE = No GPS packet for > 45s (= 3× the 15s send interval)
 */

export const STALE_MS = 45_000; // 45s — 3 × 15s ESP32 send interval

export type LiveStatus = 'ACTIVE' | 'IDLE' | 'OFFLINE';

export function getLiveStatus(
  updatedAt: string | null | undefined,
  speed?: number | null,
  // engineOn kept for backwards compat but IGNORED for GPS status
  _engineOn?: boolean,
): LiveStatus {
  if (!updatedAt) return 'OFFLINE';
  if (Date.now() - new Date(updatedAt).getTime() > STALE_MS) return 'OFFLINE';
  // GPS is active — determine moving vs stationary from speed
  return (speed ?? 0) > 2 ? 'ACTIVE' : 'IDLE';
}
