/**
 * VIEWER dashboard
 * Visual identity: slate/cool gray — read-only, informational.
 * Live map + fleet status summary. No edit actions anywhere.
 */
'use client';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, telemetryApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { getLiveStatus } from '@/lib/liveStatus';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { LocationData } from '@/components/maps/LiveMap';
import { Truck, Activity, Bell, Clock, Wifi, WifiOff, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), { ssr: false,
  loading: () => <div className="flex items-center justify-center h-full bg-slate-100 text-slate-400 rounded-xl"><div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /></div> });

export default function ViewerDashboard() {
  const { accessToken, user } = useAuthStore();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locations, setLocations]   = useState<Record<string, LocationData>>({});
  const [connected, setConnected]   = useState<Set<string>>(new Set());

  const { data } = useQuery({ queryKey: ['dashboard-stats'], queryFn: dashboardApi.stats, refetchInterval: 60_000 });
  const { data: locs } = useQuery({ queryKey: ['fleet-locations'], queryFn: telemetryApi.getLocations, refetchInterval: 60_000 });

  useEffect(() => {
    if (!locs) return;
    const map: Record<string, LocationData> = {};
    for (const l of locs) { if (l.vehicleId) map[l.vehicleId] = { vehicleId: l.vehicleId, latitude: l.latitude ?? 0, longitude: l.longitude ?? 0, speed: l.speed ?? 0, heading: l.heading ?? 0, fuelLevel: l.fuelLevel, engineTemp: l.engineTemp, engineOn: l.engineOn ?? false, accuracy: null, updatedAt: l.updatedAt, vehicle: l.vehicle }; }
    setLocations(prev => ({ ...map, ...prev }));
  }, [locs]);

  useEffect(() => {
    if (!accessToken) return;
    const s = getSocket(accessToken);
    s.on('location:update', (p: LocationData) => setLocations(prev => ({ ...prev, [p.vehicleId]: { ...prev[p.vehicleId], ...p } })));
    s.on('gps:online',  (p: any) => { setConnected(prev => { const n = new Set(prev); n.add(p.vehicleId); return n; }); });
    s.on('gps:offline', (p: any) => { setConnected(prev => { const n = new Set(prev); n.delete(p.vehicleId); return n; }); });
    return () => { s.off('location:update'); s.off('gps:online'); s.off('gps:offline'); };
  }, [accessToken, qc]);

  const t   = data?.totals ?? {};
  const ll  = Object.values(locations);
  const moving  = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'ACTIVE').length;
  const idle    = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'IDLE').length;
  const offline = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'OFFLINE').length;

  return (
    <div className="space-y-5">
      {/* Slate header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-600 rounded-2xl p-5 text-white">
        <h1 className="text-2xl font-bold">Fleet Overview</h1>
        <p className="text-slate-300 text-sm mt-0.5">{formatDate(new Date())} · Read-only view for {user?.firstName}</p>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { l: 'Total', v: t.vehicles ?? 0 },
            { l: 'Moving', v: moving || t.activeVehicles || 0 },
            { l: 'Idle',   v: idle   || t.idleVehicles   || 0 },
            { l: 'Alerts', v: t.activeAlerts ?? 0 },
          ].map(({ l, v }) => (
            <div key={l}><p className="text-slate-400 text-xs">{l}</p><p className="text-xl font-bold">{v}</p></div>
          ))}
        </div>
      </div>

      {/* Four summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Vehicles',    v: t.vehicles ?? 0,                  icon: <Truck size={16} />,     bg: 'bg-slate-100',  tx: 'text-slate-700' },
          { l: 'Moving',      v: moving || t.activeVehicles || 0,  icon: <Activity size={16} />,  bg: 'bg-green-50',   tx: 'text-green-700' },
          { l: 'Idle',        v: idle   || t.idleVehicles   || 0,  icon: <Clock size={16} />,     bg: 'bg-yellow-50',  tx: 'text-yellow-700' },
          { l: 'Active Alerts', v: t.activeAlerts ?? 0,            icon: <Bell size={16} />,      bg: 'bg-red-50',     tx: 'text-red-700' },
        ].map(({ l, v, icon, bg, tx }) => (
          <div key={l} className={cn('rounded-xl border border-gray-200 p-4 flex items-center gap-3 bg-white shadow-sm')}>
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', bg, tx)}>{icon}</div>
            <div><p className="text-xl font-bold text-gray-900">{v}</p><p className="text-xs text-gray-500">{l}</p></div>
          </div>
        ))}
      </div>

      {/* Live map — large, full focus */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" style={{ height: 460 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Navigation size={14} className="text-slate-600" />
            <span className="text-sm font-semibold text-gray-800">Live Fleet Map</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium border', connected.size > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-500')}>
              {connected.size > 0 ? <Wifi size={10} className="inline mr-1" /> : <WifiOff size={10} className="inline mr-1" />}
              {connected.size} live
            </span>
          </div>
          <Link href="/map" className="text-xs text-slate-600 font-medium hover:text-slate-900">Full screen →</Link>
        </div>
        <div style={{ height: 412 }}>
          <LiveMap locations={ll} selectedId={selectedId} onSelect={setSelectedId} connectedDevices={connected} />
        </div>
      </div>

      {/* Recent alerts — read-only */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2"><Bell size={14} className="text-red-500" /><span className="text-sm font-semibold">Recent Alerts</span></div>
          <Link href="/alerts" className="text-xs text-slate-600 font-medium">View all →</Link>
        </div>
        <div className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
          {(data?.recentAlerts ?? []).length === 0
            ? <div className="py-8 text-center text-gray-400 text-sm">No active alerts</div>
            : (data?.recentAlerts ?? []).map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold shrink-0 mt-0.5', { CRITICAL: 'bg-red-100 text-red-700', HIGH: 'bg-orange-100 text-orange-700', MEDIUM: 'bg-yellow-100 text-yellow-700', LOW: 'bg-blue-100 text-blue-700' }[a.severity as string] ?? 'bg-gray-100 text-gray-600')}>{a.severity}</span>
                  <div className="min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{a.title}</p><p className="text-xs text-gray-400">{a.vehicle?.licensePlate} · {formatDate(a.triggeredAt)}</p></div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
}
