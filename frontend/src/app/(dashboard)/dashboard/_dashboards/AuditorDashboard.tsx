'use client';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { Eye, FileText, BarChart3, Truck, ArrowRight } from 'lucide-react';

export default function AuditorDashboard() {
  const { user } = useAuthStore();
  return (
    <div className="space-y-5">
      {/* Persistent banner */}
      <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-4 flex items-center gap-3">
        <Eye size={20} className="text-purple-600 shrink-0" />
        <div>
          <p className="font-semibold text-purple-900">Auditor View — Read-only</p>
          <p className="text-xs text-purple-700">All access is logged. You cannot create, edit, or delete anything.</p>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: '/map',       icon: <Truck size={20} />,     label: 'Live Map',     desc: 'Read-only fleet map' },
          { href: '/vehicles',   icon: <FileText size={20} />, label: 'Vehicles',      desc: 'View vehicle records' },
          { href: '/finance',   icon: <BarChart3 size={20} />,label: 'Finance',       desc: 'Read-only financials' },
          { href: '/reports',   icon: <BarChart3 size={20} />,label: 'Reports',       desc: 'View reports only' },
        ].map(({ href, icon, label, desc }) => (
          <Link key={href} href={href}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-3 hover:shadow-md hover:border-purple-200 transition group">
            <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <ArrowRight size={14} className="text-gray-300 group-hover:text-purple-500 transition shrink-0" />
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-3">What you can do</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2"><Eye size={14} className="text-purple-500 mt-0.5 shrink-0" /> View all fleet data (vehicles, drivers, map)</li>
          <li className="flex items-start gap-2"><Eye size={14} className="text-purple-500 mt-0.5 shrink-0" /> View all financial records (read-only)</li>
          <li className="flex items-start gap-2"><Eye size={14} className="text-purple-500 mt-0.5 shrink-0" /> View documents (metadata only — downloads logged)</li>
          <li className="flex items-start gap-2"><Eye size={14} className="text-purple-500 mt-0.5 shrink-0" /> View reports and analytics</li>
        </ul>
        <h2 className="font-semibold text-gray-800 mt-5 mb-3">What you cannot do</h2>
        <ul className="space-y-2 text-sm text-gray-500">
          <li className="flex items-start gap-2">✕ Create, edit, or delete any record</li>
          <li className="flex items-start gap-2">✕ Approve payouts, invoices, or contracts</li>
          <li className="flex items-start gap-2">✕ Send commands to GPS devices</li>
          <li className="flex items-start gap-2">✕ Lock or unlock vehicle engines</li>
        </ul>
      </div>
    </div>
  );
}
