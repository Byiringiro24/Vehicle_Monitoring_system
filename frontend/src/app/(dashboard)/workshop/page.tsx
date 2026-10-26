'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Hammer, Wrench, Clock, CheckCircle2, Truck, Search } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED:       'bg-blue-100 text-blue-700',
  IN_PROGRESS:     'bg-amber-100 text-amber-700',
  WAITING_PARTS:   'bg-purple-100 text-purple-700',
  COMPLETED:       'bg-green-100 text-green-700',
  CANCELLED:       'bg-gray-100 text-gray-500',
};

export default function WorkshopPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'mine' | 'all'>('mine');

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['maintenance-all'],
    queryFn: () => apiClient.get('/maintenance?limit=100').then(r => r.data?.data ?? r.data ?? []),
    refetchInterval: 30000,
  });

  const filtered = (records as any[]).filter((r: any) => {
    const q = search.toLowerCase();
    return !q || r.maintenanceType?.toLowerCase().includes(q) || r.vehicle?.licensePlate?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workshop</h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['mine', 'all'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition',
                tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {t === 'mine' ? 'My queue' : 'All open'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work orders…"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      {/* Work orders */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle2 size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No work orders found</p>
          <p className="text-gray-400 text-sm mt-1">Maintenance records will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-xs hover:shadow-sm transition p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                    <Wrench size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold',
                        STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600')}>
                        {r.maintenanceType?.replace(/_/g,' ')}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 mt-1">{r.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {r.vehicle && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Truck size={11} /> {r.vehicle.licensePlate} · {r.vehicle.name}
                        </span>
                      )}
                      {r.mileageAtService && (
                        <span className="text-xs text-gray-400">{r.mileageAtService.toLocaleString()} km</span>
                      )}
                      {r.garage && (
                        <span className="text-xs text-gray-400">{r.garage}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-gray-900 tabular">
                    {r.currency} {r.cost?.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5 justify-end">
                    <Clock size={10} />
                    {formatDate(r.date)}
                  </div>
                </div>
              </div>
              {r.notes && (
                <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
