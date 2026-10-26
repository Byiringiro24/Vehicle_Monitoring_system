'use client';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { Navigation, Truck, UserCheck, Bell, Map, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function DispatcherDashboard() {
  const { user } = useAuthStore();
  const today = new Date().toISOString().split('T')[0];

  const { data: tripsData } = useQuery({
    queryKey: ['trips-today'],
    queryFn: () => apiClient.get(`/trips?date=${today}&limit=20`).then(r => r.data),
  });
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn:  () => apiClient.get('/dashboard/stats').then(r => r.data),
  });

  const trips: any[] = tripsData?.data ?? [];
  const unassigned   = trips.filter(t => (t.pathPoints as any)?.status === 'UNASSIGNED').length;
  const inProgress   = trips.filter(t => (t.pathPoints as any)?.status === 'IN_PROGRESS').length;
  const completed    = trips.filter(t => (t.pathPoints as any)?.status === 'COMPLETED').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dispatch Centre</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {formatDate(new Date())} · {user?.firstName} {user?.lastName}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Trips today',    value: trips.length,                 icon: <Navigation size={16} className="text-brand-600" />,  bg: 'bg-brand-50',  border: 'border-brand-200' },
          { label: 'Unassigned',     value: unassigned,                   icon: <Bell size={16} className="text-amber-600" />,         bg: 'bg-amber-50',  border: 'border-amber-200' },
          { label: 'In progress',    value: inProgress,                   icon: <Truck size={16} className="text-green-600" />,        bg: 'bg-green-50',  border: 'border-green-200' },
          { label: 'Vehicles total', value: stats?.totals?.vehicles ?? 0, icon: <UserCheck size={16} className="text-purple-600" />,   bg: 'bg-purple-50', border: 'border-purple-200' },
        ].map(({ label, value, icon, bg, border }) => (
          <div key={label} className={`bg-white rounded-xl border ${border} p-4 shadow-sm flex items-center gap-3`}>
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center shrink-0`}>{icon}</div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Today's trips preview */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Navigation size={14} className="text-brand-600" /> Today's Trips
          </h2>
          <Link href="/dispatch" className="text-xs text-brand-600 font-medium flex items-center gap-1">
            Full board <ArrowRight size={12} />
          </Link>
        </div>
        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <CheckCircle2 size={28} className="mb-2 opacity-20" />
            <p className="text-sm">No trips scheduled today</p>
            <Link href="/dispatch" className="mt-3 text-xs text-brand-600 hover:underline">
              Create a trip →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {trips.slice(0, 8).map((t: any) => {
              const meta   = t.pathPoints as any ?? {};
              const status = meta.status ?? 'UNASSIGNED';
              return (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' :
                    status === 'ASSIGNED'    ? 'bg-blue-100 text-blue-700' :
                    status === 'COMPLETED'   ? 'bg-gray-100 text-gray-500' :
                                              'bg-amber-100 text-amber-700'}`}>
                    {status.replace('_', ' ')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {meta.purpose ?? 'Trip'} — {t.vehicle?.licensePlate ?? '—'}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(meta.scheduledAt ?? t.startTime)}</p>
                  </div>
                  {t.driver && (
                    <span className="text-xs text-gray-500 shrink-0">
                      {t.driver.user?.firstName} {t.driver.user?.lastName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: '/dispatch', icon: <Navigation size={18} />, label: 'Dispatch Board' },
          { href: '/map',      icon: <Map size={18} />,        label: 'Live Map' },
          { href: '/drivers',  icon: <UserCheck size={18} />,  label: 'Drivers' },
        ].map(({ href, icon, label }) => (
          <Link key={href} href={href}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-brand-300 hover:shadow-md transition text-center">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">{icon}</div>
            <p className="text-xs font-semibold text-gray-700">{label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
