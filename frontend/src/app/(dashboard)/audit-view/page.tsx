'use client';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Eye, Truck, DollarSign, FileText, BarChart3, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function AuditViewPage() {
  const { user } = useAuthStore();

  // Read-only data — auditor can view everything but not modify
  const { data: vehicles } = useQuery({
    queryKey: ['audit-vehicles'],
    queryFn: () => apiClient.get('/vehicles?limit=50').then(r => r.data?.data ?? r.data ?? []),
  });
  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: () => apiClient.get('/dashboard/stats').then(r => r.data),
  });

  return (
    <div className="space-y-5">
      {/* Persistent banner */}
      <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-4 flex items-center gap-3">
        <Eye size={20} className="text-purple-600 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-purple-900">Auditor View — Read-only. All access is logged.</p>
          <p className="text-xs text-purple-700">Granted to: {user?.firstName} {user?.lastName} · Every page view is recorded.</p>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Overview</h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())}</p>
      </div>

      {/* KPIs — read-only */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total vehicles', value: stats.totals?.vehicles ?? (vehicles as any[])?.length ?? 0, icon: <Truck size={16} className="text-brand-600" />, bg: 'bg-brand-50', border: 'border-brand-200' },
            { label: 'Total drivers',  value: stats.totals?.drivers ?? 0, icon: <FileText size={16} className="text-purple-600" />, bg: 'bg-purple-50', border: 'border-purple-200' },
            { label: 'Active alerts',  value: stats.totals?.activeAlerts ?? 0, icon: <AlertTriangle size={16} className="text-amber-600" />, bg: 'bg-amber-50', border: 'border-amber-200' },
            { label: 'Revenue (month)', value: `RWF ${((stats.financial?.monthlyIncome ?? 0)/1000).toFixed(0)}k`, icon: <DollarSign size={16} className="text-teal-600" />, bg: 'bg-teal-50', border: 'border-teal-200' },
          ].map(({ label, value, icon, bg, border }) => (
            <div key={label} className={`bg-white rounded-xl border ${border} p-4 shadow-xs flex items-center gap-3`}>
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
              <div>
                <p className="text-lg font-bold text-gray-900 tabular">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick links — all read-only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: '/map',      icon: <Truck size={18} />,     label: 'Live Map',     desc: 'Fleet positions' },
          { href: '/vehicles',  icon: <FileText size={18} />, label: 'Vehicles',      desc: 'All vehicle records' },
          { href: '/finance',  icon: <DollarSign size={18} />,label: 'Finance',      desc: 'Financial records' },
          { href: '/reports',  icon: <BarChart3 size={18} />, label: 'Reports',      desc: 'Analytics & exports' },
        ].map(({ href, icon, label, desc }) => (
          <Link key={href} href={href}
            className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 flex flex-col items-center gap-2 hover:border-purple-200 transition text-center">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">{icon}</div>
            <p className="text-xs font-semibold text-gray-700">{label}</p>
            <p className="text-[10px] text-gray-400">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Vehicle table — read-only */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <Eye size={14} className="text-purple-500" /> Vehicle Records (Read-only)
          </h2>
          <span className="text-xs text-gray-400">{(vehicles as any[])?.length ?? 0} vehicles</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-gray-50 border-b">
              <tr>{['Plate','Name','Status','Year'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {((vehicles as any[]) ?? []).slice(0, 15).map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm font-mono font-bold text-gray-900">{v.licensePlate}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{v.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      v.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      v.status === 'IDLE'   ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-gray-100 text-gray-500')}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600 tabular">{v.year}</td>
                </tr>
              ))}
              {(!vehicles || (vehicles as any[]).length === 0) && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No vehicles found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
