'use client';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { Users, FileText, Calendar, ArrowRight, UsersRound } from 'lucide-react';

export default function HRDashboard() {
  const { user } = useAuthStore();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff & HR</h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
      </div>
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
          <UsersRound size={22} className="text-purple-700" />
        </div>
        <div>
          <p className="font-semibold text-purple-900">HR Management</p>
          <p className="text-sm text-purple-700 mt-1">Manage employee records, qualifications, attendance, shifts, and leave requests from the Staff module.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/staff', icon: <Users size={20} />, label: 'Staff Directory', desc: 'View all employees', color: 'brand' },
          { href: '/staff', icon: <FileText size={20} />, label: 'Qualifications', desc: 'Licences & certifications', color: 'amber' },
          { href: '/staff', icon: <Calendar size={20} />, label: 'Leave Requests', desc: 'Pending approvals', color: 'green' },
        ].map(({ href, icon, label, desc, color }) => (
          <Link key={label} href={href}
            className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-3 hover:shadow-md hover:border-${color}-300 transition group`}>
            <div className={`w-11 h-11 bg-${color}-50 rounded-xl flex items-center justify-center text-${color}-600 shrink-0`}>{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition shrink-0" />
          </Link>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <UsersRound size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">Open the Staff module to get started</p>
        <Link href="/staff" className="mt-4 inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition">
          Go to Staff / HR <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
