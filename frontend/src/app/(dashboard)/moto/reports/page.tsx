'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { BarChart3, Download, Calendar, DollarSign, AlertTriangle, Wrench } from 'lucide-react';

export default function MotoReportsPage() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [driverId, setDriverId] = useState('');
  const [plate, setPlate] = useState('');
  const [from, setFrom] = useState(new Date(new Date().setDate(1)).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: drivers = [] } = useQuery({
    queryKey: ['moto-drivers-list'],
    queryFn: () => motoApi.listDrivers(),
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['moto-report', from, to, driverId, plate],
    queryFn: () => motoApi.reportSummary({
      from, to,
      driverId: driverId || undefined,
      plate: plate || undefined,
    }),
  });

  function exportCSV() {
    if (!report?.byDay) return;
    const headers = ['Date', 'Collected (RWF)', 'Expected (RWF)', 'Debt (RWF)'];
    const rows = report.byDay.map((d: any) => [d.date, d.collected, d.expected, d.debt]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `moto-report-${from}-to-${to}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moto Fleet Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Daily, weekly and monthly reports — by driver, plate number or all</p>
        </div>
        <button onClick={exportCSV} disabled={!report}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition shadow-sm">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(['daily','weekly','monthly'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition capitalize',
                period === p ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {p}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Driver</label>
            <select value={driverId} onChange={e => setDriverId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">All drivers</option>
              {(drivers as any[]).map((d: any) => (
                <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Plate number</label>
            <input value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="Any plate"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 font-mono" />
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i=><div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Collected',    value: report.totals.totalCollected,  icon: <DollarSign size={15} className="text-green-600" />,  bg: 'bg-green-50',  border: 'border-green-200',  textColor: 'text-green-700' },
              { label: 'Expected',      value: report.totals.totalExpected,   icon: <DollarSign size={15} className="text-blue-600" />,   bg: 'bg-blue-50',   border: 'border-blue-200',   textColor: 'text-blue-700' },
              { label: 'Debt (unpaid)', value: report.totals.totalDebt,        icon: <AlertTriangle size={15} className="text-amber-600" />, bg: 'bg-amber-50', border: 'border-amber-200', textColor: 'text-amber-700' },
              { label: 'Fines',         value: report.totals.totalFines,       icon: <AlertTriangle size={15} className="text-red-600" />,   bg: 'bg-red-50',    border: 'border-red-200',    textColor: 'text-red-700' },
            ].map(({ label, value, icon, bg, border, textColor }) => (
              <div key={label} className={`bg-white rounded-xl border ${border} p-4 shadow-xs`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
                <p className={`text-xl font-bold tabular ${textColor}`}>RWF {value?.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Net */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                  <BarChart3 size={18} className="text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Net (collected - garage - fines)</p>
                  <p className="text-xs text-gray-400">{report.totals.paymentCount} payments over {report.totals.daysCovered} days</p>
                </div>
              </div>
              <p className={cn('text-2xl font-bold tabular', report.totals.net >= 0 ? 'text-green-600' : 'text-red-600')}>
                RWF {report.totals.net?.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Daily breakdown */}
          {report.byDay && report.byDay.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Daily Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Date','Collected','Expected','Debt'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.byDay.map((d: any) => (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{formatDate(d.date)}</td>
                        <td className="px-4 py-2 text-sm tabular text-green-600 font-medium">RWF {d.collected?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm tabular text-blue-600">RWF {d.expected?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm tabular text-red-600">RWF {d.debt?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Garage expenses */}
          {report.garage && report.garage.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  <Wrench size={14} className="text-amber-500" /> Garage Expenses (RWF {report.totals.totalGarage?.toLocaleString()})
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {report.garage.slice(0, 20).map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <p className="text-sm text-gray-900">{g.product}</p>
                      <p className="text-xs text-gray-400">{formatDate(g.date)} · {g.plateNumber ?? 'General'}</p>
                    </div>
                    <p className="text-sm tabular font-medium text-amber-600">RWF {g.amount?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <BarChart3 size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No data for this period</p>
        </div>
      )}
    </div>
  );
}
