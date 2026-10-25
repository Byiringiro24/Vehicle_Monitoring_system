/**
 * VIEWER dashboard
 * Content: Live map, fleet status summary, recent alerts.
 * Read-only — no create/edit/delete actions anywhere.
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
import { Truck, Activity, Bell, Clock, Wifi, WifiOff, Navigation, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-brand-50 rounded-xl">
      <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

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
    for (const l of locs) {
      if (!l.vehicleId) continue;
      map[l.vehicleId] = { vehicleId: l.vehicleId, latitude: l.latitude ?? 0, longitude: l.longitude ?? 0, speed: l.speed ?? 0, heading: l.heading ?? 0, fuelLevel: l.fuelLevel, engineTemp: l.engineTemp, engineOn: l.engineOn ?? false, accuracy: null, updatedAt: l.updatedAt, vehicle: l.vehicle };
    }
    setLocations(prev => ({ ...map, ...prev }));
  }, [locs]);

  useEffect(() => {
    if (!accessToken) return;
    const s = getSocket(accessToken);
    s.on('location:update', (p: LocationData) => setLocations(prev => ({ ...prev, [p.vehicleId]: { ...prev[p.vehicleId], ...p } })));
    s.on('gps:online',  (p: { vehicleId: string }) => setConnected(prev => { const n = new Set(prev); n.add(p.vehicleId); return n; }));
    s.on('gps:offline', (p: { vehicleId: string }) => setConnected(prev => { const n = new Set(prev); n.delete(p.vehicleId); return n; }));
    return () => { s.off('location:update'); s.off('gps:online'); s.off('gps:offline'); };
  }, [accessToken, qc]);

  const t       = data?.totals ?? {};
  const ll      = Object.values(locations);
  const moving  = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'ACTIVE').length;
  const idle    = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'IDLE').length;
  const offline = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'OFFLINE').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
        </div>
        <span className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium',
          connected.size > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-500')}>
          {connected.size > 0 ? <Wifi size={11} /> : <WifiOff size={11} />} {connected.size} GPS online
        </span>
      </div>

      {/* 4 read-only status chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Total Vehicles', v: t.vehicles ?? 0,                  icon: <Truck size={16} className="text-brand-600" />,   href: '/vehicles', border: 'border-brand-200' },
          { l: 'Moving',         v: moving || t.activeVehicles || 0,  icon: <Activity size={16} className="text-green-600" />, href: '/map',      border: 'border-green-200', pulse: moving > 0 },
          { l: 'Idle',           v: idle   || t.idleVehicles   || 0,  icon: <Clock size={16} className="text-yellow-600" />,                     border: 'border-yellow-200' },
          { l: 'Active Alerts',  v: t.activeAlerts ?? 0,              icon: <Bell size={16} className="text-red-600" />,       href: '/alerts',   border: 'border-red-200' },
        ].map(({ l, v, icon, href, border, pulse }: any) => {
          const el = (
            <div className={cn('bg-white rounded-xl border p-4 shadow-sm flex items-center gap-3 transition hover:shadow-md', border)}>
              <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 relative">
                {icon}
                {pulse && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{v}</p>
                <p className="text-xs text-gray-500 font-medium">{l}</p>
              </div>
            </div>
          );
          return href ? <Link key={l} href={href}>{el}</Link> : <div key={l}>{el}</div>;
        })}
      </div>

      {/* Live map — primary view */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" style={{ height: 460 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Navigation size={14} className="text-brand-600" />
            <span className="text-sm font-semibold text-gray-800">Live Fleet Map</span>
            {moving > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-200">
                {moving} moving
              </span>
            )}
          </div>
          <Link href="/map" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Full screen →</Link>
        </div>
        <div style={{ height: 417 }}>
          <LiveMap locations={ll} selectedId={selectedId} onSelect={setSelectedId} connectedDevices={connected} />
        </div>
      </div>

      {/* Fleet status bars + recent alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <Truck size={14} className="text-brand-600" /> Fleet Status Breakdown
          </p>
          {[
            { l: 'Moving',  c: moving  || t.activeVehicles  || 0, bg: 'bg-green-500',  tx: 'text-green-700' },
            { l: 'Idle',    c: idle    || t.idleVehicles    || 0, bg: 'bg-yellow-400', tx: 'text-yellow-700' },
            { l: 'Offline', c: offline || t.offlineVehicles || 0, bg: 'bg-gray-300',   tx: 'text-gray-600' },
          ].map(({ l, c, bg, tx }) => {
            const pct = Math.round((c / Math.max(t.vehicles || 1, 1)) * 100);
            return (
              <div key={l} className="mb-4">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600 font-medium">{l}</span>
                  <span className={cn('font-bold', tx)}>{c} vehicles ({pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-700', bg)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-red-500" />
              <span className="text-sm font-semibold text-gray-800">Recent Alerts</span>
            </div>
            <Link href="/alerts" className="text-xs text-brand-600 font-medium">View all →</Link>
          </div>
          <div className="divide-y divide-gray-100 max-h-[220px] overflow-y-auto">
            {!(data?.recentAlerts?.length) ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <CheckCircle size={26} className="mb-2 opacity-20" />
                <p className="text-sm">No active alerts</p>
              </div>
            ) : (data.recentAlerts).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold shrink-0 mt-0.5',
                  { CRITICAL:'bg-red-100 text-red-700', HIGH:'bg-orange-100 text-orange-700', MEDIUM:'bg-yellow-100 text-yellow-700', LOW:'bg-blue-100 text-blue-700' }[a.severity as string] ?? 'bg-gray-100 text-gray-600')}>
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
      </div>
    </div>
  );
}
