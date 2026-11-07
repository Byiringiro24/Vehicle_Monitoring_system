'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { FileText, Printer, DollarSign, AlertTriangle, Bike } from 'lucide-react';

export default function MotoDailyReportPage() {
  const { user } = useAuthStore();
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: todaySummary, isLoading } = useQuery({
    queryKey: ['moto-today-summary', reportDate],
    queryFn: () => motoApi.todaySummary(),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['moto-drivers-report'],
    queryFn: () => motoApi.listDrivers({ active: 'true' }),
  });

  const payments: any[] = todaySummary?.payments ?? [];
  const notPaid = (drivers as any[]).filter((d: any) => !payments.find((p: any) => p.driverId === d.id));
  const partial = payments.filter((p: any) => p.status === 'DEBT' || p.status === 'PARTIAL');
  const paid = payments.filter((p: any) => p.status === 'PAID');

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Report</h1>
          <p className="text-gray-500 text-sm mt-0.5">AUTOEARN daily report — digital version</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Print document */}
      <div id="report-print" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 print:border-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h2 className="font-black text-xl text-gray-900">ARTIC<span className="text-brand-600">.</span>VMS</h2>
            <p className="text-xs text-gray-400 uppercase tracking-widest">AUTOEARN Daily Report</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">{formatDate(new Date(reportDate))}</p>
            <p className="text-xs text-gray-400">{user?.organization?.name ?? ''}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 py-4">
          {[
            { label: 'Collected',  value: `RWF ${(todaySummary?.totalCollected ?? 0).toLocaleString()}`,  color: 'text-green-600' },
            { label: 'Expected',   value: `RWF ${(todaySummary?.totalExpected ?? 0).toLocaleString()}`,   color: 'text-blue-600' },
            { label: 'Outstanding',value: `RWF ${(todaySummary?.totalDebt ?? 0).toLocaleString()}`,       color: 'text-amber-600' },
            { label: 'Active',     value: todaySummary?.activeDrivers ?? 0,                                color: 'text-gray-900' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
              <p className={`text-lg font-bold tabular ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Section 1: Still Not Paid This Week */}
        <div className="mt-6">
          <h3 className="font-semibold text-gray-800 text-sm border-b border-gray-200 pb-2 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" /> Still Not Paid (This Week)
          </h3>
          {notPaid.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">All active drivers have been recorded today.</p>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {['#','Driver','Phone','Plate','Daily Rate','Debt'].map(h => <th key={h} className="text-left text-xs text-gray-400 py-1">{h}</th>)}
              </tr></thead>
              <tbody>
                {notPaid.map((d: any, i: number) => (
                  <tr key={d.id} className="border-b border-gray-50">
                    <td className="text-xs text-gray-400 py-1.5">{i+1}</td>
                    <td className="text-sm text-gray-900 py-1.5">{d.firstName} {d.lastName}</td>
                    <td className="text-xs text-gray-500 py-1.5">{d.phone}</td>
                    <td className="text-xs font-mono py-1.5">{d.plateNumber ?? '—'}</td>
                    <td className="text-xs tabular py-1.5">{d.dailyRate?.toLocaleString()}</td>
                    <td className="text-xs tabular py-1.5 text-red-600 font-medium">{d.totalDebt?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Section 2: Unpaid For Today (partial or debt) */}
        <div className="mt-6">
          <h3 className="font-semibold text-gray-800 text-sm border-b border-gray-200 pb-2 mb-3 flex items-center gap-2">
            <DollarSign size={14} className="text-red-500" /> Unpaid For Today (Partial / Debt)
          </h3>
          {partial.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No partial or debt payments today.</p>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {['#','Driver','Plate','Expected','Paid','Shortfall','Status'].map(h => <th key={h} className="text-left text-xs text-gray-400 py-1">{h}</th>)}
              </tr></thead>
              <tbody>
                {partial.map((p: any, i: number) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="text-xs text-gray-400 py-1.5">{i+1}</td>
                    <td className="text-sm text-gray-900 py-1.5">{p.driver?.firstName} {p.driver?.lastName}</td>
                    <td className="text-xs font-mono py-1.5">{p.plateNumber}</td>
                    <td className="text-xs tabular py-1.5">{p.expectedAmount?.toLocaleString()}</td>
                    <td className="text-xs tabular py-1.5 text-green-600">{p.paidAmount?.toLocaleString()}</td>
                    <td className="text-xs tabular py-1.5 text-red-600 font-medium">{(p.expectedAmount - p.paidAmount).toLocaleString()}</td>
                    <td className="text-xs py-1.5"><span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium',
                      p.status === 'DEBT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Section 3: Paid Today */}
        <div className="mt-6">
          <h3 className="font-semibold text-gray-800 text-sm border-b border-gray-200 pb-2 mb-3 flex items-center gap-2">
            <Bike size={14} className="text-green-500" /> Paid Today ({paid.length})
          </h3>
          {paid.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No drivers have paid the full amount today.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {paid.map((p: any) => (
                <div key={p.id} className="border border-gray-100 rounded-lg p-2">
                  <p className="text-xs font-medium text-gray-900">{p.driver?.firstName} {p.driver?.lastName}</p>
                  <p className="text-[10px] text-gray-400">{p.plateNumber} · RWF {p.paidAmount?.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">Generated by ARTIC VMS · {formatDate(new Date())}</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #report-print, #report-print * { visibility: visible; }
          #report-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
