'use client';

import Link from 'next/link';
import { CalendarCheck2, CheckCircle2, ChevronRight, CircleDollarSign, Plus, Settings, Star, Wrench } from 'lucide-react';

import { useAuthStore } from '@/store/authStore';
import { cn, formatDate } from '@/lib/utils';

const SAMPLE_SERVICES = [
  { name: 'GPS Device Installation', price: 'RWF 25,000', category: 'Installation', active: true },
  { name: 'Tyre Replacement (per tyre)', price: 'RWF 15,000–45,000', category: 'Maintenance', active: true },
  { name: 'Oil Change & Service', price: 'RWF 12,000', category: 'Maintenance', active: true },
  { name: 'Brake Inspection', price: 'RWF 8,000', category: 'Inspection', active: false },
];

const BOOKINGS = [
  { customer: 'Aline N.', service: 'GPS installation', date: 'Today, 3:00 PM', status: 'Confirmed' },
  { customer: 'Eric M.', service: 'Tyre replacement', date: 'Tomorrow, 10:30 AM', status: 'Pending' },
  { customer: 'Diane K.', service: 'Brake inspection', date: 'Thu, 2:00 PM', status: 'Ready' },
];

export default function ProviderPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Service Provider</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your service listings, bookings, and provider profile.</p>
        </div>
        <Link
          href="/support"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.26)] transition hover:translate-y-[-1px]"
        >
          <Plus size={14} />
          Add service
        </Link>
      </div>

      <div className="app-panel p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <Wrench size={22} />
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-slate-900">Service provider portal</p>
            <p className="mt-1 text-sm text-slate-600">
              Keep your service catalog live, track bookings, and complete verification so ARTIC VMS users can request your work.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active services', value: SAMPLE_SERVICES.filter((service) => service.active).length, icon: Wrench, tone: 'bg-brand-50 text-brand-700' },
          { label: 'Bookings today', value: 5, icon: CalendarCheck2, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Rating', value: '4.8/5', icon: Star, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Earnings', value: 'RWF 2.3M', icon: CircleDollarSign, tone: 'bg-cyan-50 text-cyan-700' },
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
          <h2 className="text-lg font-semibold text-slate-900">My services</h2>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            4 listed
          </span>
        </div>

        <div className="divide-y divide-slate-200">
          {SAMPLE_SERVICES.map((service) => (
            <div key={service.name} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Wrench size={17} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                <p className="text-xs text-slate-500">{service.category}</p>
              </div>

              <div className="md:w-36">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Price</p>
                <p className="text-sm font-semibold text-slate-800 tabular">{service.price}</p>
              </div>

              <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', service.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                {service.active ? 'Active' : 'Draft'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="app-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Upcoming bookings</h2>
            <span className="rounded-full bg-brand-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
              3 scheduled
            </span>
          </div>

          <div className="space-y-3">
            {BOOKINGS.map((booking) => (
              <div key={`${booking.customer}-${booking.date}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{booking.customer}</p>
                  <p className="text-xs text-slate-500">{booking.service}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{booking.date}</p>
                </div>

                <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', booking.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-700' : booking.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700')}>
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Settings size={18} className="text-brand-600" />
            <h2 className="text-lg font-semibold text-slate-900">Provider profile</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <span className="text-slate-500">Name</span>
              <span className="font-semibold text-slate-900">{user?.firstName} {user?.lastName}</span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-700">{user?.email}</span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <span className="text-slate-500">Verification</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                <CheckCircle2 size={10} />
                Pending
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <span className="text-slate-500">Member since</span>
              <span className="font-medium text-slate-700">{formatDate(new Date())}</span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 p-3">
            <p className="text-xs text-slate-600">
              Finish verification to publish your services and receive requests from users on the platform.
            </p>
            <Link href="/support" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
              Contact support
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
