'use client';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { Hammer, Wrench, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

export default function MechanicDashboard() {
  const { user } = useAuthStore();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workshop</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {formatDate(new Date())} · {user?.firstName} {user?.lastName}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
          <Hammer size={22} className="text-amber-700" />
        </div>
        <div>
          <p className="font-semibold text-amber-900">Workshop Queue</p>
          <p className="text-sm text-amber-700 mt-1">
            Your work orders for today are waiting. Open the workshop to view assigned jobs,
            log hours, update status and request parts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/workshop"
          className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 flex items-center gap-3 hover:shadow-md hover:border-amber-400 transition group">
          <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
            <Wrench size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">My Work Orders</p>
            <p className="text-xs text-gray-400 mt-0.5">View assigned jobs</p>
          </div>
          <ArrowRight size={14} className="text-gray-300 group-hover:text-amber-500 ml-auto transition" />
        </Link>
        <Link href="/maintenance"
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-3 hover:shadow-md hover:border-brand-300 transition group">
          <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={20} className="text-brand-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Maintenance History</p>
            <p className="text-xs text-gray-400 mt-0.5">View past records</p>
          </div>
          <ArrowRight size={14} className="text-gray-300 group-hover:text-brand-500 ml-auto transition" />
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <CheckCircle2 size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">Open the Workshop to see your queue</p>
        <p className="text-sm text-gray-400 mt-1">Work orders assigned to you will appear there.</p>
        <Link href="/workshop"
          className="mt-4 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition">
          Go to Workshop <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
