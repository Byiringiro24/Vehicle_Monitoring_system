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

function createVehicleIcon(status: string, selected: boolean, plate: string) {
  const colors: Record<string, string> = {
    ACTIVE: '#22c55e', IDLE: '#f59e0b', OFFLINE: '#6b7280',
    MAINTENANCE: '#f97316', DECOMMISSIONED: '#ef4444',
  };
  const color = colors[status] ?? '#6b7280';
  const size  = selected ? 40 : 32;
  // Show plate number label on the marker
  const shortPlate = plate.replace(/\s+/g, '').slice(-6);
  return L.divIcon({
    html: `<div style="position:relative;display:inline-flex;flex-direction:column;align-items:center;gap:2px">
      <div style="background:white;border:2px solid ${color};color:${color};font-size:9px;font-weight:bold;padding:1px 4px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${shortPlate}</div>
      <div style="width:${selected ? 14 : 10}px;height:${selected ? 14 : 10}px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>
    </div>`,
    className: '',
    iconSize:   [selected ? 60 : 50, selected ? 32 : 26],
    iconAnchor: [selected ? 30 : 25, selected ? 32 : 26],
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
  const valid = locations.filter(l => l.latitude && l.longitude);
  const center: [number, number] = valid.length
    ? [valid[0].latitude, valid[0].longitude]
    : [-1.9403, 29.8739]; // Rwanda center

  return (
    <MapContainer center={center} zoom={12} style={{ width: '100%', height: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FlyToSelected locations={valid} selectedId={selectedId} />
      {valid.map((loc) => (
        <Marker
          key={loc.vehicleId}
          position={[loc.latitude, loc.longitude]}
          icon={createVehicleIcon(
            loc.vehicle?.status ?? 'OFFLINE',
            selectedId === loc.vehicleId,
            loc.vehicle?.licensePlate ?? ''
          )}
          eventHandlers={{ click: () => onSelect(loc.vehicleId) }}>
          <Popup maxWidth={260}>
            <div className="min-w-[14rem] text-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-gray-900 text-base">{loc.vehicle?.licensePlate}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  loc.vehicle?.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  loc.vehicle?.status === 'IDLE'   ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-700'
                }`}>{loc.vehicle?.status}</span>
              </div>
              <p className="text-gray-500 text-xs mb-3">{loc.vehicle?.name}</p>
              {loc.address && (
                <p className="text-gray-700 text-xs mb-2 flex items-start gap-1">
                  <span>📍</span><span>{loc.address}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="bg-gray-50 rounded p-1.5">
                  <p className="text-gray-500">Speed</p>
                  <p className="font-semibold">{formatSpeed(loc.speed)}</p>
                </div>
                <div className="bg-gray-50 rounded p-1.5">
                  <p className="text-gray-500">Fuel</p>
                  <p className="font-semibold">{formatFuel(loc.fuelLevel)}</p>
                </div>
                <div className="bg-gray-50 rounded p-1.5">
                  <p className="text-gray-500">Engine</p>
                  <p className={`font-semibold ${loc.engineOn ? 'text-green-600' : 'text-gray-400'}`}>
                    {loc.engineOn ? 'ON' : 'OFF'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-1.5">
                  <p className="text-gray-500">Updated</p>
                  <p className="font-semibold text-xs">{formatDate(loc.updatedAt)}</p>
                </div>
              </div>
            </div>
          </Popup>
          <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent={false}>
            <span className="text-xs font-bold">{loc.vehicle?.licensePlate}</span>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
