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
  Plus, UserPlus, Navigation, FileText, CheckCircle, Clock,
  Wifi, WifiOff, Database, Server, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer } from 'recharts';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400 rounded-xl">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading map…</p>
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
function SummaryCard({ title, value, sub, iconBg, iconColor, icon, href, pulse }:
  { title: string; value: number; sub: string;
    iconBg: string; iconColor: string; icon: React.ReactNode;
    href?: string; pulse?: boolean }) {
  const content = (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', iconBg)}>
          <span className={iconColor}>{icon}</span>
        </div>
        {pulse && (
          <span className="relative flex h-2.5 w-2.5 mt-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-tight">
        <AnimatedNumber value={value} />
      </p>
      <p className="text-sm font-semibold text-gray-700 mt-0.5">{title}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

// ─── Alert row ────────────────────────────────────────────────────────────────
function AlertRow({ alert, onHighlight }: { alert: any; onHighlight: (id: string) => void }) {
  const sev: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700',
    HIGH:     'bg-orange-100 text-orange-700',
    MEDIUM:   'bg-yellow-100 text-yellow-700',
    LOW:      'bg-blue-100 text-blue-700',
    INFO:     'bg-gray-100 text-gray-600',
  };
  return (
    <div
      onClick={() => onHighlight(alert.vehicle?.id)}
      className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition border border-transparent hover:border-gray-200">
      <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold shrink-0 mt-0.5 whitespace-nowrap', sev[alert.severity as keyof typeof sev] ?? sev.INFO)}>
        {alert.severity}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{alert.title}</p>
        <p className="text-xs text-gray-400 truncate">{alert.vehicle?.licensePlate} · {formatDate(alert.triggeredAt)}</p>
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

  // Seed locations
  useEffect(() => {
    if (!initialLocations) return;
    const map: Record<string, LocationData> = {};
    for (const loc of initialLocations) {
      if (!loc.vehicleId) continue;
      map[loc.vehicleId] = {
        vehicleId: loc.vehicleId, latitude: loc.latitude ?? 0, longitude: loc.longitude ?? 0,
        speed: loc.speed ?? 0, heading: loc.heading ?? 0, fuelLevel: loc.fuelLevel,
        engineTemp: loc.engineTemp, engineOn: loc.engineOn ?? false,
        accuracy: null, updatedAt: loc.updatedAt, vehicle: loc.vehicle,
      };
    }
    setLocations(prev => ({ ...map, ...prev }));
  }, [initialLocations]);

  // Socket.IO live updates
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
    return () => {
      socket.off('location:update');
      socket.off('gps:online');
      socket.off('gps:offline');
    };
  }, [accessToken, qc]);

  const t = data?.totals ?? {};
  const locationList = Object.values(locations);
  const liveActive  = locationList.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'ACTIVE').length;
  const liveIdle    = locationList.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'IDLE').length;
  const liveOffline = locationList.filter(l => getLiveStatus(l.updatedAt, l.speed) === 'OFFLINE').length;

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const activityData = (data?.activity ?? []).map((d: any) => ({
    day: dayNames[new Date(d.day).getDay()],
    vehicles: d.count,
  }));

  if (isLoading) return (
    <div className="animate-pulse space-y-5">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_,i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
      </div>
      <div className="h-96 bg-gray-200 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Fleet overview · {formatDate(new Date())}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium',
            connectedDevices.size > 0
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-gray-100 border-gray-200 text-gray-500')}>
            {connectedDevices.size > 0 ? <Wifi size={11} /> : <WifiOff size={11} />}
            {connectedDevices.size} GPS online
          </span>
        </div>
      </div>

      {/* Summary cards — scrollable on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard title="Total Vehicles" value={t.vehicles ?? 0} sub="Registered"
          iconBg="bg-brand-100" iconColor="text-brand-600" icon={<Truck size={20}/>} href="/vehicles" />
        <SummaryCard title="Moving" value={liveActive || t.activeVehicles || 0} sub="Active now"
          iconBg="bg-green-100" iconColor="text-green-600" icon={<Activity size={20}/>}
          href="/map" pulse={liveActive > 0} />
        <SummaryCard title="Idle" value={liveIdle || t.idleVehicles || 0} sub="Engine ON"
          iconBg="bg-yellow-100" iconColor="text-yellow-600" icon={<Clock size={20}/>} />
        <SummaryCard title="Offline" value={liveOffline || t.offlineVehicles || 0} sub="No GPS"
          iconBg="bg-gray-100" iconColor="text-gray-500" icon={<WifiOff size={20}/>} />
        <SummaryCard title="Alerts" value={t.activeAlerts ?? 0} sub="Require attention"
          iconBg="bg-red-100" iconColor="text-red-600" icon={<Bell size={20}/>} href="/alerts" />
      </div>

      {/* Map + Alerts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Live map — full width on mobile, 2/3 on xl */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ height: 420 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Navigation size={15} className="text-brand-600" />
              <span className="text-sm font-semibold text-gray-800">Live Tracking</span>
              {liveActive > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-200">
                  {liveActive} moving
                </span>
              )}
            </div>
            <Link href="/map" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              Full map →
            </Link>
          </div>
          <div className="flex-1 min-h-0">
            <LiveMap
              locations={locationList}
              selectedId={selectedVehicleId}
              onSelect={setSelectedVehicleId}
              connectedDevices={connectedDevices}
            />
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col" style={{ height: 420 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-red-500" />
              <span className="text-sm font-semibold text-gray-800">Recent Alerts</span>
            </div>
            <Link href="/alerts" className="text-xs text-brand-600 hover:text-brand-700 font-medium">View all →</Link>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {(data?.recentAlerts ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <CheckCircle size={28} className="mb-2 opacity-30" />
                <p className="text-sm font-medium">No active alerts</p>
              </div>
            ) : (data?.recentAlerts ?? []).map((a: any) => (
              <AlertRow key={a.id} alert={a} onHighlight={id => setSelectedVehicleId(id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Fleet Status */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Truck size={14} className="text-brand-600" /> Fleet Status
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'Moving',  count: liveActive || t.activeVehicles || 0, color: 'bg-green-500',  text: 'text-green-700' },
              { label: 'Idle',    count: liveIdle   || t.idleVehicles   || 0, color: 'bg-yellow-400', text: 'text-yellow-700' },
              { label: 'Offline', count: liveOffline|| t.offlineVehicles|| 0, color: 'bg-gray-400',   text: 'text-gray-600' },
            ].map(({ label, count, color, text }) => {
              const total = Math.max(t.vehicles || 1, 1);
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{label}</span>
                    <span className={cn('font-bold', text)}>{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-700', color)}
                      style={{ width: `${Math.round((count / total) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trips */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Navigation size={14} className="text-brand-600" /> Today's Trips
          </p>
          <div className="space-y-3">
            {[
              { label: 'Completed', value: data?.trips?.today   ?? 0, color: 'text-green-600' },
              { label: 'Running',   value: data?.trips?.running ?? 0, color: 'text-brand-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={cn('text-2xl font-bold', color)}>{value}</span>
              </div>
            ))}
            <Link href="/reports" className="block text-center text-xs text-brand-600 hover:text-brand-700 pt-1 border-t border-gray-100">
              View details →
            </Link>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Wrench size={14} className="text-orange-500" /> Maintenance
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'Due Today', value: data?.maintenance?.dueToday ?? 0, color: 'text-orange-600' },
              { label: 'Overdue',   value: data?.maintenance?.overdue  ?? 0, color: 'text-red-600' },
              { label: 'Upcoming',  value: data?.maintenance?.upcoming ?? 0, color: 'text-brand-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={cn('text-lg font-bold', color)}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Financial */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <DollarSign size={14} className="text-emerald-500" /> This Month
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'Income',   value: data?.financial?.income   ?? 0, color: 'text-green-600',  icon: <TrendingUp size={12}/> },
              { label: 'Expenses', value: data?.financial?.expenses ?? 0, color: 'text-red-600',    icon: <TrendingDown size={12}/> },
              { label: 'Profit',   value: data?.financial?.profit   ?? 0, color: 'text-emerald-600', icon: <DollarSign size={12}/> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-500 flex items-center gap-1">{icon}{label}</span>
                <span className={cn('text-xs font-bold', color)}>
                  {((value as number) / 1000).toFixed(0)}K RWF
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Activity size={14} className="text-brand-600" /> Vehicle Activity (Last 7 Days)
          </p>
          {activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={activityData}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
                <RechartTooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#374151', fontWeight: 600 }}
                  itemStyle={{ color: '#2563eb' }}
                />
                <Line type="monotone" dataKey="vehicles" stroke="#2563eb" strokeWidth={2.5}
                  dot={{ fill: '#2563eb', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[140px] text-gray-400 text-sm">
              No activity data yet — connect your GPS devices
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Add Vehicle', icon: <Plus size={16}/>,       href: '/vehicles', bg: 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100' },
              { label: 'Add Driver',  icon: <UserPlus size={16}/>,   href: '/drivers',  bg: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
              { label: 'Track Live',  icon: <Navigation size={16}/>, href: '/map',      bg: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
              { label: 'Finance',     icon: <DollarSign size={16}/>, href: '/finance',  bg: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' },
              { label: 'Maintenance', icon: <Wrench size={16}/>,     href: '/vehicles', bg: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
              { label: 'Report',      icon: <FileText size={16}/>,   href: '/reports',  bg: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100' },
            ].map(({ label, icon, href, bg }) => (
              <Link key={label} href={href}
                className={cn('flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition', bg)}>
                {icon}
                <span className="text-center leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* System status footer */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex items-center gap-4 sm:gap-6 flex-wrap">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">System</span>
        {[
          { label: 'GPS Devices', value: `${connectedDevices.size} Online`, ok: connectedDevices.size >= 0, icon: <MapPin size={10}/> },
          { label: 'MQTT',        value: 'Connected',                        ok: true,                       icon: <Wifi size={10}/> },
          { label: 'Server',      value: 'Online',                           ok: true,                       icon: <Server size={10}/> },
          { label: 'Database',    value: 'Healthy',                          ok: true,                       icon: <Database size={10}/> },
        ].map(({ label, value, ok, icon }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', ok ? 'bg-green-500' : 'bg-red-500')} />
            <span className="text-xs text-gray-500">{label}</span>
            <span className="text-xs text-gray-700 font-medium flex items-center gap-0.5">{icon}{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
