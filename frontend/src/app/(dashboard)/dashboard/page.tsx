'use client';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, telemetryApi, vehicleApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { getLiveStatus } from '@/lib/liveStatus';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { LocationData } from '@/components/maps/LiveMap';
import {
  Truck, Activity, Bell, AlertTriangle, MapPin, Users, Zap,
  Fuel, Wrench, DollarSign, TrendingUp, TrendingDown, Plus,
  UserPlus, Navigation, FileText, CheckCircle, Clock,
  Wifi, WifiOff, Database, Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer } from 'recharts';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-800 text-gray-400 rounded-xl">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading live map…</p>
      </div>
    </div>
  ),
});

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = Date.now();
    const duration = 600;
    const from = display;
    const animate = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * ease));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ title, value, sub, icon, color, href, pulse }:
  { title: string; value: number; sub: string; icon: React.ReactNode;
    color: string; href?: string; pulse?: boolean }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green:  'bg-green-500/20 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    red:    'bg-red-500/20 text-red-400 border-red-500/30',
    gray:   'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  const content = (
    <div className={cn(
      'bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition cursor-pointer group',
      href && 'hover:bg-gray-750'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-lg border flex items-center justify-center', colors[color] ?? colors.blue)}>
          {icon}
        </div>
        {pulse && <span className="relative flex h-2 w-2 mt-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>}
      </div>
      <p className="text-3xl font-bold text-white mb-0.5">
        <AnimatedNumber value={value} />
      </p>
      <p className="text-sm font-semibold text-gray-300">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

// ─── Alert row ────────────────────────────────────────────────────────────────
function AlertRow({ alert, onHighlight }: { alert: any; onHighlight: (id: string) => void }) {
  const sev = {
    CRITICAL: 'text-red-400 bg-red-500/10',
    HIGH:     'text-orange-400 bg-orange-500/10',
    MEDIUM:   'text-yellow-400 bg-yellow-500/10',
    LOW:      'text-blue-400 bg-blue-500/10',
    INFO:     'text-gray-400 bg-gray-500/10',
  };
  return (
    <div
      onClick={() => onHighlight(alert.vehicle?.id)}
      className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-700/50 cursor-pointer transition border border-transparent hover:border-gray-600">
      <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold shrink-0 mt-0.5', sev[alert.severity as keyof typeof sev] ?? sev.INFO)}>
        {alert.severity}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">{alert.title}</p>
        <p className="text-xs text-gray-500 truncate">{alert.vehicle?.licensePlate} · {formatDate(alert.triggeredAt)}</p>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Record<string, LocationData>>({});
  const [connectedDevices, setConnectedDevices] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.stats,
    refetchInterval: 30_000,
  });

  const { data: initialLocations } = useQuery({
    queryKey: ['fleet-locations'],
    queryFn: telemetryApi.getLocations,
    refetchInterval: 60_000,
  });

  // Seed locations from REST
  useEffect(() => {
    if (!initialLocations) return;
    const map: Record<string, LocationData> = {};
    for (const loc of initialLocations) {
      if (!loc.vehicleId) continue;
      map[loc.vehicleId] = { vehicleId: loc.vehicleId, latitude: loc.latitude ?? 0, longitude: loc.longitude ?? 0,
        speed: loc.speed ?? 0, heading: loc.heading ?? 0, fuelLevel: loc.fuelLevel, engineTemp: loc.engineTemp,
        engineOn: loc.engineOn ?? false, accuracy: null, updatedAt: loc.updatedAt, vehicle: loc.vehicle };
    }
    setLocations(prev => ({ ...map, ...prev }));
  }, [initialLocations]);

  // Socket.IO for live updates
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket.on('location:update', (p: LocationData) => {
      setLocations(prev => ({ ...prev, [p.vehicleId]: { ...prev[p.vehicleId], ...p } }));
    });
    socket.on('gps:online', (p: { vehicleId: string }) => {
      setConnectedDevices(prev => { const s = new Set(prev); s.add(p.vehicleId); return s; });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    });
    socket.on('gps:offline', (p: { vehicleId: string }) => {
      setConnectedDevices(prev => { const s = new Set(prev); s.delete(p.vehicleId); return s; });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    });
    return () => { socket.off('location:update'); socket.off('gps:online'); socket.off('gps:offline'); };
  }, [accessToken, qc]);

  const t = data?.totals ?? {};
  const locationList = Object.values(locations);

  // Live counts from socket
  const liveActive  = locationList.filter(l => getLiveStatus(l.updatedAt, l.engineOn) === 'ACTIVE').length;
  const liveIdle    = locationList.filter(l => getLiveStatus(l.updatedAt, l.engineOn) === 'IDLE').length;
  const liveOffline = locationList.filter(l => getLiveStatus(l.updatedAt, l.engineOn) === 'OFFLINE').length;

  const now = new Date();
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const activityData = (data?.activity ?? []).map((d: any) => ({
    day: dayNames[new Date(d.day).getDay()],
    vehicles: d.count,
  }));

  if (isLoading) return (
    <div className="min-h-screen bg-gray-900 p-6 animate-pulse space-y-5">
      <div className="h-8 bg-gray-700 rounded w-48" />
      <div className="grid grid-cols-5 gap-4">{[...Array(5)].map((_,i) => <div key={i} className="h-28 bg-gray-700 rounded-xl" />)}</div>
      <div className="h-96 bg-gray-700 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Fleet overview · {formatDate(now)}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border',
            connectedDevices.size > 0 ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-gray-700 border-gray-600 text-gray-400')}>
            <Wifi size={11} />
            {connectedDevices.size} GPS online
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard title="Total Vehicles" value={t.vehicles ?? 0} sub="Registered" icon={<Truck size={18}/>} color="blue" href="/vehicles" />
        <SummaryCard title="Moving" value={liveActive || t.activeVehicles || 0} sub="Active now" icon={<Activity size={18}/>} color="green" href="/map" pulse={liveActive > 0} />
        <SummaryCard title="Idle" value={liveIdle || t.idleVehicles || 0} sub="Engine ON" icon={<Clock size={18}/>} color="yellow" />
        <SummaryCard title="Offline" value={liveOffline || t.offlineVehicles || 0} sub="No connection" icon={<WifiOff size={18}/>} color="gray" />
        <SummaryCard title="Alerts" value={t.activeAlerts ?? 0} sub="Require attention" icon={<Bell size={18}/>} color="red" href="/alerts" />
      </div>

      {/* Map + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ minHeight: 440 }}>
        {/* Live Map — 2/3 width */}
        <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden" style={{ height: 440 }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Navigation size={14} className="text-blue-400" />
              <span className="text-sm font-semibold text-white">Live Tracking</span>
              {liveActive > 0 && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
                  {liveActive} active
                </span>
              )}
            </div>
            <Link href="/map" className="text-xs text-blue-400 hover:text-blue-300 transition">
              Full map →
            </Link>
          </div>
          <div style={{ height: 'calc(100% - 44px)' }}>
            <LiveMap
              locations={locationList}
              selectedId={selectedVehicleId}
              onSelect={setSelectedVehicleId}
              connectedDevices={connectedDevices}
            />
          </div>
        </div>

        {/* Recent Alerts — 1/3 width */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl flex flex-col" style={{ height: 440 }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-red-400" />
              <span className="text-sm font-semibold text-white">Recent Alerts</span>
            </div>
            <Link href="/alerts" className="text-xs text-blue-400 hover:text-blue-300 transition">View all →</Link>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {(data?.recentAlerts ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <CheckCircle size={28} className="mb-2 opacity-30" />
                <p className="text-sm">No active alerts</p>
              </div>
            ) : (data?.recentAlerts ?? []).map((a: any) => (
              <AlertRow key={a.id} alert={a} onHighlight={id => { setSelectedVehicleId(id); }} />
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fleet Status chart */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Truck size={14} className="text-blue-400" />Fleet Status</p>
          <div className="space-y-2">
            {[
              { label: 'Active', count: liveActive || t.activeVehicles || 0, color: 'bg-green-500' },
              { label: 'Idle',   count: liveIdle   || t.idleVehicles   || 0, color: 'bg-yellow-500' },
              { label: 'Offline',count: liveOffline|| t.offlineVehicles|| 0, color: 'bg-gray-500' },
            ].map(({ label, count, color }) => {
              const total = t.vehicles || 1;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-semibold">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full">
                    <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.round((count / total) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trips */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Navigation size={14} className="text-purple-400" />Today's Trips</p>
          <div className="space-y-2.5">
            {[
              { label: 'Completed', value: data?.trips?.today ?? 0,   color: 'text-green-400' },
              { label: 'Running',   value: data?.trips?.running ?? 0, color: 'text-blue-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-400">{label}</span>
                <span className={cn('text-xl font-bold', color)}>{value}</span>
              </div>
            ))}
            <Link href="/reports" className="block text-center text-xs text-blue-400 hover:text-blue-300 mt-2 pt-2 border-t border-gray-700">View details →</Link>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Wrench size={14} className="text-orange-400" />Maintenance</p>
          <div className="space-y-2.5">
            {[
              { label: 'Due Today', value: data?.maintenance?.dueToday ?? 0,  color: 'text-orange-400' },
              { label: 'Overdue',   value: data?.maintenance?.overdue  ?? 0,  color: 'text-red-400' },
              { label: 'Upcoming',  value: data?.maintenance?.upcoming ?? 0, color: 'text-blue-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-400">{label}</span>
                <span className={cn('text-lg font-bold', color)}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Financial */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><DollarSign size={14} className="text-emerald-400" />This Month</p>
          <div className="space-y-2.5">
            {[
              { label: 'Income',   value: data?.financial?.income   ?? 0, color: 'text-green-400',  icon: <TrendingUp size={12}/> },
              { label: 'Expenses', value: data?.financial?.expenses ?? 0, color: 'text-red-400',    icon: <TrendingDown size={12}/> },
              { label: 'Profit',   value: data?.financial?.profit   ?? 0, color: 'text-emerald-400', icon: <DollarSign size={12}/> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-400 flex items-center gap-1">{icon}{label}</span>
                <span className={cn('text-xs font-bold', color)}>
                  {(value / 1000).toFixed(0)}K RWF
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Graph + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity line chart */}
        <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity size={14} className="text-blue-400" /> Vehicle Activity (Last 7 Days)
          </p>
          {activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={activityData}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
                <RechartTooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Line type="monotone" dataKey="vehicles" stroke="#3b82f6" strokeWidth={2.5}
                  dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[140px] text-gray-600 text-sm">
              No activity data yet
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-white mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Add Vehicle', icon: <Plus size={16}/>,      href: '/vehicles',  color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
              { label: 'Add Driver',  icon: <UserPlus size={16}/>,   href: '/drivers',   color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
              { label: 'Track Live',  icon: <Navigation size={16}/>, href: '/map',       color: 'text-green-400 bg-green-500/10 border-green-500/30' },
              { label: 'Record Fuel', icon: <Fuel size={16}/>,       href: '/finance',   color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
              { label: 'Maintenance', icon: <Wrench size={16}/>,     href: '/vehicles',  color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
              { label: 'Report',      icon: <FileText size={16}/>,   href: '/reports',   color: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
            ].map(({ label, icon, href, color }) => (
              <Link key={label} href={href}
                className={cn('flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition hover:opacity-80', color)}>
                {icon}
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* System status footer */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-5 py-3 flex items-center gap-6 flex-wrap">
        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">System</span>
        {[
          { label: 'GPS Devices', value: `${connectedDevices.size} Online`, ok: true, icon: <MapPin size={11}/> },
          { label: 'MQTT',        value: 'Connected',                        ok: true, icon: <Wifi size={11}/> },
          { label: 'Server',      value: 'Online',                           ok: true, icon: <Server size={11}/> },
          { label: 'Database',    value: 'Healthy',                          ok: true, icon: <Database size={11}/> },
        ].map(({ label, value, ok, icon }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', ok ? 'bg-green-500' : 'bg-red-500')} />
            <span className="text-xs text-gray-400">{label}</span>
            <span className="text-xs text-gray-300 font-medium flex items-center gap-1">{icon}{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
