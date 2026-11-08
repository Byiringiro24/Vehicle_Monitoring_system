'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { BarChart3, Download, FileSpreadsheet, DollarSign, AlertTriangle, Wrench } from 'lucide-react';
import * as XLSX from 'xlsx';

type Period = 'daily' | 'weekly' | 'monthly';

// ── helpers ────────────────────────────────────────────────────────────────────
function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.ceil(d.getDate() / 7);
}
function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// Build weekly groups from byDay rows — format exactly like FABU.xlsx
function buildWeeklyRows(byDay: any[]) {
  const byWeek: Record<string, { week: string; days: any[]; collected: number; expected: number; debt: number }> = {};
  byDay.forEach(d => {
    const weekNum = getWeekNumber(d.date);
    const key = `Week ${weekNum}`;
    if (!byWeek[key]) byWeek[key] = { week: key, days: [], collected: 0, expected: 0, debt: 0 };
    byWeek[key].days.push(d);
    byWeek[key].collected += d.collected ?? 0;
    byWeek[key].expected  += d.expected  ?? 0;
    byWeek[key].debt      += d.debt      ?? 0;
  });
  return Object.values(byWeek);
}

// Build monthly groups
function buildMonthlyRows(byDay: any[]) {
  const byMonth: Record<string, { month: string; days: any[]; collected: number; expected: number; debt: number }> = {};
  byDay.forEach(d => {
    const key = getMonthLabel(d.date);
    if (!byMonth[key]) byMonth[key] = { month: key, days: [], collected: 0, expected: 0, debt: 0 };
    byMonth[key].days.push(d);
    byMonth[key].collected += d.collected ?? 0;
    byMonth[key].expected  += d.expected  ?? 0;
    byMonth[key].debt      += d.debt      ?? 0;
  });
  return Object.values(byMonth);
}

