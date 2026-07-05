/**
 * Reverse geocoding using Nominatim (OpenStreetMap) — free, no API key.
 * Returns a human-readable address string or null.
 *
 * Rate limit: max 1 request/second per Nominatim policy.
 * Cache results so repeated calls for the same lat/lon don't re-fetch.
 */

const cache = new Map<string, string>();

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  // Round to 4 decimal places (~11m precision) for cache key
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'ARTIC-VMS/1.0' },
    });
    if (!res.ok) return null;

    const data = await res.json();

    // Build a concise address from the response
    const a = data.address ?? {};
    const parts = [
      a.road ?? a.pedestrian ?? a.footway,
      a.neighbourhood ?? a.suburb ?? a.quarter,
      a.city ?? a.town ?? a.village ?? a.county,
      a.country,
    ].filter(Boolean);

    const address = parts.length ? parts.join(', ') : (data.display_name ?? null);
    if (address) cache.set(key, address);
    return address;
  } catch {
    return null;
  }
}
