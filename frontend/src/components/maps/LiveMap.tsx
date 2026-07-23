'use client';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Tooltip } from 'react-leaflet';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatSpeed, formatFuel, formatDate } from '@/lib/utils';
import { getLiveStatus, SPEED_THRESHOLD } from '@/lib/liveStatus';
import { reverseGeocode } from '@/lib/geocode';

// Re-export so pages can import without pulling in Leaflet (avoids SSR window error)
export { getLiveStatus, SPEED_THRESHOLD } from '@/lib/liveStatus';

// Fix default Leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:  '#22c55e',
  IDLE:    '#f59e0b',
  OFFLINE: '#6b7280',
};

function createIcon(status: string, plate: string, selected: boolean) {
  const color = STATUS_COLOR[status] ?? '#6b7280';
  const dot   = selected ? 16 : 11;
  const pulse = status === 'ACTIVE';
  return L.divIcon({
    html: `
      <div style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none">
        <div style="background:white;border:2.5px solid ${color};color:${color};font-size:9px;font-weight:800;
             padding:1px 6px;border-radius:5px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.2);letter-spacing:.5px">
          ${plate.replace(/\s+/g, '').slice(-8)}
        </div>
        <div style="position:relative;width:${dot + 10}px;height:${dot + 10}px;display:flex;align-items:center;justify-content:center">
          ${pulse ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.2;animation:lm-ping 1.5s ease-out infinite"></div>` : ''}
          <div style="width:${dot}px;height:${dot}px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.25)"></div>
        </div>
      </div>
      <style>@keyframes lm-ping{0%{transform:scale(1);opacity:.3}100%{transform:scale(2.5);opacity:0}}</style>
    `,
    className: '',
    iconSize:   [60, selected ? 42 : 34],
    iconAnchor: [30, selected ? 42 : 34],
  });
}

// Address lookup shown inside Popup
function GeoAddress({ lat, lon }: { lat: number; lon: number }) {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    reverseGeocode(lat, lon).then(addr => {
      if (!cancelled) { setAddress(addr); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [lat, lon]);
  if (loading) return <p style={{ color: '#9ca3af', fontSize: 10, margin: '4px 0' }}>📍 Looking up address…</p>;
  if (!address) return <p style={{ color: '#9ca3af', fontSize: 10, margin: '4px 0' }}>📍 Address unavailable</p>;
  return <p style={{ color: '#374151', fontSize: 11, margin: '5px 0', lineHeight: 1.4 }}>📍 {address}</p>;
}

// Auto-follow selected vehicle when its position updates
function FollowSelected({ locations, selectedId }: { locations: LocationData[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const loc = locations.find(l => l.vehicleId === selectedId);
    if (loc?.latitude && loc?.longitude) {
      map.panTo([loc.latitude, loc.longitude], { animate: true, duration: 0.5 });
    }
  }, [locations, selectedId, map]);
  return null;
}

// Fit all markers on first load
function FitBounds({ locations }: { locations: LocationData[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || locations.length === 0) return;
    try {
      const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
        done.current = true;
      }
    } catch {}
  }, [locations, map]);
  return null;
}

// ── Public types ──────────────────────────────────────────────────────────────
export interface VehicleInfo {
  id: string; name: string; licensePlate: string; status: string;
  fleet?: { name: string; color: string } | null;
}

export interface LocationData {
  vehicleId: string;
  latitude: number; longitude: number;
  speed: number; heading: number;
  fuelLevel?: number | null; engineTemp?: number | null;
  engineOn: boolean; accuracy?: number | null;
  address?: string | null; updatedAt: string;
  vehicle?: VehicleInfo | null;
}

interface Props {
  locations: LocationData[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Set of vehicleIds currently connected to MQTT — used as ground truth for online status */
  connectedDevices?: Set<string>;
}

export default function LiveMap({ locations, selectedId, onSelect, connectedDevices = new Set() }: Props) {

  // Resolve status: MQTT connection is ground truth, timestamp staleness is fallback
  // GPS status is based on speed, NOT engine lock state
  function resolveStatus(loc: LocationData): 'ACTIVE' | 'IDLE' | 'OFFLINE' {
    if (connectedDevices.has(loc.vehicleId)) {
      return (loc.speed ?? 0) > SPEED_THRESHOLD ? 'ACTIVE' : 'IDLE';
    }
    return getLiveStatus(loc.updatedAt, loc.speed);
  }

  // Only render vehicles with valid GPS coordinates
  const valid = locations.filter(l =>
    l.latitude  != null && l.longitude != null &&
    Math.abs(l.latitude)  > 0.0001 &&
    Math.abs(l.longitude) > 0.0001
  );

  const center: [number, number] = valid.length
    ? [valid[0].latitude, valid[0].longitude]
    : [-1.9403, 29.8739]; // Kigali default

  const activeCount  = valid.filter(l => resolveStatus(l) === 'ACTIVE').length;
  const idleCount    = valid.filter(l => resolveStatus(l) === 'IDLE').length;
  const offlineCount = valid.filter(l => resolveStatus(l) === 'OFFLINE').length;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* Legend */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 1000,
        background: 'white', borderRadius: 10, padding: '10px 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,.15)', fontSize: 11,
        display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160,
        border: '1px solid #e5e7eb',
      }}>
        <div style={{ fontWeight: 700, color: '#111', fontSize: 12 }}>
          {valid.length} vehicle{valid.length !== 1 ? 's' : ''} on map
        </div>
        {[
          { color: '#22c55e', label: `● Active (${activeCount})` },
          { color: '#f59e0b', label: `● Idle (${idleCount})` },
          { color: '#6b7280', label: `● Offline (${offlineCount})` },
        ].map(({ color, label }) => (
          <div key={label} style={{ color, fontWeight: 600 }}>{label}</div>
        ))}
        <div style={{ color: '#9ca3af', fontSize: 9, borderTop: '1px solid #f3f4f6', paddingTop: 4, marginTop: 2 }}>
          Live · updates every 2s
        </div>
      </div>

      <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <FitBounds locations={valid} />
        <FollowSelected locations={valid} selectedId={selectedId} />

        {valid.map(loc => {
          const status     = resolveStatus(loc);
          const color      = STATUS_COLOR[status] ?? '#6b7280';
          const isSelected = selectedId === loc.vehicleId;
          const plate      = loc.vehicle?.licensePlate ?? loc.vehicleId.slice(0, 8);
          const pos: [number, number] = [loc.latitude, loc.longitude];

          return (
            <div key={loc.vehicleId}>
              {/* Accuracy circle */}
              {loc.accuracy && loc.accuracy > 0 && loc.accuracy < 500 && (
                <Circle
                  center={pos}
                  radius={loc.accuracy}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.07, weight: 1, opacity: 0.35 }}
                />
              )}

              {/* Vehicle marker — react-leaflet moves it automatically when position prop changes */}
              <Marker
                position={pos}
                icon={createIcon(status, plate, isSelected)}
                eventHandlers={{ click: () => onSelect(loc.vehicleId) }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.92}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{plate} · {status}</span>
                </Tooltip>

                <Popup maxWidth={280} autoPan={false}>
                  <div style={{ minWidth: 230, fontSize: 13 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontWeight: 800, fontSize: 15 }}>{plate}</span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                        background: status === 'ACTIVE' ? '#dcfce7' : status === 'IDLE' ? '#fef9c3' : '#f3f4f6',
                        color:      status === 'ACTIVE' ? '#166534' : status === 'IDLE' ? '#854d0e' : '#6b7280',
                      }}>{status}</span>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>{loc.vehicle?.name}</p>

                    {/* Plain-text location address */}
                    <GeoAddress lat={pos[0]} lon={pos[1]} />

                    {/* Stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
                      {([
                        ['Speed',    formatSpeed(loc.speed)],
                        ['Fuel',     formatFuel(loc.fuelLevel)],
                        ['Engine',   loc.engineOn ? 'ON ✅' : 'OFF'],
                        ['Accuracy', loc.accuracy ? `±${loc.accuracy.toFixed(0)}m` : '—'],
                        ['Lat',      pos[0].toFixed(6)],
                        ['Lon',      pos[1].toFixed(6)],
                      ] as [string,string][]).map(([label, val]) => (
                        <div key={label} style={{ background: '#f9fafb', borderRadius: 6, padding: '5px 8px' }}>
                          <div style={{ color: '#9ca3af', fontSize: 10 }}>{label}</div>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <p style={{ color: '#9ca3af', fontSize: 10, marginTop: 6, textAlign: 'right' }}>
                      {formatDate(loc.updatedAt)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
