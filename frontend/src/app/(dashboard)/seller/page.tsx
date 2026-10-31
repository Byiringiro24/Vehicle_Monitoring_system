'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronRight, DollarSign, MessageSquare, Plus, ShoppingCart, Truck } from 'lucide-react';

import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

const LISTINGS = [
  { id: 1, plate: 'RAB 110 A', name: 'Toyota Hilux 2022', status: 'Available', price: 'RWF 18,500,000', badge: 'bg-emerald-100 text-emerald-700' },
  { id: 2, plate: 'RAB 233 K', name: 'Isuzu D-Max 2021', status: 'Pending', price: 'RWF 20,000,000', badge: 'bg-amber-100 text-amber-700' },
  { id: 3, plate: 'RAB 412 M', name: 'Mitsubishi Pickup 2020', status: 'Sold', price: 'RWF 16,000,000', badge: 'bg-slate-100 text-slate-600' },
];

const INQUIRIES = [
  { id: 'INV-1042', customer: 'Aline N.', vehicle: 'RAB 110 A', status: 'New', priority: 'High' },
  { id: 'INV-1038', customer: 'Eric M.', vehicle: 'RAB 233 K', status: 'Follow-up', priority: 'Medium' },
  { id: 'INV-1026', customer: 'Diane K.', vehicle: 'RAB 412 M', status: 'Closed', priority: 'Low' },
];

export default function SellerPage() {
  const { data: vehiclesData } = useQuery({
    queryKey: ['seller-vehicles'],
    queryFn: () => apiClient.get('/vehicles?limit=50').then((r) => r.data),
  });

  const vehicles: any[] = vehiclesData?.data ?? vehiclesData ?? [];
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === 'AVAILABLE').length;
  const listings = (vehicles.length ? vehicles : LISTINGS).slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vehicle Sales</h1>
          <p className="mt-1 text-sm text-slate-500">Manage listings, inquiries, and deal flow from one place.</p>
        </div>
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.26)] transition hover:translate-y-[-1px]"
        >
          <Plus size={14} />
          Add listing
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total vehicles', value: vehicles.length || 3, icon: Truck, tone: 'bg-brand-50 text-brand-700' },
          { label: 'Available', value: availableVehicles || 2, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Active deals', value: 7, icon: ShoppingCart, tone: 'bg-violet-50 text-violet-700' },
          { label: 'Revenue', value: 'RWF 42.6M', icon: DollarSign, tone: 'bg-cyan-50 text-cyan-700' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="app-panel p-4">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 tabular">{value}</p>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="app-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Your listings</h2>
          <Link href="/vehicles" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
            Manage all vehicles
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="divide-y divide-slate-200">
          {listings.map((vehicle: any) => (
            <div key={vehicle.id ?? vehicle.plate} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{vehicle.licensePlate ?? vehicle.plate}</p>
                <p className="text-xs text-slate-500">{vehicle.name ?? vehicle.model ?? 'Vehicle listing'}</p>
              </div>

              <div className="flex items-center gap-2 md:w-40">
                <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', vehicle.badge ?? 'bg-emerald-100 text-emerald-700')}>
                  {vehicle.status ?? 'Available'}
                </span>
              </div>

              <div className="md:w-40">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Price</p>
                <p className="text-sm font-semibold text-slate-800 tabular">{vehicle.purchasePrice ? `RWF ${Number(vehicle.purchasePrice).toLocaleString()}` : vehicle.price}</p>
              </div>

              <Link href={vehicle.id ? `/vehicles/${vehicle.id}` : '/vehicles'} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 md:ml-auto">
                View
                <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="app-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent inquiries</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              3 active
            </span>
          </div>

          <div className="space-y-3">
            {INQUIRIES.map((inquiry) => (
              <div key={inquiry.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{inquiry.customer}</p>
                  <p className="text-xs text-slate-500">{inquiry.vehicle} · {inquiry.id}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', inquiry.priority === 'High' ? 'bg-rose-100 text-rose-700' : inquiry.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                    {inquiry.priority}
                  </span>
                  <span className="rounded-full bg-brand-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
                    {inquiry.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Sales summary</h2>
            <MessageSquare size={18} className="text-brand-600" />
          </div>

          <div className="space-y-4">
            {[
              { label: 'Unread leads', value: '12', hint: 'Across all listings' },
              { label: 'Negotiations', value: '4', hint: 'Need follow-up this week' },
              { label: 'Closed wins', value: '18', hint: 'This quarter' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-end justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                  <p className="text-xl font-bold text-slate-900 tabular">{item.value}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
