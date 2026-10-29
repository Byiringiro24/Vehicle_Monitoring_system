'use client';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Wrench, Calendar, Star, DollarSign, ArrowRight, Plus, CheckCircle2, Settings } from 'lucide-react';

const SAMPLE_SERVICES = [
  { name: 'GPS Device Installation', price: 'RWF 25,000', category: 'Installation', active: true },
  { name: 'Tyre Replacement (per tyre)', price: 'RWF 15,000–45,000', category: 'Maintenance', active: true },
  { name: 'Oil Change & Service', price: 'RWF 12,000', category: 'Maintenance', active: true },
  { name: 'Brake Inspection', price: 'RWF 8,000', category: 'Inspection', active: false },
];

export default function ProviderPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Provider</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Manage your service listings, bookings and profile.
          </p>
        </div>
        <Link href="/support"
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition shadow-sm">
          <Plus size={14} /> Add service
        </Link>
      </div>

      {/* Status banner */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center shrink-0">
          <Wrench size={22} className="text-brand-700" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-brand-900">Service Provider Portal</p>
          <p className="text-sm text-brand-700 mt-1">
            List your services (GPS installation, repairs, maintenance), set your availability
            and receive bookings from ARTIC VMS users. Full booking management is coming soon.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active services',   value: SAMPLE_SERVICES.filter(s => s.active).length, icon: <Wrench size={15} className="text-brand-600" />,    bg: 'bg-brand-50',  border: 'border-brand-200' },
          { label: 'Bookings today',    value: 0,   icon: <Calendar size={15} className="text-green-600" />,   bg: 'bg-green-50',  border: 'border-green-200' },
          { label: 'Rating',            value: '—', icon: <Star size={15} className="text-amber-600" />,       bg: 'bg-amber-50',  border: 'border-amber-200' },
          { label: 'Earnings (month)',  value: 'RWF 0', icon: <DollarSign size={15} className="text-teal-600" />, bg: 'bg-teal-50', border: 'border-teal-200' },
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

      {/* Services list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">My Services</h2>
          <span className="text-xs text-gray-400">Sample data — manage from support</span>
        </div>
        <div className="divide-y divide-gray-100">
          {SAMPLE_SERVICES.map((s, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                <Wrench size={16} className="text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-400">{s.category}</p>
              </div>
              <p className="text-sm text-gray-700 font-medium tabular shrink-0">{s.price}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {s.active ? 'ACTIVE' : 'DRAFT'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Profile / verification */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <Settings size={18} className="text-brand-600" />
          <h2 className="font-semibold text-gray-900">Provider Profile</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-28 shrink-0">Name</span>
              <span className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-28 shrink-0">Email</span>
              <span className="text-gray-700">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-28 shrink-0">Phone</span>
              <span className="text-gray-700">{user?.phone ?? '—'}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-28 shrink-0">Verification</span>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-28 shrink-0">Member since</span>
              <span className="text-gray-700">{formatDate(new Date())}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            To publish services and receive bookings, complete your profile verification.
            Contact support to begin the verification process.
          </p>
          <Link href="/support" className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-medium">
            Contact support to verify <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
