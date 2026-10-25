/**
 * SUPER_ADMIN / ADMIN dashboard
 * Content: Full command center — GPS, fleet status, finance snapshot,
 * active alerts, maintenance, user count, quick actions, activity chart.
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
import {
  Truck, Activity, Bell, Wrench, DollarSign, TrendingUp, TrendingDown,
  Plus, UserPlus, Navigation, CheckCircle, Clock, Wifi, WifiOff,
  Database, Server, MapPin, BarChart3, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-brand-50 rounded-xl">
      <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

function Card({ title, value, sub, icon, href, pulse, accent = 'blue' }: {
  title: string; value: number | string; sub: string;
  icon: React.ReactNode; href?: string; pulse?: boolean;
  accent?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}) {
  const accents = {
    blue:   'border-brand-200 bg-brand-50/40',
    green:  'border-green-200 bg-green-50/40',
    yellow: 'border-yellow-200 bg-yellow-50/40',
    red:    'border-red-200 bg-red-50/40',
    gray:   'border-gray-200 bg-gray-50/30',
  };
  const el = (
    <div className={cn('bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition group', accents[accent])}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center group-hover:scale-105 transition">
          {icon}
        </div>
        {pulse && (
          <span className="relative flex h-2.5 w-2.5 mt-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      <p className="text-sm font-semibold text-gray-700 mt-0.5">{title}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{el}</Link> : el;
}

export default function AdminDashboard() {
  const { accessToken, user } = useAuthStore();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locations, setLocations]   = useState<Record<string, LocationData>>({});
  const [connected, setConnected]   = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({ queryKey: ['dashboard-stats'], queryFn: dashboardApi.stats, refetchInterval: 30_000 });
  const { data: locs }      = useQuery({ queryKey: ['fleet-locations'],  queryFn: telemetryApi.getLocations, refetchInterval: 60_000 });

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
    s.on('gps:online',  (p: { vehicleId: string }) => { setConnected(prev => { const n = new Set(prev); n.add(p.vehicleId); return n; }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); });
    s.on('gps:offline', (p: { vehicleId: string }) => { setConnected(prev => { const n = new Set(prev); n.delete(p.vehicleId); return n; }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); });
    return () => { s.off('location:update'); s.off('gps:online'); s.off('gps:offline'); };
  }, [accessToken, qc]);

  const t       = data?.totals ?? {};
  const ll      = Object.values(locations);
  const moving  = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'ACTIVE').length;
  const idle    = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'IDLE').length;
  const offline = ll.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'OFFLINE').length;
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const chart = (data?.activity ?? []).map((d: any) => ({ day: dayNames[new Date(d.day).getDay()], v: d.count }));

  if (isLoading) return (
    <div className="animate-pulse space-y-5">
      <div className="h-8 bg-gray-100 rounded w-64" />
      <div className="grid grid-cols-5 gap-3">{[...Array(5)].map((_,i) => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}</div>
      <div className="h-96 bg-gray-100 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user?.role === 'SUPER_ADMIN' ? 'Platform Overview' : 'Dashboard'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.organization?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium',
            connected.size > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-500')}>
            {connected.size > 0 ? <Wifi size={11} /> : <WifiOff size={11} />} {connected.size} GPS online
          </span>
          <Link href="/vehicles/new" className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium transition">
            <Plus size={13} /> Add Vehicle
          </Link>
        </div>
      </div>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card title="Total Vehicles" value={t.vehicles ?? 0}                  sub="Registered fleet"    icon={<Truck size={18} className="text-brand-600" />}  href="/vehicles" accent="blue" />
        <Card title="Moving"         value={moving || t.activeVehicles || 0}  sub="On the road now"     icon={<Activity size={18} className="text-green-600" />} href="/map"      accent="green" pulse={moving > 0} />
        <Card title="Idle"           value={idle   || t.idleVehicles   || 0}  sub="Engine on, stopped"  icon={<Clock size={18} className="text-yellow-600" />}   accent="yellow" />
        <Card title="Offline"        value={offline|| t.offlineVehicles|| 0}  sub="No GPS signal"       icon={<WifiOff size={18} className="text-gray-500" />}   accent="gray" />
        <Card title="Active Alerts"  value={t.activeAlerts ?? 0}              sub="Need attention"       icon={<Bell size={18} className="text-red-600" />}      href="/alerts"   accent="red" />
      </div>

      {/* Map + alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ height: 410 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Navigation size={14} className="text-brand-600" />
              <span className="text-sm font-semibold text-gray-800">Live Fleet Map</span>
              {moving > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{moving} moving</span>}
            </div>
            <Link href="/map" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Full screen →</Link>
          </div>
          <div className="flex-1 min-h-0">
            <LiveMap locations={ll} selectedId={selectedId} onSelect={setSelectedId} connectedDevices={connected} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col" style={{ height: 410 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-red-500" />
              <span className="text-sm font-semibold text-gray-800">Recent Alerts</span>
            </div>
            <Link href="/alerts" className="text-xs text-brand-600 font-medium">View all →</Link>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {!(data?.recentAlerts?.length) ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <CheckCircle size={28} className="mb-2 opacity-20" />
                <p className="text-sm font-medium">No active alerts</p>
              </div>
            ) : (data.recentAlerts).map((a: any) => (
              <button key={a.id} onClick={() => setSelectedId(a.vehicle?.id)}
                className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left transition">
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold shrink-0 mt-0.5 whitespace-nowrap',
                  { CRITICAL:'bg-red-100 text-red-700', HIGH:'bg-orange-100 text-orange-700', MEDIUM:'bg-yellow-100 text-yellow-700', LOW:'bg-blue-100 text-blue-700' }[a.severity as string] ?? 'bg-gray-100 text-gray-600')}>
                  {a.severity}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                  <p className="text-xs text-gray-400 truncate">{a.vehicle?.licensePlate} · {formatDate(a.triggeredAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: fleet bars, finance, maintenance, quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5"><Truck size={13} className="text-brand-600" /> Fleet Status</p>
          {[
            { l:'Moving',  c:moving||t.activeVehicles||0,  bg:'bg-green-500',  tx:'text-green-700' },
            { l:'Idle',    c:idle  ||t.idleVehicles  ||0,  bg:'bg-yellow-400', tx:'text-yellow-700' },
            { l:'Offline', c:offline||t.offlineVehicles||0,bg:'bg-gray-300',   tx:'text-gray-600' },
          ].map(({l,c,bg,tx}) => {
            const pct = Math.round((c / Math.max(t.vehicles||1,1)) * 100);
            return (
              <div key={l} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">{l}</span><span className={cn('font-bold',tx)}>{c}</span></div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={cn('h-full rounded-full transition-all',bg)} style={{width:`${pct}%`}} /></div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5"><DollarSign size={13} className="text-emerald-600" /> This Month</p>
          {[
            { l:'Income',   v:data?.financial?.income??0,   cl:'text-green-700',   ic:<TrendingUp size={11}/> },
            { l:'Expenses', v:data?.financial?.expenses??0, cl:'text-red-600',     ic:<TrendingDown size={11}/> },
            { l:'Profit',   v:data?.financial?.profit??0,   cl:'text-emerald-700', ic:<DollarSign size={11}/> },
          ].map(({l,v,cl,ic}) => (
            <div key={l} className="flex justify-between items-center mb-2.5">
              <span className="text-xs text-gray-500 flex items-center gap-1">{ic}{l}</span>
              <span className={cn('text-xs font-bold',cl)}>{((v as number)/1000).toFixed(0)}K RWF</span>
            </div>
          ))}
          <Link href="/finance" className="block text-center text-xs text-brand-600 hover:text-brand-700 pt-2 border-t border-gray-100 font-medium">Finance centre →</Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5"><Wrench size={13} className="text-orange-500" /> Maintenance</p>
          {[
            { l:'Overdue',   v:data?.maintenance?.overdue ??0, cl:'text-red-600' },
            { l:'Due Today', v:data?.maintenance?.dueToday??0, cl:'text-orange-600' },
            { l:'Upcoming',  v:data?.maintenance?.upcoming??0, cl:'text-brand-600' },
          ].map(({l,v,cl}) => (
            <div key={l} className="flex justify-between items-center mb-2.5">
              <span className="text-sm text-gray-500">{l}</span>
              <span className={cn('text-xl font-bold',cl)}>{v}</span>
            </div>
          ))}
          <Link href="/maintenance" className="block text-center text-xs text-brand-600 hover:text-brand-700 pt-2 border-t border-gray-100 font-medium">View schedule →</Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { l:'Add Vehicle', i:<Plus size={13}/>,      h:'/vehicles',  bg:'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100' },
              { l:'Add Driver',  i:<UserPlus size={13}/>,  h:'/drivers',   bg:'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
              { l:'Live Map',    i:<Navigation size={13}/>,h:'/map',       bg:'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
              { l:'Reports',     i:<BarChart3 size={13}/>, h:'/reports',   bg:'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100' },
              { l:'Users',       i:<Users size={13}/>,     h:'/users',     bg:'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
              { l:'Finance',     i:<DollarSign size={13}/>,h:'/finance',   bg:'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
            ].map(({l,i,h,bg}) => (
              <Link key={l} href={h} className={cn('flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-semibold transition',bg)}>{i}{l}</Link>
            ))}
          </div>
        </div>
      </div>

      {/* Activity chart + system health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5"><Activity size={13} className="text-brand-600" /> Vehicle Activity — Last 7 Days</p>
          {chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={chart}>
                <XAxis dataKey="day" tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:10,fill:'#9ca3af'}} axisLine={false} tickLine={false} width={22} allowDecimals={false} />
                <Tooltip contentStyle={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,fontSize:11}} labelStyle={{fontWeight:600}} />
                <Line type="monotone" dataKey="v" name="Vehicles" stroke="#2563eb" strokeWidth={2.5} dot={{fill:'#2563eb',r:3}} activeDot={{r:5}} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[130px] text-gray-400 text-sm">No activity data yet — connect your GPS devices</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2.5">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">System Status</p>
          {[
            { l:'GPS Devices', v:`${connected.size} connected`, ok: true,            ic:<MapPin size={11}/> },
            { l:'MQTT Broker', v:'Online',                      ok: true,            ic:<Wifi size={11}/> },
            { l:'API Server',  v:'Running',                     ok: true,            ic:<Server size={11}/> },
            { l:'Database',    v:'Healthy',                     ok: true,            ic:<Database size={11}/> },
          ].map(({l,v,ok,ic}) => (
            <div key={l} className="flex items-center gap-2.5">
              <span className={cn('w-2 h-2 rounded-full shrink-0', ok ? 'bg-green-500' : 'bg-red-500')} />
              <span className="text-xs text-gray-500 flex-1">{l}</span>
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1">{ic}{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
