'use client';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatSpeed, formatFuel, formatDate } from '@/lib/utils';

// Fix default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Live status based ONLY on last telemetry timestamp ─────────────────────────
// ACTIVE  = packet received < 30s ago AND engineOn
// IDLE    = packet received < 30s ago AND !engineOn
// OFFLINE = no packet for > 30s (2 × 15s interval)
const STALE_MS = 30_000;

export function getLiveStatus(updatedAt: string | null | undefined, engineOn: boolean): 'ACTIVE' | 'IDLE' | 'OFFLINE' {
  if (!updatedAt) return 'OFFLINE';
  const age = Date.now() - new Date(updatedAt).getTime();
  if (age > STALE_MS) return 'OFFLINE';
  return engineOn ? 'ACTIVE' : 'IDLE';
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:  '#22c55e',
  IDLE:    '#f59e0b',
  OFFLINE: '#6b7280',
};

function createIcon(status: 'ACTIVE'|'IDLE'|'OFFLINE', plate: string, selected: boolean) {
  const color   = STATUS_COLOR[status];
  const dot     = selected ? 16 : 11;
  const pulse   = status === 'ACTIVE';

  return L.divIcon({
    html: `
      <div style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none">
        <div style="background:white;border:2.5px solid ${color};color:${color};font-size:9px;font-weight:800;
             padding:1px 6px;border-radius:5px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.2);
             letter-spacing:.5px">
          ${plate.replace(/\s+/g,'').slice(-8)}
        </div>
        <div style="position:relative;width:${dot+10}px;height:${dot+10}px;display:flex;align-items:center;justify-content:center">
          ${pulse ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.2;
                       animation:lm-ping 1.5s ease-out infinite"></div>` : ''}
          <div style="width:${dot}px;height:${dot}px;background:${color};border:2.5px solid white;
               border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.25)"></div>
        </div>
      </div>
      <style>@keyframes lm-ping{0%{transform:scale(1);opacity:.3}100%{transform:scale(2.5);opacity:0}}</style>
    `,
    className: '',
    iconSize:   [60, selected ? 42 : 34],
    iconAnchor: [30, selected ? 42 : 34],
  });
}

// Smoothly move a marker to a new position (like watchPosition)
function MovingMarker({ vehicleId, position, status, plate, selected, accuracy, loc, onSelect }: {
  vehicleId: string;
  position: [number, number];
  status: 'ACTIVE'|'IDLE'|'OFFLINE';
  plate: string;
  selected: boolean;
  accuracy?: number;
  loc: LocationData;
  onSelect: (id: string) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const map = useMap();

  useEffect(() => {
    if (!markerRef.current) return;
    // Smoothly pan marker to new position (like watchPosition behaviour)
    markerRef.current.setLatLng(position);
    markerRef.current.setIcon(createIcon(status, plate, selected));
    if (circleRef.current) {
      circleRef.current.setLatLng(position);
      circleRef.current.setRadius(accuracy ?? 10);
    }
    // If this is the selected vehicle, follow it
    if (selected && status !== 'OFFLINE') {
      map.panTo(position, { animate: true, duration: 0.5 });
    }
  }, [position, status, plate, selected, accuracy, map]);

  return (
    <>
      <Circle
        ref={circleRef as any}
        center={position}
        radius={accuracy ?? 10}
        pathOptions={{
          color: STATUS_COLOR[status],
          fillColor: STATUS_COLOR[status],
          fillOpacity: 0.08,
          weight: 1,
          opacity: 0.4,
        }}
      />
      <Marker
        ref={markerRef as any}
        position={position}
        icon={createIcon(status, plate, selected)}
        eventHandlers={{ click: () => onSelect(vehicleId) }}>
        <Popup maxWidth={260}>
          <div style={{ minWidth: 210, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '.5px' }}>{plate}</span>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                background: status === 'ACTIVE' ? '#dcfce7' : status === 'IDLE' ? '#fef9c3' : '#f3f4f6',
                color:      status === 'ACTIVE' ? '#166534' : status === 'IDLE' ? '#854d0e' : '#6b7280',
              }}>{status}</span>
            </div>
            <p style={{ color: '#6b7280', fontSize: 11, marginBottom: 8 }}>{loc.vehicle?.name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {([
                ['Speed',    formatSpeed(loc.speed)],
                ['Fuel',     formatFuel(loc.fuelLevel)],
                ['Engine',   loc.engineOn ? 'ON ✅' : 'OFF'],
                ['Accuracy', accuracy ? `±${accuracy.toFixed(0)}m` : '—'],
                ['Lat',      position[0].toFixed(6)],
                ['Lon',      position[1].toFixed(6)],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} style={{ background: '#f9fafb', borderRadius: 6, padding: '5px 8px' }}>
                  <div style={{ color: '#9ca3af', fontSize: 10 }}>{label}</div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{val}</div>
                </div>
              ))}
            </div>
            <p style={{ color: '#9ca3af', fontSize: 10, marginTop: 6, textAlign: 'right' }}>
              Updated {formatDate(loc.updatedAt)}
            </p>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

// Fit bounds only once on mount
function FitBounds({ locations }: { locations: LocationData[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || locations.length === 0) return;
    const valid = locations.filter(l => l.latitude && l.longitude);
    if (!valid.length) return;
    const bounds = L.latLngBounds(valid.map(l => [l.latitude, l.longitude]));
    if (bounds.isValid()) { map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 }); done.current = true; }
  }, [locations, map]);
  return null;
}

// ── Public types ─────────────────────────────────────────────────────────────
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
}

export default function LiveMap({ locations, selectedId, onSelect }: Props) {
  const valid = locations.filter(l =>
    l.latitude && l.longitude &&
    Math.abs(l.latitude) > 0.001 && Math.abs(l.longitude) > 0.001
  );

  const center: [number, number] = valid.length
    ? [valid[0].latitude, valid[0].longitude]
    : [-1.9403, 29.8739];

  const activeCount  = valid.filter(l => getLiveStatus(l.updatedAt, l.engineOn) === 'ACTIVE').length;
  const idleCount    = valid.filter(l => getLiveStatus(l.updatedAt, l.engineOn) === 'IDLE').length;
  const offlineCount = valid.filter(l => getLiveStatus(l.updatedAt, l.engineOn) === 'OFFLINE').length;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Legend */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 1000,
        background: 'white', borderRadius: 10, padding: '10px 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,.15)', fontSize: 11,
        display: 'flex', flexDirection: 'column', gap: 5, minWidth: 150,
        border: '1px solid #e5e7eb',
      }}>
        <div style={{ fontWeight: 700, color: '#111827', fontSize: 12, marginBottom: 2 }}>
          {valid.length} vehicle{valid.length !== 1 ? 's' : ''} on map
        </div>
        {[
          { color: '#22c55e', label: `● Active (${activeCount})` },
          { color: '#f59e0b', label: `● Idle (${idleCount})` },
          { color: '#6b7280', label: `● Offline (${offlineCount})` },
        ].map(({ color, label }) => (
          <div key={label} style={{ color, fontWeight: 600, fontSize: 11 }}>{label}</div>
        ))}
        <div style={{ color: '#9ca3af', fontSize: 9, marginTop: 2, borderTop: '1px solid #f3f4f6', paddingTop: 4 }}>
          Live · updates every 15s
        </div>
      </div>

      <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <FitBounds locations={valid} />

        {valid.map(loc => {
          const status = getLiveStatus(loc.updatedAt, loc.engineOn);
          return (
            <MovingMarker
              key={loc.vehicleId}
              vehicleId={loc.vehicleId}
              position={[loc.latitude, loc.longitude]}
              status={status}
              plate={loc.vehicle?.licensePlate ?? loc.vehicleId.slice(0, 8)}
              selected={selectedId === loc.vehicleId}
              accuracy={loc.accuracy ?? undefined}
              loc={loc}
              onSelect={onSelect}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
