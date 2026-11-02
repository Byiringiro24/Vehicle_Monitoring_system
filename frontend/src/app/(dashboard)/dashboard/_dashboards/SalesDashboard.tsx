'use client';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { ShoppingCart, Truck, ArrowRight, DollarSign } from 'lucide-react';

export default function SalesDashboard() {
  const { user } = useAuthStore();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/sales',     icon: <ShoppingCart size={20} />, label: 'My Listings',   desc: 'Manage vehicle sales',   bg: 'bg-brand-50',   text: 'text-brand-600' },
          { href: '/customers',  icon: <Truck size={20} />,        label: 'Customers',      desc: 'View inquiries',          bg: 'bg-purple-50',  text: 'text-purple-600' },
          { href: '/agreements',icon: <DollarSign size={20} />,   label: 'Orders',          desc: 'Installment plans',      bg: 'bg-teal-50',    text: 'text-teal-600' },
        ].map(({ href, icon, label, desc, bg, text }) => (
          <Link key={href} href={href}
            className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-3 hover:shadow-md hover:border-brand-300 transition group`}>
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center ${text} shrink-0`}>{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <ArrowRight size={14} className="text-gray-300 group-hover:text-brand-500 transition shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
