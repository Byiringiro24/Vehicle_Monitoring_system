'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Users, UserCheck, AlertTriangle, Search, CheckCircle2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:      'bg-green-100 text-green-700',
  ON_LEAVE:    'bg-blue-100 text-blue-700',
  SUSPENDED:   'bg-red-100 text-red-700',
  TERMINATED:  'bg-gray-100 text-gray-500',
  INACTIVE:    'bg-gray-100 text-gray-500',
};

type TabId = 'people' | 'qualifications';

export default function StaffPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<TabId>('people');
  const [search, setSearch] = useState('');

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['staff-drivers'],
    queryFn: () => apiClient.get('/drivers').then(r => r.data ?? []),
    refetchInterval: 60000,
  });

  const filtered = (drivers as any[]).filter((d: any) => {
    const q = search.toLowerCase();
    const name = `${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.toLowerCase();
    return !q || name.includes(q) || d.licenseNumber?.toLowerCase().includes(q) || d.status?.toLowerCase().includes(q);
  });

  // Qualifications tab — drivers with expiring/expired licences
  const now = Date.now();
  const in30 = now + 30 * 86400000;
  const licenceIssues = (drivers as any[]).filter((d: any) => {
    if (!d.licenseExpiry) return false;
    const exp = new Date(d.licenseExpiry).getTime();
    return exp <= in30;
  }).sort((a: any, b: any) => new Date(a.licenseExpiry).getTime() - new Date(b.licenseExpiry).getTime());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff & HR</h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total staff',        value: (drivers as any[]).length,                                         icon: <Users size={15} className="text-brand-600" />,       bg: 'bg-brand-50',  border: 'border-brand-200' },
          { label: 'Active',             value: (drivers as any[]).filter((d: any) => d.status === 'ACTIVE').length, icon: <UserCheck size={15} className="text-green-600" />,   bg: 'bg-green-50',  border: 'border-green-200' },
          { label: 'On leave',           value: (drivers as any[]).filter((d: any) => d.status === 'ON_LEAVE').length,icon: <CheckCircle2 size={15} className="text-blue-600" />, bg: 'bg-blue-50',   border: 'border-blue-200' },
          { label: 'Licence expiring',   value: licenceIssues.length,                                              icon: <AlertTriangle size={15} className="text-amber-600" />,bg: 'bg-amber-50',  border: 'border-amber-200' },
        ].map(({ label, value, icon, bg, border }) => (
          <div key={label} className={`bg-white rounded-xl border ${border} p-4 shadow-xs flex items-center gap-3`}>
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
            <div>
              <p className="text-xl font-bold text-gray-900 tabular">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {([['people', 'People'], ['qualifications', 'Qualifications']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as TabId)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition',
                tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {label}
              {id === 'qualifications' && licenceIssues.length > 0 && (
                <span className="min-w-[18px] h-[18px] bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center px-1 font-bold">
                  {licenceIssues.length}
                </span>
              )}
            </button>
          ))}
        </div>
        {tab === 'people' && (
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff…"
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        )}
      </div>

      {/* People tab */}
      {tab === 'people' && (
        isLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Users size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-600">No staff members found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name','Role','Licence','Status','Phone'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-brand-700">
                            {d.user?.firstName?.[0]}{d.user?.lastName?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{d.user?.firstName} {d.user?.lastName}</p>
                            <p className="text-xs text-gray-400">{d.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.position ?? 'Driver'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <span>{d.licenseNumber ?? '—'}</span>
                        {d.licenseExpiry && (
                          <span className={cn('block text-[10px]', new Date(d.licenseExpiry) < new Date() ? 'text-red-500' : new Date(d.licenseExpiry) < new Date(Date.now() + 30*86400000) ? 'text-amber-500' : 'text-gray-400')}>
                            Exp: {formatDate(d.licenseExpiry)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-600')}>
                          {d.status?.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.user?.phone ?? d.altPhone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Qualifications tab */}
      {tab === 'qualifications' && (
        <div className="space-y-3">
          {licenceIssues.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <CheckCircle2 size={36} className="text-green-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-600">All licences are valid (30+ days)</p>
            </div>
          ) : licenceIssues.map((d: any) => {
            const days = Math.ceil((new Date(d.licenseExpiry).getTime() - Date.now()) / 86400000);
            return (
              <div key={d.id} className={cn('bg-white rounded-xl border shadow-xs p-4 flex items-center gap-3',
                days <= 0 ? 'border-red-200 bg-red-50' : days <= 7 ? 'border-orange-200 bg-orange-50' : 'border-amber-200 bg-amber-50')}>
                <AlertTriangle size={18} className={days <= 0 ? 'text-red-500' : days <= 7 ? 'text-orange-500' : 'text-amber-500'} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{d.user?.firstName} {d.user?.lastName}</p>
                  <p className="text-sm text-gray-600">Licence: {d.licenseNumber} · Class {d.licenseClass}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-sm font-bold', days <= 0 ? 'text-red-600' : days <= 7 ? 'text-orange-600' : 'text-amber-600')}>
                    {days <= 0 ? 'EXPIRED' : `${days} days left`}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(d.licenseExpiry)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
