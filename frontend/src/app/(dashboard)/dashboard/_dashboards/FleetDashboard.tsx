/**
 * FLEET_MANAGER dashboard
 * Visual identity: amber/orange — operations focus.
 * Full GPS map, vehicle status, maintenance alerts, recent alerts.
 */
'use client';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, telemetryApi, maintenanceApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { getLiveStatus } from '@/lib/liveStatus';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { LocationData } from '@/components/maps/LiveMap';
import { Bell, Wrench, Navigation, CheckCircle, Wifi, WifiOff, Car } from 'lucide-react';
import { cn } from '@/lib/utils';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-amber-50 text-amber-400 rounded-xl">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function FleetDashboard() {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locations, setLocations]   = useState<Record<string, LocationData>>({});
  const [connected, setConnected]   = useState<Set<string>>(new Set());

  const { data } = useQuery({ queryKey: ['dashboard-stats'], queryFn: dashboardApi.stats, refetchInterval: 30_000 });
  const { data: locs } = useQuery({ queryKey: ['fleet-locations'], queryFn: telemetryApi.getLocations, refetchInterval: 60_000 });
  const { data: upcoming = [] } = useQuery<any[]>({
    queryKey: ['maintenance', 'upcoming'],
    queryFn:  () => maintenanceApi.upcoming({ days: 30 }),
    select:   (d) => d.slice(0, 6),
  });

  useEffect(() => {
    if (!locs) return;
    const map: Record<string, LocationData> = {};
    for (const l of locs) {
      if (l.vehicleId) map[l.vehicleId] = {
        vehicleId: l.vehicleId, latitude: l.latitude ?? 0, longitude: l.longitude ?? 0,
        speed: l.speed ?? 0, heading: l.heading ?? 0, fuelLevel: l.fuelLevel,
        engineTemp: l.engineTemp, engineOn: l.engineOn ?? false,
        accuracy: null, updatedAt: l.updatedAt, vehicle: l.vehicle,
      };
    }
    setLocations(prev => ({ ...map, ...prev }));
  }, [locs]);

  useEffect(() => {
    if (!accessToken) return;
    const s = getSocket(accessToken);
    s.on('location:update', (p: LocationData) =>
      setLocations(prev => ({ ...prev, [p.vehicleId]: { ...prev[p.vehicleId], ...p } })));
    s.on('gps:online',  (p: any) => {
      setConnected(prev => { const n = new Set(prev); n.add(p.vehicleId); return n; });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    });
    s.on('gps:offline', (p: any) => {
      setConnected(prev => { const n = new Set(prev); n.delete(p.vehicleId); return n; });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    });
    return () => { s.off('location:update'); s.off('gps:online'); s.off('gps:offline'); };
  }, [accessToken, qc]);

  const t  = data?.totals ?? {};
  const ll = Object.values(locations);
  const moving  = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'ACTIVE').length;
  const idle    = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'IDLE').length;
  const offline = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'OFFLINE').length;

  return (
    <div className="space-y-5">
      {/* Amber header */}
      <div className="bg-gradient-to-r from-amber-800 to-orange-600 rounded-2xl p-5 text-white">
        <h1 className="text-2xl font-bold">Fleet Operations</h1>
        <p className="text-amber-200 text-sm mt-0.5">{formatDate(new Date())}</p>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { l: 'Total',   v: t.vehicles ?? 0 },
            { l: 'Moving',  v: moving || t.activeVehicles || 0 },
            { l: 'Idle',    v: idle   || t.idleVehicles   || 0 },
            { l: 'Offline', v: offline|| t.offlineVehicles|| 0 },
          ].map(({ l, v }) => (
            <div key={l}><p className="text-amber-300 text-xs">{l}</p><p className="text-xl font-bold">{v}</p></div>
          ))}
        </div>
      </div>

      {/* Live map — full focus */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" style={{ height: 440 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Navigation size={14} className="text-amber-600" />
            <span className="text-sm font-semibold">Live Fleet Map</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
              connected.size > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
              {connected.size > 0 ? <Wifi size={10} className="inline mr-1" /> : <WifiOff size={10} className="inline mr-1" />}
              {connected.size} live
            </span>
          </div>
          <Link href="/map" className="text-xs text-amber-600 font-medium">Full screen →</Link>
        </div>
        <div style={{ height: 392 }}>
          <LiveMap locations={ll} selectedId={selectedId} onSelect={setSelectedId} connectedDevices={connected} />
        </div>
      </div>

      {/* Alerts + Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active alerts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-red-500" />
              <span className="text-sm font-semibold">Active Alerts</span>
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                {t.activeAlerts ?? 0}
              </span>
            </div>
            <Link href="/alerts" className="text-xs text-amber-600 font-medium">View all →</Link>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
            {(data?.recentAlerts ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <CheckCircle size={24} className="mb-1 opacity-30" />
                <p className="text-sm">No active alerts</p>
              </div>
            ) : (data?.recentAlerts ?? []).map((a: any) => (
              <div key={a.id}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedId(a.vehicle?.id)}>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold shrink-0 mt-0.5',
                  { CRITICAL: 'bg-red-100 text-red-700', HIGH: 'bg-orange-100 text-orange-700',
                    MEDIUM: 'bg-yellow-100 text-yellow-700', LOW: 'bg-blue-100 text-blue-700',
                  }[a.severity as string] ?? 'bg-gray-100 text-gray-600')}>
                  {a.severity}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                  <p className="text-xs text-gray-400">{a.vehicle?.licensePlate} · {formatDate(a.triggeredAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming maintenance */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Wrench size={14} className="text-amber-600" />
              <span className="text-sm font-semibold">Upcoming Maintenance</span>
            </div>
            <Link href="/maintenance" className="text-xs text-amber-600 font-medium">Schedule →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <CheckCircle size={24} className="mb-1 opacity-30" />
                <p className="text-sm">All vehicles up to date</p>
              </div>
            ) : upcoming.map((v: any) => {
              const days = v.nextServiceDate
                ? Math.ceil((new Date(v.nextServiceDate).getTime() - Date.now()) / 86400000)
                : null;
              return (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <Car size={14} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{v.licensePlate}</p>
                    <p className="text-xs text-gray-400">{v.manufacturer} {v.model}</p>
                  </div>
                  {days !== null && (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                      days < 0  ? 'bg-red-100 text-red-700' :
                      days <= 7 ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-600')}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
