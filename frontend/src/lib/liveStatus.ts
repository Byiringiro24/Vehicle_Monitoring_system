/**
 * Live status utility — no Leaflet dependency, safe for SSR.
 * Status is computed purely from the last telemetry timestamp.
 *
 * ACTIVE  = telemetry received < 30s ago AND engineOn
 * IDLE    = telemetry received < 30s ago AND !engineOn
 * OFFLINE = no telemetry for > 30s
 */

export const STALE_MS = 30_000; // 30s = 2× the 15s ESP32 send interval

export type LiveStatus = 'ACTIVE' | 'IDLE' | 'OFFLINE';

export function getLiveStatus(
  updatedAt: string | null | undefined,
  engineOn: boolean
): LiveStatus {
  if (!updatedAt) return 'OFFLINE';
  if (Date.now() - new Date(updatedAt).getTime() > STALE_MS) return 'OFFLINE';
  return engineOn ? 'ACTIVE' : 'IDLE';
}
