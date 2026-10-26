'use client';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { ShieldCheck, FileText, AlertTriangle, ArrowRight } from 'lucide-react';

export default function ComplianceDashboard() {
  const { user } = useAuthStore();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
      </div>
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
          <ShieldCheck size={22} className="text-orange-700" />
        </div>
        <div>
          <p className="font-semibold text-orange-900">Compliance Officer Portal</p>
          <p className="text-sm text-orange-700 mt-1">Review documents, track licence and permit expiry, flag non-compliant vehicles, and manage incidents.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/compliance', icon: <FileText size={20} />,      label: 'Document Review', desc: 'Pending verification',  bg: 'bg-orange-50',  text: 'text-orange-600', border: 'border-orange-300' },
          { href: '/compliance', icon: <AlertTriangle size={20} />, label: 'Expiry Calendar',  desc: 'Next 30 days',         bg: 'bg-red-50',     text: 'text-red-600',    border: 'border-red-300' },
          { href: '/alerts',     icon: <ShieldCheck size={20} />,   label: 'Active Alerts',    desc: 'Compliance issues',    bg: 'bg-brand-50',   text: 'text-brand-600',  border: 'border-brand-300' },
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
        <ShieldCheck size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">Open the Compliance module to manage documents and expiry</p>
        <Link href="/compliance" className="mt-4 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition">
          Go to Compliance <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
