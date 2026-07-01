'use client';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap, Marker } from 'react-leaflet';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDate } from '@/lib/utils';

interface GpsPoint {
  id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
}

interface GpsHistoryMapProps {
  points: GpsPoint[];
  vehiclePlate: string;
  vehicleName: string;
}

function speedColor(speed: number): string {
  if (speed > 100) return '#ef4444';  // red   — speeding
  if (speed > 60)  return '#f97316';  // orange — fast
  if (speed > 20)  return '#22c55e';  // green  — moving
  if (speed > 2)   return '#3b82f6';  // blue   — slow
  return '#9ca3af';                    // grey   — stopped
}

// Auto-fit map to all points
function FitBounds({ points }: { points: GpsPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points.map(p => [p.latitude, p.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [points, map]);
  return null;
}

// Start / end marker icons
function makeEndpointIcon(color: string, label: string) {
  return L.divIcon({
    html: `<div style="background:${color};color:white;font-size:10px;font-weight:bold;padding:3px 6px;border-radius:12px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);white-space:nowrap">${label}</div>`,
    className: '',
    iconAnchor: [0, 0],
  });
}

export default function GpsHistoryMap({ points, vehiclePlate, vehicleName }: GpsHistoryMapProps) {
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const valid = points.filter(p => p.latitude && p.longitude);
  if (!valid.length) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl text-gray-400">
        No GPS history for this period
      </div>
    );
  }

  const center: [number, number] = [valid[0].latitude, valid[0].longitude];
  const firstPoint = valid[0];
  const lastPoint  = valid[valid.length - 1];

  // Build polyline segments coloured by speed
  const segments: { points: [number, number][]; color: string }[] = [];
  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1];
    const curr = valid[i];
    segments.push({
      points: [[prev.latitude, prev.longitude], [curr.latitude, curr.longitude]],
      color:  speedColor(curr.speed),
    });
  }

  function startReplay() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setReplayIdx(0);
    intervalRef.current = setInterval(() => {
      setReplayIdx(i => {
        if (i === null || i >= valid.length - 1) {
          clearInterval(intervalRef.current!);
          return null;
        }
        return i + 1;
      });
    }, 100);
  }

  function stopReplay() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setReplayIdx(null);
  }

  const replayPoint = replayIdx !== null ? valid[replayIdx] : null;

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden">
      <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        <FitBounds points={valid} />

        {/* Coloured path segments */}
        {segments.map((seg, i) => (
          <Polyline key={i} positions={seg.points} color={seg.color} weight={3} opacity={0.85} />
        ))}

        {/* Start marker */}
        <Marker position={[firstPoint.latitude, firstPoint.longitude]}
          icon={makeEndpointIcon('#22c55e', 'START')}>
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{vehiclePlate} — Start</p>
              <p className="text-gray-500">{formatDate(firstPoint.timestamp)}</p>
            </div>
          </Popup>
        </Marker>

        {/* End marker */}
        <Marker position={[lastPoint.latitude, lastPoint.longitude]}
          icon={makeEndpointIcon('#ef4444', 'END')}>
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{vehiclePlate} — End</p>
              <p className="text-gray-500">{formatDate(lastPoint.timestamp)}</p>
            </div>
          </Popup>
        </Marker>

        {/* Replay position */}
        {replayPoint && (
          <CircleMarker
            center={[replayPoint.latitude, replayPoint.longitude]}
            radius={10}
            fillColor="#2563eb"
            color="white"
            weight={2}
            fillOpacity={0.9}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold">{vehiclePlate}</p>
                <p>{Math.round(replayPoint.speed)} km/h</p>
                <p>{formatDate(replayPoint.timestamp)}</p>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {/* Overlay controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 shadow-lg z-[1000]">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" /> Stopped
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Slow
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Moving
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Fast
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Speeding
        </div>
        <div className="w-px h-4 bg-gray-300" />
        {replayIdx === null ? (
          <button onClick={startReplay}
            className="text-xs font-medium text-brand-700 hover:text-brand-900 transition">
            ▶ Replay Path
          </button>
        ) : (
          <button onClick={stopReplay}
            className="text-xs font-medium text-red-600 hover:text-red-800 transition">
            ■ Stop
          </button>
        )}
        {replayIdx !== null && (
          <span className="text-xs text-gray-500">
            {replayIdx + 1} / {valid.length}
          </span>
        )}
      </div>

      {/* Stats overlay */}
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-3 shadow-md z-[1000] text-xs space-y-1">
        <p className="font-bold text-gray-900">{vehiclePlate}</p>
        <p className="text-gray-500">{vehicleName}</p>
        <p className="text-gray-600">{valid.length} GPS points</p>
        <p className="text-gray-600">
          Max: <span className="font-bold text-red-600">{Math.round(Math.max(...valid.map(p => p.speed)))} km/h</span>
        </p>
      </div>
    </div>
  );
}
