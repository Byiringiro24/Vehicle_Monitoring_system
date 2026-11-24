'use client';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Printer, Download, Calendar, CheckCircle2, AlertTriangle, Wrench, Car, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
export default function AutoearnDailyReportPage() {
  const { user } = useAuthStore();
  const orgName = (user as any)?.organization?.name ?? 'ARTIC VMS';
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const printRef = useRef<HTMLDivElement>(null);

  // Load today's summary
  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['autoearn-daily', date],
    queryFn:  () => motoApi.todaySummary(),
  });

  // Load all active drivers with today's status
  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['autoearn-drivers', date],
    queryFn:  () => motoApi.listDrivers({ active: 'true' }),
  });

  // Garage expenses for the date
  const { data: garageData } = useQuery({
    queryKey: ['autoearn-garage', date],
    queryFn:  () => motoApi.listGarage({ from: date, to: date }),
  });
  const garage = (garageData as any)?.data ?? garageData ?? [];

  // Fines for the date
  const { data: finesRaw = [] } = useQuery({
    queryKey: ['autoearn-fines', date],
    queryFn:  () => motoApi.listFines({ from: date, to: date }),
  });
  const fines = Array.isArray(finesRaw) ? finesRaw : [];

  const driverList = drivers as any[];

  // Categorise drivers
  const paid      = driverList.filter(d => d.todayStatus === 'PAID' || d.todayStatus === 'PARTIAL');
  const unpaid    = driverList.filter(d => d.todayStatus === 'DEBT' || d.todayStatus === 'NOT_RECORDED');
  const inGarage  = driverList.filter(d => !d.plateNumber); // no bike = in garage or unassigned
  const withDebt  = driverList.filter(d => d.totalDebt > 0);

  // Totals
  const totalCollected = driverList.reduce((s, d) => s + (d.todayPaid ?? 0), 0);
  const totalExpected  = driverList.reduce((s, d) => s + (d.dailyRate ?? 0), 0);
  const totalGarage    = (garage as any[]).reduce((s: number, g: any) => s + (g.amount ?? 0), 0);
  const totalFines     = (fines as any[]).reduce((s: number, f: any) => s + (f.amount ?? 0), 0);
  const net            = totalCollected - totalGarage - totalFines;

  function print() { window.print(); }

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Driver payment status
    const payHeaders = ['No.', 'Driver Name', 'Phone', 'Plate', 'Daily Rate (RWF)', 'Paid (RWF)', 'Via Phone', 'Via Cash', 'Status', 'Total Debt'];
    const payRows = driverList.map((d: any, i: number) => [
      i + 1, `${d.firstName} ${d.lastName}`, d.phone ?? '', d.plateNumber ?? 'No bike',
      d.dailyRate ?? 0, d.todayPaid ?? 0, 0, 0,
      d.todayStatus ?? 'NOT_RECORDED', d.totalDebt ?? 0,
    ]);
    payRows.push(['', 'TOTAL', '', '', totalExpected, totalCollected, '', '', '', withDebt.reduce((s,d)=>s+(d.totalDebt??0),0)]);
    const ws1 = XLSX.utils.aoa_to_sheet([payHeaders, ...payRows]);
    ws1['!cols'] = payHeaders.map((_, i) => ({ wch: [4,22,14,12,16,14,12,12,14,12][i] ?? 14 }));
    XLSX.utils.book_append_sheet(wb, ws1, `Payments ${date}`);

    // Sheet 2 — Garage
    if ((garage as any[]).length) {
      const gHeaders = ['Date', 'Plate', 'Product', 'Category', 'Amount (RWF)', 'Notes'];
      const gRows = (garage as any[]).map((g: any) => [g.date?.slice(0,10), g.plateNumber ?? 'General', g.product, g.category, g.amount, g.notes ?? '']);
      gRows.push(['', '', 'TOTAL', '', totalGarage, '']);
      const ws2 = XLSX.utils.aoa_to_sheet([gHeaders, ...gRows]);
      XLSX.utils.book_append_sheet(wb, ws2, 'Garage Expenses');
    }

    // Sheet 3 — Fines
    if ((fines as any[]).length) {
      const fHeaders = ['Date', 'Plate', 'Driver', 'Reason', 'Amount (RWF)', 'Paid By'];
      const fRows = (fines as any[]).map((f: any) => [
        f.fineDate?.slice(0,10), f.plateNumber,
        f.driver ? `${f.driver.firstName} ${f.driver.lastName}` : '—',
        f.reason, f.amount, f.paidByCompany ? 'Company' : 'Driver',
      ]);
      fRows.push(['', '', '', 'TOTAL', totalFines, '']);
      const ws3 = XLSX.utils.aoa_to_sheet([fHeaders, ...fRows]);
      XLSX.utils.book_append_sheet(wb, ws3, 'Fines');
    }

    XLSX.writeFile(wb, `AUTOEARN-daily-report-${date}.xlsx`);
  }

  const isLoading = sumLoading || driversLoading;

  return (
    <div className="space-y-5">
      {/* Action bar — hidden when printing */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AUTOEARN Daily Report</h1>
          <p className="text-gray-500 text-sm mt-0.5">Daily vehicle payment summary — paid, unpaid, garage, fines</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <Calendar size={14} className="text-gray-400" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="text-sm outline-none text-gray-700" />
          </div>
          <button onClick={exportExcel} disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-50">
            <Download size={14} /> Excel
          </button>
          <button onClick={print} disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-50">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* ── PRINTABLE DOCUMENT ─────────────────────────────────────────────── */}
      <div ref={printRef} id="autoearn-print" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 print:p-0 print:border-0 print:shadow-none">

        {/* Report header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-5 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Car size={28} className="text-brand-600" />
            <div>
              <h1 className="text-xl font-black text-gray-900">{orgName}</h1>
              <p className="text-xs text-gray-500 tracking-wider uppercase">AUTOEARN Daily Fleet Report</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-600 mt-2">
            <span><strong>Date:</strong> {formatDate(date)}</span>
            <span><strong>Generated:</strong> {new Date().toLocaleTimeString()}</span>
            <span><strong>Total drivers:</strong> {driverList.length}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-gray-400">Loading report…</div>
        ) : (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Collected',  value: `RWF ${totalCollected.toLocaleString()}`,  color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
                { label: 'Total Expected',   value: `RWF ${totalExpected.toLocaleString()}`,   color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-200' },
                { label: 'Garage Expenses',  value: `RWF ${totalGarage.toLocaleString()}`,     color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
                { label: 'Net (Collected−Garage−Fines)', value: `RWF ${net.toLocaleString()}`, color: net >= 0 ? 'text-teal-700' : 'text-red-700', bg: net >= 0 ? 'bg-teal-50' : 'bg-red-50', border: net >= 0 ? 'border-teal-200' : 'border-red-200' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className={`${bg} border ${border} rounded-xl p-3`}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-base font-bold tabular mt-0.5 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── Section 1: Payment status per driver ──────────────────── */}
            <div className="mb-6">
              <h2 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2 border-b border-gray-200 pb-1">
                <FileText size={14} className="text-brand-600" />
                Driver Payment Status — {formatDate(date)}
              </h2>
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    {['#','Driver','Phone','Plate','Rate','Paid','Status','Debt'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {driverList.map((d: any, i: number) => (
                    <tr key={d.id} className={cn(
                      d.todayStatus === 'PAID' ? 'bg-green-50/50' :
                      d.todayStatus === 'DEBT' ? 'bg-red-50/50' : ''
                    )}>
                      <td className="px-2 py-1.5 text-gray-500">{i + 1}</td>
                      <td className="px-2 py-1.5 font-medium text-gray-900">{d.firstName} {d.lastName}</td>
                      <td className="px-2 py-1.5 text-gray-600">{d.phone ?? '—'}</td>
                      <td className="px-2 py-1.5 font-mono text-gray-700">{d.plateNumber ?? <span className="text-gray-400 italic">No bike</span>}</td>
                      <td className="px-2 py-1.5 tabular text-gray-600">{(d.dailyRate ?? 0).toLocaleString()}</td>
                      <td className="px-2 py-1.5 tabular font-semibold text-green-700">{(d.todayPaid ?? 0).toLocaleString()}</td>
                      <td className="px-2 py-1.5">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                          d.todayStatus === 'PAID'         ? 'bg-green-100 text-green-700' :
                          d.todayStatus === 'PARTIAL'      ? 'bg-amber-100 text-amber-700' :
                          d.todayStatus === 'DEBT'         ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-500')}>
                          {d.todayStatus === 'NOT_RECORDED' ? 'NOT RECORDED' : d.todayStatus ?? '—'}
                        </span>
                      </td>
                      <td className={cn('px-2 py-1.5 tabular font-medium', d.totalDebt > 0 ? 'text-red-600' : 'text-green-600')}>
                        {d.totalDebt > 0 ? d.totalDebt.toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-gray-100 font-bold text-xs">
                    <td colSpan={4} className="px-2 py-2 text-gray-700">TOTALS</td>
                    <td className="px-2 py-2 tabular text-blue-700">{totalExpected.toLocaleString()}</td>
                    <td className="px-2 py-2 tabular text-green-700">{totalCollected.toLocaleString()}</td>
                    <td className="px-2 py-2 text-gray-500">{paid.length} paid / {unpaid.length} unpaid</td>
                    <td className="px-2 py-2 tabular text-red-700">
                      {withDebt.reduce((s,d)=>s+(d.totalDebt??0),0).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Section 2: Vehicles in garage (not fixed yet) ─────────── */}
            {(garage as any[]).length > 0 && (
              <div className="mb-6">
                <h2 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2 border-b border-gray-200 pb-1">
                  <Wrench size={14} className="text-amber-600" />
                  Garage Expenses — RWF {totalGarage.toLocaleString()}
                </h2>
                <table className="w-full text-xs">
                  <thead className="bg-amber-50">
                    <tr>{['Plate','Product','Category','Amount (RWF)','Notes'].map(h=>(
                      <th key={h} className="px-2 py-1.5 text-left font-semibold text-amber-800">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {(garage as any[]).map((g: any) => (
                      <tr key={g.id}>
                        <td className="px-2 py-1.5 font-mono text-gray-700">{g.plateNumber ?? 'General'}</td>
                        <td className="px-2 py-1.5 text-gray-900">{g.product}</td>
                        <td className="px-2 py-1.5 text-gray-600">{g.category}</td>
                        <td className="px-2 py-1.5 tabular font-semibold text-amber-700">{(g.amount??0).toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-gray-400">{g.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Section 3: Traffic/Police fines ───────────────────────── */}
            {(fines as any[]).length > 0 && (
              <div className="mb-6">
                <h2 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2 border-b border-gray-200 pb-1">
                  <AlertTriangle size={14} className="text-red-600" />
                  Fines — RWF {totalFines.toLocaleString()}
                </h2>
                <table className="w-full text-xs">
                  <thead className="bg-red-50">
                    <tr>{['Plate','Driver','Reason','Amount (RWF)','Paid By'].map(h=>(
                      <th key={h} className="px-2 py-1.5 text-left font-semibold text-red-800">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {(fines as any[]).map((f: any) => (
                      <tr key={f.id}>
                        <td className="px-2 py-1.5 font-mono text-gray-700">{f.plateNumber}</td>
                        <td className="px-2 py-1.5 text-gray-900">{f.driver ? `${f.driver.firstName} ${f.driver.lastName}` : '—'}</td>
                        <td className="px-2 py-1.5 text-gray-600">{f.reason}</td>
                        <td className="px-2 py-1.5 tabular font-semibold text-red-700">{(f.amount??0).toLocaleString()}</td>
                        <td className="px-2 py-1.5">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                            f.paidByCompany ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700')}>
                            {f.paidByCompany ? 'Company' : 'Driver debt'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Section 4: Unpaid drivers summary ─────────────────────── */}
            {unpaid.length > 0 && (
              <div className="mb-6">
                <h2 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2 border-b border-gray-200 pb-1">
                  <AlertTriangle size={14} className="text-orange-600" />
                  Outstanding / Not Paid Today ({unpaid.length} drivers)
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {unpaid.map((d: any) => (
                    <div key={d.id} className="border border-orange-200 bg-orange-50 rounded-lg px-3 py-2">
                      <p className="font-semibold text-xs text-gray-900">{d.firstName} {d.lastName}</p>
                      <p className="text-[10px] text-gray-500">{d.plateNumber ?? 'No bike'} · {d.phone ?? '—'}</p>
                      <p className="text-[10px] font-bold text-red-600 mt-0.5">
                        Debt: RWF {(d.totalDebt ?? 0).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-200 pt-4 mt-4 text-xs text-gray-400 text-center">
              <p>AUTOEARN Daily Report — {orgName} — Generated {new Date().toLocaleString()}</p>
              <p className="mt-1">Fleet Manager signature: __________________ &nbsp;&nbsp;&nbsp; Company Admin signature: __________________</p>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #autoearn-print, #autoearn-print * { visibility: visible; }
          #autoearn-print { position: absolute; left: 0; top: 0; width: 100%; font-size: 11px; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