export default function MotoReportsPage() {
  const [period, setPeriod] = useState<Period>('daily');
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
    queryFn: () => motoApi.reportSummary({ from, to, driverId: driverId || undefined, plate: plate || undefined }),
  });

  const weeklyRows  = useMemo(() => buildWeeklyRows(report?.byDay  ?? []), [report]);
  const monthlyRows = useMemo(() => buildMonthlyRows(report?.byDay ?? []), [report]);

  // ── CSV export ───────────────────────────────────────────────────────────────
  function exportCSV() {
    if (!report?.byDay) return;
    const headers = ['Date', 'Collected (RWF)', 'Expected (RWF)', 'Debt (RWF)'];
    const rows = report.byDay.map((d: any) => [d.date, d.collected, d.expected, d.debt]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `moto-report-${from}-to-${to}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Excel export (FABU.xlsx layout) ─────────────────────────────────────────
  function exportExcel() {
    if (!report) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Daily breakdown
    const dailyHeaders = ['Date', 'Plate', 'Driver', 'Expected (RWF)', 'Paid (RWF)', 'Debt (RWF)', 'Status'];
    const dailyData = (report.byDay ?? []).map((d: any) => [
      d.date,
      plate || 'All plates',
      driverId ? (drivers as any[]).find((dr: any) => dr.id === driverId)?.firstName + ' ' + (drivers as any[]).find((dr: any) => dr.id === driverId)?.lastName : 'All drivers',
      d.expected ?? 0,
      d.collected ?? 0,
      d.debt ?? 0,
      d.debt > 0 ? 'DEBT' : 'PAID',
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyData]);
    ws1['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Daily Report');

    // Sheet 2 — Weekly summary (like FABU Sheet 1)
    const weeklyHeaders = ['Week', 'Days', 'Total Expected (RWF)', 'Total Collected (RWF)', 'Unpaid (RWF)', 'Unpaid Days'];
    const weeklyData = buildWeeklyRows(report.byDay ?? []).map(w => [
      w.week,
      w.days.length,
      w.expected,
      w.collected,
      w.debt,
      w.days.filter((d: any) => (d.debt ?? 0) > 0).length,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([weeklyHeaders, ...weeklyData]);
    ws2['!cols'] = [{ wch: 10 }, { wch: 6 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Weekly Summary');

    // Sheet 3 — Monthly summary
    const monthlyHeaders = ['Month', 'Days', 'Expected (RWF)', 'Collected (RWF)', 'Debt (RWF)', 'Garage (RWF)', 'Fines (RWF)', 'Net (RWF)'];
    const monthlyData = buildMonthlyRows(report.byDay ?? []).map(m => [
      m.month,
      m.days.length,
      m.expected,
      m.collected,
      m.debt,
      report.totals?.totalGarage ?? 0,
      report.totals?.totalFines  ?? 0,
      m.collected - (report.totals?.totalGarage ?? 0) - (report.totals?.totalFines ?? 0),
    ]);
    const ws3 = XLSX.utils.aoa_to_sheet([monthlyHeaders, ...monthlyData]);
    ws3['!cols'] = [{ wch: 18 }, { wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Monthly Summary');

    // Sheet 4 — Garage expenses
    if ((report.garage ?? []).length) {
      const garageHeaders = ['Date', 'Plate', 'Product', 'Category', 'Amount (RWF)', 'Notes'];
      const garageData = report.garage.map((g: any) => [
        g.date?.slice(0, 10), g.plateNumber ?? 'General', g.product, g.category, g.amount, g.notes ?? '',
      ]);
      const ws4 = XLSX.utils.aoa_to_sheet([garageHeaders, ...garageData]);
      ws4['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Garage Expenses');
    }

    // Sheet 5 — Fines
    if ((report.fines ?? []).length) {
      const finesHeaders = ['Date', 'Plate', 'Reason', 'Amount (RWF)', 'Paid by'];
      const finesData = report.fines.map((f: any) => [
        f.fineDate?.slice(0, 10), f.plateNumber, f.reason, f.amount,
        f.paidByCompany ? 'Company' : 'Driver',
      ]);
      const ws5 = XLSX.utils.aoa_to_sheet([finesHeaders, ...finesData]);
      ws5['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws5, 'Fines');
    }

    XLSX.writeFile(wb, `moto-report-${from}-to-${to}.xlsx`);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moto Fleet Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Daily, weekly and monthly — by driver, plate or all</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={!report}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition shadow-sm disabled:opacity-50">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportExcel} disabled={!report}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition shadow-sm disabled:opacity-50">
            <FileSpreadsheet size={14} /> Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
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
        <div className="grid grid-cols-4 gap-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Collected',     value: report.totals.totalCollected,  color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200',  icon: <DollarSign size={15} className="text-green-600" /> },
              { label: 'Expected',      value: report.totals.totalExpected,   color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-200',   icon: <DollarSign size={15} className="text-blue-600" /> },
              { label: 'Debt (unpaid)', value: report.totals.totalDebt,        color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <AlertTriangle size={15} className="text-amber-600" /> },
              { label: 'Fines',         value: report.totals.totalFines,       color: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200',   icon: <AlertTriangle size={15} className="text-red-600" /> },
            ].map(({ label, value, color, bg, border, icon }) => (
              <div key={label} className={`bg-white rounded-xl border ${border} p-4 shadow-xs`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
                <p className={`text-xl font-bold tabular ${color}`}>RWF {(value ?? 0).toLocaleString()}</p>
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
                  <p className="text-sm font-semibold text-gray-900">Net (collected − garage − fines)</p>
                  <p className="text-xs text-gray-400">{report.totals.paymentCount} payments over {report.totals.daysCovered} days</p>
                </div>
              </div>
              <p className={cn('text-2xl font-bold tabular', report.totals.net >= 0 ? 'text-green-600' : 'text-red-600')}>
                RWF {report.totals.net?.toLocaleString()}
              </p>
            </div>
          </div>

          {/* ── DAILY VIEW ──────────────────────────────────────────────────── */}
          {period === 'daily' && report.byDay && report.byDay.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Daily Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Date', 'Collected', 'Expected', 'Debt'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.byDay.map((d: any) => (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{formatDate(d.date)}</td>
                        <td className="px-4 py-2 text-sm tabular text-green-600 font-medium">RWF {(d.collected ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm tabular text-blue-600">RWF {(d.expected ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm tabular">
                          <span className={d.debt > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                            RWF {(d.debt ?? 0).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── WEEKLY VIEW (FABU format) ────────────────────────────────── */}
          {period === 'weekly' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Weekly Breakdown (FABU layout)</h2>
              </div>
              {weeklyRows.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">No data for selected period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {['Week', 'Days', 'Expected (RWF)', 'Collected (RWF)', 'Unpaid (RWF)', 'Unpaid Days', ''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {weeklyRows.map(w => (
                        <>
                          {/* Week summary row */}
                          <tr key={w.week} className="bg-gray-50 font-semibold hover:bg-gray-100">
                            <td className="px-4 py-2.5 text-sm text-gray-900">{w.week}</td>
                            <td className="px-4 py-2.5 text-sm text-gray-600">{w.days.length}</td>
                            <td className="px-4 py-2.5 text-sm tabular text-blue-700">{w.expected.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-sm tabular text-green-700">{w.collected.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-sm tabular text-red-700">{w.debt.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-sm tabular text-amber-700">
                              {w.days.filter((d: any) => (d.debt ?? 0) > 0).length}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                                w.debt === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                {w.debt === 0 ? 'Full' : `Debt`}
                              </span>
                            </td>
                          </tr>
                          {/* Expanded daily rows inside each week */}
                          {w.days.map((d: any) => (
                            <tr key={d.date} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-xs text-gray-400 pl-8">↳ {formatDate(d.date)}</td>
                              <td className="px-4 py-2 text-xs text-gray-400">1</td>
                              <td className="px-4 py-2 text-xs tabular text-blue-500">{(d.expected ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-2 text-xs tabular text-green-500">{(d.collected ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-2 text-xs tabular text-red-500">{(d.debt ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-2 text-xs text-gray-400">
                                {(d.debt ?? 0) > 0 ? '1 day' : '—'}
                              </td>
                              <td className="px-4 py-2" />
                            </tr>
                          ))}
                        </>
                      ))}
                      {/* Totals row */}
                      <tr className="bg-brand-50 border-t-2 border-brand-200 font-bold">
                        <td className="px-4 py-3 text-sm text-brand-900">TOTAL</td>
                        <td className="px-4 py-3 text-sm text-brand-700">{report.byDay.length}</td>
                        <td className="px-4 py-3 text-sm tabular text-blue-800">{report.totals.totalExpected.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm tabular text-green-800">{report.totals.totalCollected.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm tabular text-red-800">{report.totals.totalDebt.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm tabular text-amber-800">
                          {report.byDay.filter((d: any) => (d.debt ?? 0) > 0).length}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── MONTHLY VIEW ─────────────────────────────────────────────── */}
          {period === 'monthly' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Monthly Breakdown</h2>
              </div>
              {monthlyRows.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">No data for selected period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {['Month', 'Days', 'Expected', 'Collected', 'Debt', 'Garage', 'Fines', 'Net'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthlyRows.map(m => {
                        const garageShare = report.totals?.totalGarage ?? 0;
                        const finesShare  = report.totals?.totalFines  ?? 0;
                        const net = m.collected - garageShare - finesShare;
                        return (
                          <tr key={m.month} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{m.month}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{m.days.length}</td>
                            <td className="px-4 py-3 text-sm tabular text-blue-600">{m.expected.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm tabular text-green-600 font-medium">{m.collected.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm tabular text-red-600">{m.debt.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm tabular text-amber-600">{garageShare.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm tabular text-orange-600">{finesShare.toLocaleString()}</td>
                            <td className={cn('px-4 py-3 text-sm tabular font-bold', net >= 0 ? 'text-teal-600' : 'text-red-600')}>
                              {net.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Garage expenses (all views) */}
          {(report.garage ?? []).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  <Wrench size={14} className="text-amber-500" />
                  Garage Expenses — RWF {report.totals.totalGarage?.toLocaleString()}
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {report.garage.slice(0, 20).map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <p className="text-sm text-gray-900">{g.product}</p>
                      <p className="text-xs text-gray-400">{g.date?.slice(0, 10)} · {g.plateNumber ?? 'General'}</p>
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
          <p className="text-sm text-gray-400 mt-1">Select a date range and click refresh</p>
        </div>
      )}
    </div>
  );
}
