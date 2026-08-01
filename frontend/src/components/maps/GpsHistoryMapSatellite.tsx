/**
 * GpsHistoryMapSatellite.tsx
 *
 * GPS history map with 3 switchable base layers.
 * Layer switcher is at the bottom-left inside the map.
 * Switching handled by React state — guaranteed to work with Next.js.
 */
'use client';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap, Marker } from 'react-leaflet';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDate } from '@/lib/utils';

type MapLayer = 'street' | 'satellite' | 'hybrid';

const TILE_LAYERS: Record<MapLayer, { url: string; attribution: string; opacity?: number }[]> = {
  street: [
    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  ],
  satellite: [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' },
  ],
  hybrid: [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' },
    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap', opacity: 0.45 },
  ],
};

const LAYER_BUTTONS: { id: MapLayer; icon: string; label: string }[] = [
  { id: 'street',    icon: '🗺️', label: 'Street' },
  { id: 'satellite', icon: '🛰️', label: 'Satellite' },
  { id: 'hybrid',    icon: '🌍', label: 'Hybrid' },
];

function ActiveTiles({ layer }: { layer: MapLayer }) {
  return (
    <>
      {TILE_LAYERS[layer].map((t, i) => (
        <TileLayer key={`${layer}-${i}`} url={t.url} attribution={t.attribution} opacity={t.opacity ?? 1} maxZoom={19} />
      ))}
    </>
  );
}

function LayerSwitcherInner({ layer, onChange }: { layer: MapLayer; onChange: (l: MapLayer) => void }) {
  useMap();
  return (
    <div style={{
      position: 'absolute', bottom: 56, left: 12, zIndex: 1000,
      display: 'flex', gap: 4,
      background: 'rgba(255,255,255,0.96)', borderRadius: 10, padding: '5px 6px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.18)', border: '1px solid #e5e7eb',
    }}>
      {LAYER_BUTTONS.map(btn => (
        <button key={btn.id} onClick={() => onChange(btn.id)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7,
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
          border: layer === btn.id ? '2px solid #2563eb' : '2px solid transparent',
          background: layer === btn.id ? '#eff6ff' : 'transparent',
          color: layer === btn.id ? '#1d4ed8' : '#374151', transition: 'all 0.15s',
        }}>
          <span style={{ fontSize: 14 }}>{btn.icon}</span>{btn.label}
        </button>
      ))}
    </div>
  );
}

interface GpsPoint { id: string; latitude: number; longitude: number; speed: number; heading: number; timestamp: string; }
interface Props { points: GpsPoint[]; vehiclePlate: string; vehicleName: string; }

function speedColor(s: number) {
  if (s > 100) return '#ef4444';
  if (s > 60)  return '#f97316';
  if (s > 20)  return '#22c55e';
  if (s > 2)   return '#3b82f6';
  return '#9ca3af';
}

function FitBounds({ points }: { points: GpsPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points.map(p => [p.latitude, p.longitude] as [number, number])), { padding: [30, 30] });
  }, [points, map]);
  return null;
}

function makeEndpointIcon(color: string, label: string) {
  return L.divIcon({
    html: `<div style="background:${color};color:white;font-size:10px;font-weight:bold;padding:3px 6px;border-radius:12px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);white-space:nowrap">${label}</div>`,
    className: '', iconAnchor: [0, 0],
  });
}

export default function GpsHistoryMapSatellite({ points, vehiclePlate, vehicleName }: Props) {
  const [mapLayer, setMapLayer] = useState<MapLayer>('street');
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const valid = points.filter(p => p.latitude && p.longitude);
  if (!valid.length) return (
    <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl text-gray-400">
      No GPS history for this period
    </div>
  );

  const center: [number, number] = [valid[0].latitude, valid[0].longitude];
  const first = valid[0], last = valid[valid.length - 1];
  const segments = valid.slice(1).map((curr, i) => ({
    points: [[valid[i].latitude, valid[i].longitude], [curr.latitude, curr.longitude]] as [number, number][],
    color: speedColor(curr.speed),
  }));

  function startReplay() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setReplayIdx(0);
    intervalRef.current = setInterval(() => {
      setReplayIdx(i => {
        if (i === null || i >= valid.length - 1) { clearInterval(intervalRef.current!); return null; }
        return i + 1;
      });
    }, 100);
  }
  function stopReplay() { if (intervalRef.current) clearInterval(intervalRef.current); setReplayIdx(null); }
  const replayPoint = replayIdx !== null ? valid[replayIdx] : null;

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden">
      <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }}>
        <ActiveTiles layer={mapLayer} />
        <LayerSwitcherInner layer={mapLayer} onChange={setMapLayer} />
        <FitBounds points={valid} />

        {segments.map((seg, i) => <Polyline key={i} positions={seg.points} color={seg.color} weight={3} opacity={0.85} />)}

        <Marker position={[first.latitude, first.longitude]} icon={makeEndpointIcon('#22c55e', 'START')}>
          <Popup><div className="text-sm"><p className="font-bold">{vehiclePlate} — Start</p><p className="text-gray-500">{formatDate(first.timestamp)}</p></div></Popup>
        </Marker>
        <Marker position={[last.latitude, last.longitude]} icon={makeEndpointIcon('#ef4444', 'END')}>
          <Popup><div className="text-sm"><p className="font-bold">{vehiclePlate} — End</p><p className="text-gray-500">{formatDate(last.timestamp)}</p></div></Popup>
        </Marker>

        {replayPoint && (
          <CircleMarker center={[replayPoint.latitude, replayPoint.longitude]} radius={10} fillColor="#2563eb" color="white" weight={2} fillOpacity={0.9}>
            <Popup><div className="text-xs"><p className="font-bold">{vehiclePlate}</p><p>{Math.round(replayPoint.speed)} km/h</p><p>{formatDate(replayPoint.timestamp)}</p></div></Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {/* Replay controls — bottom centre */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 shadow-lg z-[1000]">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" /> Stopped
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Slow
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Moving
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Fast
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Speeding
        </div>
        <div className="w-px h-4 bg-gray-300" />
        {replayIdx === null
          ? <button onClick={startReplay} className="text-xs font-medium text-brand-700 hover:text-brand-900 transition">▶ Replay Path</button>
          : <button onClick={stopReplay} className="text-xs font-medium text-red-600 hover:text-red-800 transition">■ Stop</button>}
        {replayIdx !== null && <span className="text-xs text-gray-500">{replayIdx + 1} / {valid.length}</span>}
      </div>

      {/* Stats */}
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-3 shadow-md z-[1000] text-xs space-y-1">
        <p className="font-bold text-gray-900">{vehiclePlate}</p>
        <p className="text-gray-500">{vehicleName}</p>
        <p className="text-gray-600">{valid.length} GPS points</p>
        <p className="text-gray-600">Max: <span className="font-bold text-red-600">{Math.round(Math.max(...valid.map(p => p.speed)))} km/h</span></p>
      </div>
    </div>
  );
}
