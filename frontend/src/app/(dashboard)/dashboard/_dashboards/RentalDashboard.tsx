'use client';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { CalendarDays, Truck, Users2, ArrowRight } from 'lucide-react';

export default function RentalDashboard() {
  const { user } = useAuthStore();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rental Management</h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
      </div>
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
          <CalendarDays size={22} className="text-teal-700" />
        </div>
        <div>
          <p className="font-semibold text-teal-900">Rental Manager Portal</p>
          <p className="text-sm text-teal-700 mt-1">Manage vehicle availability, reservations, handovers, deposits and damage reports from the Rentals module.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/rentals',    icon: <CalendarDays size={20} />, label: 'Availability',  desc: 'Calendar & schedule', bg: 'bg-teal-50',   text: 'text-teal-600',   border: 'border-teal-300' },
          { href: '/vehicles',   icon: <Truck size={20} />,        label: 'Vehicles',      desc: 'Rental fleet',        bg: 'bg-brand-50',  text: 'text-brand-600',  border: 'border-brand-300' },
          { href: '/customers',  icon: <Users2 size={20} />,       label: 'Customers',     desc: 'Rental customers',    bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-300' },
        ].map(({ href, icon, label, desc, bg, text, border }) => (
          <Link key={label} href={href}
            className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-3 hover:shadow-md hover:${border} transition group`}>
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center ${text} shrink-0`}>{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition shrink-0" />
          </Link>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <CalendarDays size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">Open Rentals to manage the availability calendar</p>
        <Link href="/rentals" className="mt-4 inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition">
          Go to Rentals <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
