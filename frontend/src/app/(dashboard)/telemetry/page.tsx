'use client';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { telemetryApi } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { MapPin, Truck, RefreshCw } from 'lucide-react';
import { getStatusColor } from '@/lib/utils';
import { cn } from '@/lib/utils';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), { ssr: false, loading: () => (
  <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-xl">
    <div className="text-center text-gray-400"><MapPin size={40} className="mx-auto mb-2 animate-pulse" /><p>Loading map...</p></div>
  </div>
) });

export default function TelemetryPage() {
  const { accessToken } = useAuthStore();
  const [locations, setLocations] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['fleet-locations'],
    queryFn: telemetryApi.getLocations,
    refetchInterval: 30000,
  });

  useEffect(() => { if (data) setLocations(data); }, [data]);

  // Live updates via Socket.IO
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket.on('telemetry:update', ({ vehicleId, data: d }: any) => {
      setLocations(prev => prev.map(loc =>
        loc.vehicleId === vehicleId
          ? { ...loc, latitude: d.latitude ?? loc.latitude, longitude: d.longitude ?? loc.longitude,
              speed: d.speed ?? loc.speed, updatedAt: d.timestamp }
          : loc
      ));
    });
    return () => { socket.off('telemetry:update'); };
  }, [accessToken]);

  return (
    <div className="flex gap-5 h-[calc(100vh-9rem)]">
      {/* Vehicle list sidebar */}
      <div className="w-72 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden shrink-0">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Live Vehicles</h3>
          <button onClick={() => refetch()} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {locations.map((loc: any) => (
            <button key={loc.vehicleId} onClick={() => setSelected(loc.vehicleId === selected ? null : loc.vehicleId)}
              className={cn('w-full p-3 text-left hover:bg-gray-50 transition flex items-center gap-3',
                selected === loc.vehicleId && 'bg-brand-50 border-l-2 border-brand-600')}>
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
                <Truck size={14} className="text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{loc.vehicle?.name}</p>
                <p className="text-xs text-gray-500">{loc.vehicle?.licensePlate}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', getStatusColor(loc.vehicle?.status ?? 'OFFLINE'))}>
                    {loc.vehicle?.status}
                  </span>
                  <span className="text-xs text-gray-400">{Math.round(loc.speed ?? 0)} km/h</span>
                </div>
              </div>
            </button>
          ))}
          {!isLoading && !locations.length && (
            <div className="p-6 text-center text-gray-400 text-sm">
              <MapPin size={24} className="mx-auto mb-2 opacity-30" />No vehicles online
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden shadow-sm border border-gray-200">
        <LiveMap locations={locations} selectedId={selected} onSelect={setSelected} />
      </div>
    </div>
  );
}