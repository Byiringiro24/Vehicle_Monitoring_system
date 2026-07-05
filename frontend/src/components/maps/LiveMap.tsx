'use client';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatSpeed, formatFuel, formatDate } from '@/lib/utils';

// Fix default Leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Vehicle is considered ACTIVE if telemetry arrived in the last 2 minutes
function isRecentlyActive(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  return (Date.now() - new Date(updatedAt).getTime()) < 2 * 60 * 1000;
}

function resolveStatus(loc: LocationData): string {
  if (!isRecentlyActive(loc.updatedAt)) return 'OFFLINE';
  if (!loc.engineOn) return 'IDLE';
  return 'ACTIVE';
}

function createVehicleIcon(status: string, selected: boolean, plate: string) {
  const colors: Record<string, string> = {
    ACTIVE:         '#22c55e',
    IDLE:           '#f59e0b',
    OFFLINE:        '#6b7280',
    MAINTENANCE:    '#f97316',
    DECOMMISSIONED: '#ef4444',
    OUT_OF_SERVICE: '#dc2626',
    STOLEN:         '#7c3aed',
    RENTED:         '#0ea5e9',
    LEASED:         '#06b6d4',
    AVAILABLE:      '#84cc16',
    RESERVED:       '#a78bfa',
  };
  const color   = colors[status] ?? '#6b7280';
  const dotSize = selected ? 14 : 10;
  const pulse   = status === 'ACTIVE';

  return L.divIcon({
    html: `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:2px">
      <div style="background:white;border:2px solid ${color};color:${color};font-size:9px;font-weight:bold;padding:1px 5px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25)">
        ${plate.replace(/\s+/g, '').slice(-7)}
      </div>
      <div style="position:relative;width:${dotSize + 8}px;height:${dotSize + 8}px;display:flex;align-items:center;justify-content:center">
        ${pulse ? `<div style="position:absolute;width:${dotSize + 8}px;height:${dotSize + 8}px;border-radius:50%;background:${color};opacity:.25;animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite"></div>` : ''}
        <div style="width:${dotSize}px;height:${dotSize}px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>
      </div>
    </div>
    <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>`,
    className: '',
    iconSize:   [56, selected ? 36 : 30],
    iconAnchor: [28, selected ? 36 : 30],
  });
}

function FlyToSelected({ locations, selectedId }: { locations: LocationData[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const loc = locations.find(l => l.vehicleId === selectedId);
    if (loc?.latitude && loc?.longitude) {
      map.flyTo([loc.latitude, loc.longitude], 16, { duration: 1.5 });
    }
  }, [selectedId, locations, map]);
  return null;
}

// Auto-fit all markers on first mount
function FitBounds({ locations }: { locations: LocationData[] }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount
  return null;
}

export interface VehicleInfo {
  id: string;
  name: string;
  licensePlate: string;
  status: string;
  fleet?: { name: string; color: string } | null;
}

export interface LocationData {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  fuelLevel?: number | null;
  engineTemp?: number | null;
  engineOn: boolean;
  address?: string | null;
  updatedAt: string;
  vehicle?: VehicleInfo | null;
}

interface LiveMapProps {
  locations: LocationData[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function LiveMap({ locations, selectedId, onSelect }: LiveMapProps) {
  // Only show vehicles with valid GPS coordinates
  const valid = locations.filter(l =>
    l.latitude && l.longitude &&
    Math.abs(l.latitude) > 0.001 && Math.abs(l.longitude) > 0.001
  );

  // Vehicles without GPS data (no coordinates ever received)
  const noGps = locations.filter(l =>
    !l.latitude || !l.longitude ||
    (Math.abs(l.latitude) <= 0.001 && Math.abs(l.longitude) <= 0.001)
  );

  const center: [number, number] = valid.length
    ? [valid[0].latitude, valid[0].longitude]
    : [-1.9403, 29.8739]; // Rwanda centre

  const activeCount  = valid.filter(l => isRecentlyActive(l.updatedAt) && l.engineOn).length;
  const idleCount    = valid.filter(l => isRecentlyActive(l.updatedAt) && !l.engineOn).length;
  const offlineCount = valid.filter(l => !isRecentlyActive(l.updatedAt)).length;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Legend overlay */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 1000,
        background: 'white', borderRadius: 8, padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,.15)', fontSize: 11,
        display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 2, color: '#374151' }}>
          {valid.length} vehicle{valid.length !== 1 ? 's' : ''} on map
          {noGps.length > 0 && (
            <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 10, display: 'block' }}>
              {noGps.length} without GPS fix
            </span>
          )}
        </div>
        {[
          { color: '#22c55e', label: `Active (${activeCount})` },
          { color: '#f59e0b', label: `Idle (${idleCount})` },
          { color: '#6b7280', label: `Offline (${offlineCount})` },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '1.5px solid white', boxShadow: '0 0 0 1px #ddd' }} />
            <span style={{ color: '#6b7280' }}>{label}</span>
          </div>
        ))}
      </div>

      <MapContainer center={center} zoom={12} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds locations={valid} />
        <FlyToSelected locations={valid} selectedId={selectedId} />

        {valid.map((loc) => {
          const status = resolveStatus(loc);
          const active = isRecentlyActive(loc.updatedAt);
          return (
            <Marker
              key={loc.vehicleId}
              position={[loc.latitude, loc.longitude]}
              icon={createVehicleIcon(status, selectedId === loc.vehicleId, loc.vehicle?.licensePlate ?? '')}
              eventHandlers={{ click: () => onSelect(loc.vehicleId) }}>

              <Popup maxWidth={270}>
                <div style={{ minWidth: 220, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{loc.vehicle?.licensePlate}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600,
                      background: status === 'ACTIVE' ? '#dcfce7' : status === 'IDLE' ? '#fef9c3' : '#f3f4f6',
                      color:      status === 'ACTIVE' ? '#166534' : status === 'IDLE' ? '#854d0e' : '#6b7280',
                    }}>{status}</span>
                  </div>
                  <p style={{ color: '#6b7280', fontSize: 11, marginBottom: 6 }}>{loc.vehicle?.name}</p>
                  {!active && (
                    <p style={{ color: '#ef4444', fontSize: 11, marginBottom: 6 }}>
                      ⚠ GPS offline — last seen {formatDate(loc.updatedAt)}
                    </p>
                  )}
                  {loc.address && (
                    <p style={{ color: '#374151', fontSize: 11, marginBottom: 8 }}>📍 {loc.address}</p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {[
                      ['Speed',   formatSpeed(loc.speed)],
                      ['Fuel',    formatFuel(loc.fuelLevel)],
                      ['Engine',  loc.engineOn ? 'ON ✅' : 'OFF'],
                      ['Updated', formatDate(loc.updatedAt)],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: '#f9fafb', borderRadius: 6, padding: '5px 7px' }}>
                        <div style={{ color: '#9ca3af', fontSize: 10 }}>{label}</div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>

              <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>
                  {loc.vehicle?.licensePlate} · {status}
                </span>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
