'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ChevronRight, DollarSign, FileText, MessageSquareText, Plus, ShoppingCart, Sparkles, Truck } from 'lucide-react';

import { apiClient } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const SAMPLE_INQUIRIES = [
  { id: 'INV-1042', customer: 'Aline N.', vehicle: 'Toyota Hiace 2021', note: 'Can I get an installment plan for 24 months?', priority: 'High' },
  { id: 'INV-1038', customer: 'Eric M.', vehicle: 'BYD Atto 3 2024', note: 'Is the price negotiable for cash payment?', priority: 'Medium' },
  { id: 'INV-1026', customer: 'Diane K.', vehicle: 'Mitsubishi Pickup 2020', note: 'Can I schedule a test drive before Friday?', priority: 'Low' },
];

const SAMPLE_ORDERS = [
  { id: 'ORD-2401', customer: 'Aline N.', vehicle: 'Toyota Hiace 2021', status: 'Interested', amount: 'RWF 14,500,000' },
  { id: 'ORD-2402', customer: 'Jean M.', vehicle: 'BYD Atto 3 2024', status: 'Negotiation', amount: 'RWF 28,000,000' },
  { id: 'ORD-2403', customer: 'Grace T.', vehicle: 'Mitsubishi Pickup 2020', status: 'Booked', amount: 'RWF 16,000,000' },
];

export default function SalesPage() {
  const { user } = useAuthStore();

  const { data: vehiclesData, isLoading } = useQuery({
    queryKey: ['sales-vehicles'],
    queryFn: () => apiClient.get('/vehicles?limit=50').then((r) => r.data),
  });

  const vehicles: any[] = vehiclesData?.data ?? vehiclesData ?? [];
  const activeListings = vehicles.filter((vehicle) => ['AVAILABLE', 'RESERVED', 'ACTIVE'].includes(vehicle.status ?? 'AVAILABLE'));
  const revenueValue = vehicles.reduce((sum, vehicle) => sum + Number(vehicle.purchasePrice ?? vehicle.marketValue ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Desk</h1>
          <p className="mt-1 text-sm text-slate-500">Vehicle listings, lead flow, and conversion activity for {user?.firstName ?? 'your team'}.</p>
        </div>

        <Link
          href="/vehicles"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.26)] transition hover:translate-y-[-1px]"
        >
          <Plus size={14} />
          New listing
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active listings', value: activeListings.length || 5, icon: Truck, tone: 'bg-brand-50 text-brand-700' },
          { label: 'New inquiries', value: SAMPLE_INQUIRIES.length, icon: MessageSquareText, tone: 'bg-violet-50 text-violet-700' },
          { label: 'Orders', value: SAMPLE_ORDERS.length, icon: ShoppingCart, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Revenue pipeline', value: `RWF ${Number(revenueValue || 42_600_000).toLocaleString()}`, icon: DollarSign, tone: 'bg-cyan-50 text-cyan-700' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="app-panel p-4">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 tabular">{value}</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="app-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Top listings</h2>
            <p className="mt-1 text-xs text-slate-500">Fresh inventory and lead activity</p>
          </div>
          <Link href="/vehicles" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
            Manage all vehicles
            <ChevronRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {(vehicles.length ? vehicles.slice(0, 4) : [
              { id: 'sample-1', licensePlate: 'RAB 110 A', name: 'Toyota Hiace 2021', purchasePrice: 14500000, status: 'AVAILABLE' },
              { id: 'sample-2', licensePlate: 'RAB 233 K', name: 'BYD Atto 3 2024', purchasePrice: 28000000, status: 'RESERVED' },
              { id: 'sample-3', licensePlate: 'RAB 412 M', name: 'Mitsubishi Pickup 2020', purchasePrice: 16000000, status: 'AVAILABLE' },
            ]).map((vehicle: any) => (
              <div key={vehicle.id ?? vehicle.licensePlate} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Truck size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{vehicle.licensePlate ?? vehicle.name}</p>
                  <p className="text-xs text-slate-500">{vehicle.name ?? vehicle.model ?? 'Vehicle listing'}</p>
                </div>

                <div className="md:w-40">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Price</p>
                  <p className="text-sm font-semibold text-slate-800 tabular">RWF {Number(vehicle.purchasePrice ?? vehicle.marketValue ?? 0).toLocaleString()}</p>
                </div>

                <div className="flex items-center gap-2 md:w-40">
                  <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', vehicle.status === 'ACTIVE' || vehicle.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' : vehicle.status === 'RESERVED' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                    {vehicle.status ?? 'AVAILABLE'}
                  </span>
                </div>

                <Link href={vehicle.id ? `/vehicles/${vehicle.id}` : '/vehicles'} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 md:ml-auto">
                  View
                  <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent inquiries</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              {SAMPLE_INQUIRIES.length} active
            </span>
          </div>

          <div className="space-y-3">
            {SAMPLE_INQUIRIES.map((inquiry) => (
              <div key={inquiry.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{inquiry.customer}</p>
                  <p className="text-xs text-slate-500">{inquiry.vehicle}</p>
                  <p className="mt-1 text-xs text-slate-500">“{inquiry.note}”</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', inquiry.priority === 'High' ? 'bg-rose-100 text-rose-700' : inquiry.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                    {inquiry.priority}
                  </span>
                  <button className="text-xs font-medium text-brand-600 hover:text-brand-700">Reply</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Orders</h2>
            <Sparkles size={18} className="text-brand-600" />
          </div>

          <div className="space-y-3">
            {SAMPLE_ORDERS.map((order) => (
              <div key={order.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{order.customer}</p>
                  <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', order.status === 'Booked' ? 'bg-emerald-100 text-emerald-700' : order.status === 'Negotiation' ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700')}>
                    {order.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{order.vehicle}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{order.id}</span>
                  <span className="text-sm font-bold text-slate-800 tabular">{order.amount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="app-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sales performance</h2>
            <p className="mt-1 text-xs text-slate-500">This month</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
            <CheckCircle2 size={10} />
            On track
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Lead-to-sale rate', value: '28%', hint: 'Up 6% MoM' },
            { label: 'Avg. close time', value: '11 days', hint: 'Faster than target' },
            { label: 'Conversion value', value: 'RWF 9.2M', hint: 'Across active deals' },
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
              <p className="mt-2 text-xl font-bold text-slate-900 tabular">{metric.value}</p>
              <p className="mt-1 text-xs text-slate-500">{metric.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="app-panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Compliance snapshot</h2>
            <p className="mt-1 text-xs text-slate-500">Lead and listing status</p>
          </div>
          <FileText size={18} className="text-brand-600" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Published listings', value: activeListings.length || 5 },
            { label: 'Pending verification', value: 2 },
            { label: 'Price changes this month', value: 4 },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
              <p className="mt-2 text-xl font-bold text-slate-900 tabular">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
