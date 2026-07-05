'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { telemetryApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { Search, MapPin, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400">
      <RefreshCw className="animate-spin mr-2" size={18} /> Loading map…
    </div>
  ),
});

export default function LiveMapPage() {
  const { accessToken } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [locations, setLocations]   = useState<any[]>([]);

  // Initial load from REST
  const { data, isLoading } = useQuery({
    queryKey: ['fleet-locations'],
    queryFn:  telemetryApi.getLocations,
    refetchInterval: 30_000, // fallback polling every 30s
  });

  useEffect(() => {
    if (data) setLocations(data);
  }, [data]);

  // Live updates via Socket.IO
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);

    socket.on('telemetry:update', (p: any) => {
      setLocations(prev => {
        const d = p.data;
        // Only update if there are GPS coordinates
        if (!d.latitude || !d.longitude) return prev;
        const existing = prev.find(l => l.vehicleId === p.vehicleId);
        if (existing) {
          return prev.map(l => l.vehicleId !== p.vehicleId ? l : {
            ...l,
            latitude:  d.latitude,
            longitude: d.longitude,
            speed:     d.speed ?? 0,
            heading:   d.heading ?? 0,
            fuelLevel: d.fuelLevel ?? l.fuelLevel,
            engineOn:  d.engineOn ?? l.engineOn,
            engineTemp: d.engineTemp ?? l.engineTemp,
            updatedAt: p.timestamp,
          });
        }
        // New vehicle appeared — re-fetch full data
        return prev;
      });
    });

    socket.on('vehicles:offline', (p: any) => {
      setLocations(prev => prev.map(l =>
        p.vehicleIds?.includes(l.vehicleId)
          ? { ...l, updatedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString() } // mark as stale
          : l
      ));
    });

    return () => {
      socket.off('telemetry:update');
      socket.off('vehicles:offline');
    };
  }, [accessToken]);

  // Filter sidebar list by search
  const filtered = locations.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.vehicle?.licensePlate?.toLowerCase().includes(q) ||
      l.vehicle?.name?.toLowerCase().includes(q)
    );
  });

  // Count by status
  const isActive  = (l: any) => (Date.now() - new Date(l.updatedAt).getTime()) < 2 * 60 * 1000 && l.engineOn;
  const isIdle    = (l: any) => (Date.now() - new Date(l.updatedAt).getTime()) < 2 * 60 * 1000 && !l.engineOn;
  const activeCount  = locations.filter(isActive).length;
  const idleCount    = locations.filter(isIdle).length;
  const offlineCount = locations.length - activeCount - idleCount;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -mx-6 -mt-6 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col bg-white border-r border-gray-200">

        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={16} className="text-blue-600" /> Live Map
          </h2>
          <div className="flex gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{activeCount} Active</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />{idleCount} Idle</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />{offlineCount} Offline</span>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search plate or name…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading
            ? [...Array(6)].map((_, i) => (
                <div key={i} className="p-3 animate-pulse border-b border-gray-50">
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-1.5" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                </div>
              ))
            : filtered.map(loc => {
                const active   = isActive(loc);
                const idle     = isIdle(loc);
                const dotColor = active ? 'bg-green-500' : idle ? 'bg-yellow-400' : 'bg-gray-400';
                const selected = selectedId === loc.vehicleId;
                return (
                  <button key={loc.vehicleId}
                    onClick={() => setSelectedId(selected ? null : loc.vehicleId)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-gray-50 transition hover:bg-blue-50',
                      selected && 'bg-blue-50 border-l-2 border-l-blue-500'
                    )}>
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor, active && 'animate-pulse')} />
                      <span className="font-mono font-bold text-sm text-gray-900 truncate">
                        {loc.vehicle?.licensePlate ?? loc.vehicleId}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 ml-4 truncate mt-0.5">{loc.vehicle?.name}</p>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">
                      {Math.round(loc.speed ?? 0)} km/h · {active ? 'Active' : idle ? 'Idle' : 'Offline'}
                    </p>
                  </button>
                );
              })}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No vehicles match</div>
          )}
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <LiveMap
          locations={locations.filter(l => l.latitude && l.longitude)}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
    </div>
  );
}
