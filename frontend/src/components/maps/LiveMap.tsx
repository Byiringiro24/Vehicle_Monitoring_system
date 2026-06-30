'use client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatSpeed, formatFuel, formatDate } from '@/lib/utils';

// Fix default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createVehicleIcon(status: string, selected: boolean) {
  const colors: Record<string, string> = {
    ACTIVE: '#22c55e', IDLE: '#f59e0b', OFFLINE: '#6b7280', MAINTENANCE: '#f97316',
  };
  const color = colors[status] ?? '#6b7280';
  const size = selected ? 36 : 28;
  return L.divIcon({
    html: <div style="width:px;height:px;background:;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function FlyToSelected({ locations, selectedId }: { locations: any[]; selectedId: string | null }) {
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

interface LiveMapProps {
  locations: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function LiveMap({ locations, selectedId, onSelect }: LiveMapProps) {
  const validLocations = locations.filter(l => l.latitude && l.longitude);

  const center: [number, number] = validLocations.length
    ? [validLocations[0].latitude, validLocations[0].longitude]
    : [-1.286389, 36.817223]; // Nairobi default

  return (
    <MapContainer center={center} zoom={12} style={{ width: '100%', height: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FlyToSelected locations={validLocations} selectedId={selectedId} />
      {validLocations.map((loc: any) => (
        <Marker
          key={loc.vehicleId}
          position={[loc.latitude, loc.longitude]}
          icon={createVehicleIcon(loc.vehicle?.status ?? 'OFFLINE', selectedId === loc.vehicleId)}
          eventHandlers={{ click: () => onSelect(loc.vehicleId) }}>
          <Popup>
            <div className="min-w-48">
              <p className="font-bold text-gray-900">{loc.vehicle?.name}</p>
              <p className="text-xs text-gray-500 mb-2">{loc.vehicle?.licensePlate}</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Speed</span><span className="font-medium">{formatSpeed(loc.speed)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Fuel</span><span className="font-medium">{formatFuel(loc.fuelLevel)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Engine</span><span className={loc.engineOn ? 'text-green-600 font-medium' : 'text-gray-400'}>{ loc.engineOn ? 'ON' : 'OFF'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Updated</span><span className="text-xs">{formatDate(loc.updatedAt)}</span></div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}