'use client';
import { useQuery } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useParams, useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  ArrowLeft, Bike, User, Phone, MapPin, FileText, DollarSign,
  AlertTriangle, Wrench, Calendar, CheckCircle2, XCircle,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PAID:    'bg-green-100 text-green-700',
  DEBT:    'bg-red-100 text-red-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-gray-100 text-gray-500',
};

export default function MotoDriverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const driverId = params.id as string;

  const { data: driver, isLoading } = useQuery({
    queryKey: ['moto-driver', driverId],
    queryFn: () => motoApi.getDriver(driverId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-10">
        <p className="font-semibold text-gray-600">Driver not found</p>
        <Link href="/moto" className="text-sm text-brand-600 hover:underline mt-2 inline-block">Back to list</Link>
      </div>
    );
  }

  const d: any = driver;
  const payments: any[] = d.payments ?? [];
  const fines: any[] = d.fines ?? [];
  const summary = d.summary ?? {};

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/moto" className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500 shrink-0">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{d.firstName} {d.lastName}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {d.plateNumber && (
              <span className="text-xs font-mono font-bold bg-gray-100 px-2 py-0.5 rounded">{d.plateNumber}</span>
            )}
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
              d.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
              {d.status}
            </span>
            <Link href={`/moto/contract/${d.id}`}
              className="text-xs text-brand-600 hover:underline font-medium">View contract →</Link>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total paid',    value: `RWF ${summary.totalPaid?.toLocaleString() ?? 0}`,     color: 'text-green-600' },
          { label: 'Expected',      value: `RWF ${summary.totalExpected?.toLocaleString() ?? 0}`, color: 'text-blue-600' },
          { label: 'Current debt',   value: `RWF ${d.totalDebt?.toLocaleString() ?? 0}`,          color: d.totalDebt > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Total fines',   value: `RWF ${summary.totalFines?.toLocaleString() ?? 0}`,   color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-xs p-4">
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className={`text-lg font-bold tabular ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
          <User size={14} className="text-brand-600" /> Personal Information
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Phone',          value: d.phone, icon: <Phone size={12} /> },
            { label: 'Alt phone',      value: d.altPhone ?? '—', icon: <Phone size={12} /> },
            { label: 'National ID',    value: d.nationalId ?? '—', icon: <FileText size={12} /> },
            { label: 'License number',  value: d.licenseNumber ?? '—', icon: <FileText size={12} /> },
            { label: 'License class',   value: d.licenseClass ?? '—', icon: <FileText size={12} /> },
            { label: 'Address',        value: d.address ?? '—', icon: <MapPin size={12} /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="flex items-center gap-2 py-2 border-b border-gray-50">
              <span className="text-gray-400">{icon}</span>
              <span className="text-gray-500 w-24">{label}:</span>
              <span className="font-medium text-gray-900">{value}</span>
            </div>
          ))}
        </div>

        {/* Referrals */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Referrals (Contract witnesses)</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-900">{d.referral1Name ?? '—'}</p>
              <p className="text-xs text-gray-400">{d.referral1Phone ?? ''}</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">{d.referral2Name ?? '—'}</p>
              <p className="text-xs text-gray-400">{d.referral2Phone ?? ''}</p>
            </div>
          </div>
        </div>

        {/* Bike assignment */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bike Assignment</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
              <Bike size={18} className="text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{d.plateNumber ?? 'No bike assigned'}</p>
              <p className="text-xs text-gray-400">
                {d.bikeModel ?? '—'} · Assigned: {d.bikeAssignedAt ? formatDate(d.bikeAssignedAt) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Payment config */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Configuration</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Daily rate</p><p className="font-medium">RWF {d.dailyRate?.toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-400">Weekly rate</p><p className="font-medium">RWF {d.weeklyRate?.toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-400">Type</p><p className="font-medium">{d.paymentType}</p></div>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <DollarSign size={14} className="text-green-600" /> Payment History ({payments.length})
          </h2>
          <Link href="/moto/payments" className="text-xs text-brand-600 hover:underline">Record payment →</Link>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No payments recorded yet</div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>{['Date','Expected','Paid','Status','Debt After'].map(h =>
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-600">{formatDate(p.date)}</td>
                    <td className="px-3 py-2 text-xs tabular text-gray-600">{p.expectedAmount?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs tabular font-medium text-green-600">{p.paidAmount?.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-500')}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs tabular">
                      <span className={p.debtAfter > 0 ? 'text-red-600' : 'text-green-600'}>
                        {p.debtAfter?.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fines */}
      {fines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" /> Fines ({fines.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {fines.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{f.reason}</p>
                  <p className="text-xs text-gray-400">{formatDate(f.fineDate)} · {f.plateNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-600 tabular">RWF {f.amount?.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">
                    {f.recovered ? '✓ Recovered' : f.paidByCompany ? 'Company paid' : 'Driver owes'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
