'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { CalendarDays, Truck, Users2, Clock, CheckCircle2, ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  ACTIVE:     'bg-green-100 text-green-700',
  DRAFT:      'bg-gray-100 text-gray-600',
  COMPLETED:  'bg-blue-100 text-blue-700',
  DEFAULTED:  'bg-red-100 text-red-700',
  TERMINATED: 'bg-gray-100 text-gray-500',
  PENDING:    'bg-amber-100 text-amber-700',
};

type TabId = 'active' | 'all' | 'calendar';

export default function RentalsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<TabId>('active');
  const [search, setSearch] = useState('');

  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['rentals-contracts'],
    queryFn: () => apiClient.get('/contracts/contracts?limit=100').then(r => r.data),
  });

  const { data: customersData } = useQuery({
    queryKey: ['rentals-customers'],
    queryFn: () => apiClient.get('/contracts/customers?limit=100').then(r => r.data),
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => apiClient.get('/vehicles?limit=100').then(r => r.data),
  });

  const contracts: any[] = contractsData?.data ?? contractsData ?? [];
  const customers: any[] = customersData?.data ?? customersData ?? [];
  const vehicles: any[] = vehiclesData?.data ?? vehiclesData ?? [];

  const rentalTypes = ['RENTAL_DAILY','RENTAL_WEEKLY','RENTAL_MONTHLY','RENTAL_QUARTERLY','RENTAL_YEARLY','LEASE'];
  const rentalContracts = contracts.filter((c: any) => rentalTypes.includes(c.contractType));
  const activeRentals = rentalContracts.filter((c: any) => c.status === 'ACTIVE');
  const totalRevenue = activeRentals.reduce((s: number, c: any) => s + (c.totalPaid ?? 0), 0);

  const displayContracts = tab === 'active' ? activeRentals : rentalContracts;

  const filtered = displayContracts.filter((c: any) => {
    const q = search.toLowerCase();
    return !q || c.vehicle?.licensePlate?.toLowerCase().includes(q) || c.customer?.name?.toLowerCase().includes(q) || c.contractNumber?.toLowerCase().includes(q);
  });

  // Simple calendar data: which vehicles are rented on which days
  const today = new Date();
  const calDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i); return d;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rentals</h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
        </div>
        <Link href="/agreements"
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition shadow-sm">
          + New rental <ArrowRight size={13} />
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active rentals', value: activeRentals.length,          icon: <CalendarDays size={15} className="text-teal-600" />,   bg: 'bg-teal-50',   border: 'border-teal-200' },
          { label: 'Available vehicles', value: vehicles.filter((v: any) => v.status === 'AVAILABLE').length, icon: <Truck size={15} className="text-brand-600" />, bg: 'bg-brand-50', border: 'border-brand-200' },
          { label: 'Customers', value: customers.length,                   icon: <Users2 size={15} className="text-purple-600" />,        bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: 'Revenue (total)',  value: `RWF ${(totalRevenue/1000).toFixed(0)}k`, icon: <CheckCircle2 size={15} className="text-green-600" />, bg: 'bg-green-50', border: 'border-green-200' },
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

      {/* Tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {([['active','Active rentals'],['all','All contracts'],['calendar','Calendar']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as TabId)}
              className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition',
                tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {label}
            </button>
          ))}
        </div>
        {tab !== 'calendar' && (
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by vehicle, customer…"
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        )}
      </div>

      {/* Calendar view */}
      {tab === 'calendar' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Next 14 days — Vehicle availability</p>
          </div>
          <table className="w-full min-w-[700px] text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600 w-32">Vehicle</th>
                {calDays.map(d => (
                  <th key={d.toISOString()} className="px-2 py-2.5 font-semibold text-gray-500 text-center whitespace-nowrap min-w-[52px]">
                    {d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.slice(0, 10).map((v: any) => {
                // Find active contracts for this vehicle
                const vContracts = activeRentals.filter((c: any) => c.vehicleId === v.id);
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                      {v.licensePlate}
                      <span className="block text-gray-400 font-normal">{v.name}</span>
                    </td>
                    {calDays.map(d => {
                      const isBooked = vContracts.some((c: any) => {
                        const start = new Date(c.startDate);
                        const end   = c.endDate ? new Date(c.endDate) : new Date(c.expectedEndDate ?? Date.now() + 9999*86400000);
                        return d >= start && d <= end;
                      });
                      const isMaintenance = v.status === 'MAINTENANCE';
                      return (
                        <td key={d.toISOString()} className="px-1 py-1.5 text-center">
                          <div className={cn('h-6 rounded text-[10px] flex items-center justify-center font-medium',
                            isMaintenance ? 'bg-orange-200 text-orange-700' :
                            isBooked      ? 'bg-teal-200 text-teal-800' :
                                            'bg-green-50 text-green-600')}>
                            {isMaintenance ? 'MNT' : isBooked ? '●' : '○'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-teal-200" /> Rented</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-50 border border-green-200" /> Available</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-200" /> Maintenance</span>
          </div>
        </div>
      )}

      {/* List view */}
      {tab !== 'calendar' && (
        isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <CalendarDays size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-600">{tab === 'active' ? 'No active rentals' : 'No rental contracts found'}</p>
            <Link href="/agreements" className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
              Create a rental agreement <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Contract','Vehicle','Customer','Type','Period','Balance','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((c: any) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{c.contractNumber?.slice(0,10)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.vehicle?.licensePlate ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.customer?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{c.contractType?.replace(/_/g,' ')}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(c.startDate)} → {c.endDate ? formatDate(c.endDate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold tabular text-gray-900">
                        {c.currency} {(c.totalBalance ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CONTRACT_STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600')}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
