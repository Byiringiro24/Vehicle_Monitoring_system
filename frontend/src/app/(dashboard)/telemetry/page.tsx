'use client';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { telemetryApi } from '@/lib/api';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { MapPin, Truck, RefreshCw, Search, X, Navigation } from 'lucide-react';
import { getStatusColor, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-xl">
      <div className="text-center text-gray-400">
        <MapPin size={40} className="mx-auto mb-2 animate-pulse" />
        <p>Loading map...</p>
      </div>
    </div>
  ),
});

// Reverse geocode using Nominatim (OpenStreetMap)
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data.address) {
      const a = data.address;
      const parts = [
        a.road ?? a.pedestrian ?? a.path,
        a.suburb ?? a.neighbourhood ?? a.quarter,
        a.city ?? a.town ?? a.village ?? a.county,
      ].filter(Boolean);
      return parts.slice(0, 3).join(', ') || data.display_name?.split(',').slice(0, 2).join(',') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  } catch { /* fallback */ }
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export default function TelemetryPage() {
  const { accessToken } = useAuthStore();
  const [locations, setLocations] = useState<any[]>([]);
  const [selected, setSelected]   = useState<string | null>(null);
  const [search, setSearch]        = useState('');
  const [addresses, setAddresses]  = useState<Record<string, string>>({});
  const geocodeQueue = useRef<Set<string>>(new Set());

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['fleet-locations'],
    queryFn: telemetryApi.getLocations,
    refetchInterval: 30000,
  });

  useEffect(() => { if (data) setLocations(data); }, [data]);

  // Reverse geocode new locations
  const geocodeLocation = useCallback(async (vehicleId: string, lat: number, lon: number) => {
    if (geocodeQueue.current.has(vehicleId)) return;
    geocodeQueue.current.add(vehicleId);
    const address = await reverseGeocode(lat, lon);
    setAddresses(prev => ({ ...prev, [vehicleId]: address }));
    setTimeout(() => geocodeQueue.current.delete(vehicleId), 30000); // re-geocode after 30s
  }, []);

  useEffect(() => {
    locations.forEach(loc => {
      if (loc.latitude && loc.longitude) {
        geocodeLocation(loc.vehicleId, loc.latitude, loc.longitude);
      }
    });
  }, [locations, geocodeLocation]);

  // Live Socket.IO updates
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket.on('telemetry:update', ({ vehicleId, data: d }: any) => {
      setLocations(prev => prev.map(loc =>
        loc.vehicleId === vehicleId
          ? { ...loc,
              latitude:  d.latitude  ?? loc.latitude,
              longitude: d.longitude ?? loc.longitude,
              speed:     d.speed     ?? loc.speed,
              heading:   d.heading   ?? loc.heading,
              fuelLevel: d.fuelLevel ?? loc.fuelLevel,
              engineOn:  d.engineOn  ?? loc.engineOn,
              updatedAt: d.timestamp }
          : loc
      ));
      // Trigger re-geocode for moving vehicle
      const loc = locations.find(l => l.vehicleId === vehicleId);
      if (loc && d.latitude && d.longitude) {
        geocodeQueue.current.delete(vehicleId); // force fresh geocode
        geocodeLocation(vehicleId, d.latitude, d.longitude);
      }
    });
    return () => { socket.off('telemetry:update'); };
  }, [accessToken, locations, geocodeLocation]);

  // Filter by search
  const filtered = locations.filter(loc => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      loc.vehicle?.licensePlate?.toLowerCase().includes(q) ||
      loc.vehicle?.name?.toLowerCase().includes(q) ||
      addresses[loc.vehicleId]?.toLowerCase().includes(q)
    );
  });

  const selectedLoc = locations.find(l => l.vehicleId === selected);
  const activeCount = locations.filter(l => l.vehicle?.status === 'ACTIVE').length;

  return (
    <div className="flex gap-4 h-[calc(100vh-9rem)]">

      {/* ── Vehicle Sidebar ─────────────────────────────────────────────── */}
      <div className="w-72 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden shrink-0">

        {/* Header */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">Live Vehicles</h3>
              <p className="text-xs text-gray-400">{activeCount} active · {locations.length} total</p>
            </div>
            <button onClick={() => refetch()} title="Refresh"
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search plate, name..."
              className="w-full pl-8 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Selected vehicle detail */}
        {selectedLoc && (
          <div className="bg-brand-50 border-b border-brand-100 p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-brand-800 text-sm">{selectedLoc.vehicle?.licensePlate}</p>
                <p className="text-xs text-brand-600">{selectedLoc.vehicle?.name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-brand-400 hover:text-brand-600 p-0.5">
                <X size={14} />
              </button>
            </div>
            {/* Address */}
            {addresses[selectedLoc.vehicleId] && (
              <div className="flex items-start gap-1.5 mt-2 bg-white rounded-lg p-2 border border-brand-100">
                <MapPin size={12} className="text-brand-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700 leading-tight">{addresses[selectedLoc.vehicleId]}</p>
              </div>
            )}
            {/* Distance stats */}
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {[
                { label: 'Today', value: `${(selectedLoc.distanceTodayKm ?? 0).toFixed(1)} km` },
                { label: 'Month', value: `${(selectedLoc.distanceMonthKm ?? 0).toFixed(1)} km` },
                { label: 'Total', value: `${(selectedLoc.totalDistanceKm ?? 0).toFixed(0)} km` },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-lg p-1.5 border border-brand-100 text-center">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-xs font-bold text-gray-800">{s.value}</p>
                </div>
              ))}
            </div>
            {/* Speed and fuel */}
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              <div className="bg-white rounded-lg p-1.5 border border-brand-100 text-center">
                <p className="text-xs text-gray-500">Speed</p>
                <p className="text-sm font-bold text-gray-800">{Math.round(selectedLoc.speed ?? 0)} km/h</p>
              </div>
              <div className="bg-white rounded-lg p-1.5 border border-brand-100 text-center">
                <p className="text-xs text-gray-500">Fuel</p>
                <p className="text-sm font-bold text-gray-800">{Math.round(selectedLoc.fuelLevel ?? 0)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {filtered.map((loc: any) => (
            <button
              key={loc.vehicleId}
              onClick={() => setSelected(loc.vehicleId === selected ? null : loc.vehicleId)}
              className={cn(
                'w-full p-3 text-left hover:bg-gray-50 transition flex items-start gap-2.5',
                selected === loc.vehicleId && 'bg-brand-50 border-l-2 border-brand-600'
              )}>
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                <Truck size={14} className="text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900 truncate">{loc.vehicle?.licensePlate}</p>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium shrink-0', getStatusColor(loc.vehicle?.status ?? 'OFFLINE'))}>
                    {loc.vehicle?.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{loc.vehicle?.name}</p>
                {addresses[loc.vehicleId] && (
                  <p className="text-xs text-gray-400 truncate mt-0.5 flex items-center gap-1">
                    <Navigation size={9} className="shrink-0" />
                    {addresses[loc.vehicleId]}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{Math.round(loc.speed ?? 0)} km/h</span>
                  {loc.fuelLevel != null && (
                    <span className="text-xs text-gray-500">⛽ {Math.round(loc.fuelLevel)}%</span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {!isLoading && !filtered.length && (
            <div className="p-6 text-center text-gray-400 text-sm">
              <MapPin size={24} className="mx-auto mb-2 opacity-30" />
              {search ? 'No vehicles match your search' : 'No vehicles online'}
            </div>
          )}
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 rounded-xl overflow-hidden shadow-sm border border-gray-200 relative">
        <LiveMap
          locations={filtered.map(loc => ({ ...loc, address: addresses[loc.vehicleId] }))}
          selectedId={selected}
          onSelect={setSelected}
        />
        {/* Live badge */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-3 py-1 flex items-center gap-2 shadow-sm z-10">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-gray-700">Live tracking</span>
        </div>
      </div>
    </div>
  );
}
