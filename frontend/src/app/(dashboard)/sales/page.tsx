'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, DollarSign, FileText, Plus, Truck, Tag, Users2 } from 'lucide-react';

import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

export default function SalesPage() {
  const { user } = useAuthStore();

  const { data: vehiclesData, isLoading } = useQuery({
    queryKey: ['sales-vehicles'],
    queryFn: () => apiClient.get('/vehicles?limit=50').then((r) => r.data),
  });

  const { data: customersData } = useQuery({
    queryKey: ['sales-customers'],
    queryFn: () => apiClient.get('/contracts/customers?limit=100').then(r => r.data),
  });

  const { data: agreementsData } = useQuery({
    queryKey: ['sales-agreements'],
    queryFn: () => apiClient.get('/agreements?limit=50').then(r => r.data),
  });

  const vehicles: any[]    = vehiclesData?.data ?? vehiclesData ?? [];
  const customers: any[]   = customersData?.data ?? customersData ?? [];
  const agreements: any[]  = agreementsData?.data ?? agreementsData ?? [];

  const forSale      = vehicles.filter(v => ['AVAILABLE','RESERVED'].includes(v.status ?? ''));
  const totalValue   = forSale.reduce((s, v) => s + Number(v.purchasePrice ?? 0), 0);
  const activeAg     = agreements.filter(a => a.status === 'ACTIVE').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Desk</h1>
          <p className="mt-1 text-sm text-slate-500">Vehicle listings and agreements — {user?.firstName ?? 'your team'}.</p>
        </div>
        <Link href="/vehicles"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.26)] transition hover:translate-y-[-1px]">
          <Plus size={14} /> New listing
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Available vehicles', value: forSale.length,       icon: Truck,   tone: 'bg-brand-50 text-brand-700' },
          { label: 'Active agreements', value: activeAg,              icon: FileText, tone: 'bg-violet-50 text-violet-700' },
          { label: 'Customers',         value: customers.length,      icon: Users2,  tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Revenue pipeline',  value: `RWF ${totalValue.toLocaleString()}`, icon: DollarSign, tone: 'bg-cyan-50 text-cyan-700' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
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

      {/* Vehicle listings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Vehicle Listings</h2>
            <p className="mt-0.5 text-xs text-slate-500">Available and reserved vehicles for sale or hire-purchase</p>
          </div>
          <Link href="/vehicles" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
            Manage all <ChevronRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : forSale.length === 0 ? (
          <div className="p-12 text-center">
            <Tag size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-600">No vehicles listed for sale yet</p>
            <p className="text-sm text-gray-400 mt-1">Add a vehicle with status AVAILABLE or RESERVED to list it here.</p>
            <Link href="/vehicles" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
              Go to vehicles <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {forSale.slice(0, 6).map((vehicle: any) => (
              <div key={vehicle.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center hover:bg-gray-50 transition">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0">
                  <Truck size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{vehicle.name}</p>
                  <p className="text-xs text-slate-500">{vehicle.licensePlate} · {vehicle.manufacturer} {vehicle.model} {vehicle.year}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Price</p>
                  <p className="text-sm font-semibold text-slate-800 tabular">
                    {vehicle.purchasePrice ? `RWF ${Number(vehicle.purchasePrice).toLocaleString()}` : '— not set'}
                  </p>
                </div>
                <div>
                  <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                    vehicle.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' :
                    vehicle.status === 'RESERVED'  ? 'bg-amber-100 text-amber-700' :
                                                     'bg-slate-100 text-slate-600')}>
                    {vehicle.status}
                  </span>
                </div>
                <Link href={`/vehicles/${vehicle.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
                  View <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: '/agreements', label: 'Agreements', desc: `${activeAg} active agreements`, icon: FileText, color: 'text-violet-600 bg-violet-50' },
          { href: '/customers',  label: 'Customers',  desc: `${customers.length} registered`,  icon: Users2,  color: 'text-emerald-600 bg-emerald-50' },
          { href: '/vehicles',   label: 'All Vehicles', desc: `${vehicles.length} total in fleet`, icon: Truck, color: 'text-brand-600 bg-brand-50' },
        ].map(({ href, label, desc, icon: Icon, color }) => (
          <Link key={href} href={href}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition flex items-center gap-4">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', color)}>
              <Icon size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}
