'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, financialApi, expenseApi } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, subDays } from 'date-fns';
import { Download, Calendar, BarChart3, Truck, Users, DollarSign,
  MapPin, TrendingUp, AlertTriangle, Fuel } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'summary' | 'fleet' | 'vehicles' | 'drivers' | 'financial';
const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6'];

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'summary',   label: 'Summary',           icon: <BarChart3 size={14} /> },
  { id: 'fleet',     label: 'Fleet Reports',      icon: <MapPin size={14} /> },
  { id: 'vehicles',  label: 'Vehicle Reports',    icon: <Truck size={14} /> },
  { id: 'drivers',   label: 'Driver Reports',     icon: <Users size={14} /> },
  { id: 'financial', label: 'Financial Reports',  icon: <DollarSign size={14} /> },
];

function exportCSV(data: object[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv  = [keys.join(','), ...data.map(r =>
    keys.map(k => JSON.stringify((r as any)[k] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${filename}_${format(new Date(), 'yyyyMMdd')}.csv`;
  a.click();
}

function DateRange({ from, to, setFrom, setTo }: any) {
  return (
    <div className="flex items-center gap-4 flex-wrap bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <Calendar size={16} className="text-gray-400" />
      {[['From', from, setFrom], ['To', to, setTo]].map(([label, val, setter]: any) => (
        <div key={label} className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">{label}</label>
          <input type="date" value={val} onChange={e => setter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
        </div>
      ))}
    </div>
  );
}

function ExportBtn({ data, name }: { data: object[]; name: string }) {
  return (
    <button onClick={() => exportCSV(data, name)}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition">
      <Download size={14} /> Export CSV
    </button>
  );
}

// ─── Summary Tab ─────────────────────────────────────────────────────────────
function SummaryTab({ from, to }: { from: string; to: string }) {
  const { data: fin, isLoading } = useQuery({
    queryKey: ['fin-dash', from, to],
    queryFn: () => financialApi.dashboard({ from, to }),
  });
  const fmt  = (n: number) => n.toLocaleString('en-RW');
  const card = (label: string, value: string, sub: string, color: string) => (
    <div className={cn('bg-white rounded-xl p-4 border shadow-sm', color)}>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{isLoading ? '…' : value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
  const today = fin?.today ?? {}; const month = fin?.month ?? {};
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-700">Today</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {card('Income Today',     `${fmt(today.income??0)} RWF`,   '', 'border-green-200')}
        {card('Expenses Today',   `${fmt(today.expenses??0)} RWF`, '', 'border-red-200')}
        {card('Profit Today',     `${fmt(today.profit??0)} RWF`,   '', (today.profit??0)>=0?'border-blue-200':'border-red-200')}
      </div>
      <h2 className="text-base font-semibold text-gray-700">This Month</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {card('Monthly Income',   `${fmt(month.income??0)} RWF`,   '', 'border-green-200')}
        {card('Monthly Expenses', `${fmt(month.expenses??0)} RWF`, '', 'border-red-200')}
        {card('Monthly Profit',   `${fmt(month.profit??0)} RWF`,   '', (month.profit??0)>=0?'border-blue-200':'border-red-200')}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {card('Outstanding', `${fmt(fin?.outstanding??0)} RWF`, `${fin?.overdueCount??0} overdue`, 'border-yellow-200')}
        {card('Due Today',   `${fin?.dueTodayCount??0} payments`, '', 'border-orange-200')}
        {card('Maintenance', `${fmt(fin?.monthlyStats?.maintenance??0)} RWF`, 'this month', 'border-gray-200')}
        {card('Fuel Cost',   `${fmt(fin?.monthlyStats?.fuel??0)} RWF`, 'this month', 'border-gray-200')}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {card('Insurance Expiring', `${fin?.compliance?.insuranceExpiring??0} vehicles`, 'in 30 days', 'border-red-200')}
        {card('Road Tax Expiring',  `${fin?.compliance?.roadTaxExpiring??0} vehicles`,  'in 30 days', 'border-orange-200')}
        {card('Net Business Value', `${fmt(fin?.netBusinessValue??0)} RWF`, 'vehicle assets', 'border-purple-200')}
      </div>
      {fin?.topCustomers?.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Top Paying Customers (This Month)</h3>
          <div className="space-y-2">
            {fin.topCustomers.map((c: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                <div><p className="text-sm font-medium">{c.customer?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{c.customer?.phone}</p></div>
                <p className="text-sm font-bold text-green-700">{fmt(c._sum?.amount??0)} RWF</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fleet Reports Tab ────────────────────────────────────────────────────────
function FleetTab({ from, to }: { from: string; to: string }) {
  const { data: alertData } = useQuery({
    queryKey: ['report-alerts', from, to],
    queryFn: () => apiClient.get('/reports/alerts-summary', { params: { from, to } }).then(r => r.data),
  });
  const { data: expSummary } = useQuery({
    queryKey: ['exp-summary', from, to],
    queryFn: () => expenseApi.summary({ from, to }),
  });
  const chartData = (alertData?.data ?? []).reduce((acc: any[], row: any) => {
    const label = row.type.replace(/_/g, ' ');
    const existing = acc.find((a: any) => a.type === label);
    if (existing) existing[row.severity] = (existing[row.severity] ?? 0) + row._count;
    else acc.push({ type: label, [row.severity]: row._count });
    return acc;
  }, []);
  const expData = (expSummary?.summary ?? []).map((e: any) => ({
    name: e.category.replace(/_/g, ' '),
    value: e._sum.amount ?? 0,
    count: e._count,
  }));
  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <ExportBtn data={alertData?.data ?? []} name="fleet-alerts" />
        <ExportBtn data={expData} name="fleet-expenses" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Alerts by Type</h3>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="type" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip /><Legend />
                <Bar dataKey="CRITICAL" fill="#ef4444" />
                <Bar dataKey="HIGH"     fill="#f97316" />
                <Bar dataKey="MEDIUM"   fill="#f59e0b" />
                <Bar dataKey="LOW"      fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-gray-400 py-12 text-sm">No alert data</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Fleet Expenses by Category</h3>
          {expData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={expData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                  {expData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} RWF`]} />
                <Legend formatter={(v: string) => v} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-gray-400 py-12 text-sm">No expense data</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Vehicle Reports Tab ──────────────────────────────────────────────────────
function VehiclesTab({ from, to }: { from: string; to: string }) {
  const { data: trips } = useQuery({
    queryKey: ['report-trips', from, to],
    queryFn: () => apiClient.get('/reports/trips', { params: { from, to } }).then(r => r.data),
  });
  const { data: prof } = useQuery({
    queryKey: ['vehicle-profitability', from, to],
    queryFn: () => financialApi.profitability({ from, to }),
  });
  const rows = trips?.data ?? [];
  const profRows = prof?.data ?? [];
  const exportData = profRows.map((r: any) => ({
    Plate: r.vehicle?.licensePlate, Vehicle: r.vehicle?.name, Type: r.vehicle?.vehicleType,
    Income: r.income, Expenses: r.totalExpenses, NetProfit: r.netProfit, Margin: r.profitMargin + '%',
    Maintenance: r.expenses?.MAINTENANCE ?? 0, Fuel: r.expenses?.FUEL ?? 0,
    Insurance: r.expenses?.INSURANCE ?? 0, Fines: r.expenses?.FINE ?? 0,
  }));
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><ExportBtn data={exportData} name="vehicle-profitability" /></div>

      {/* Profitability table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold text-gray-800 text-sm flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-600" /> Vehicle Profitability
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>{['Plate','Vehicle','Type','Income','Expenses','Maintenance','Fuel','Fines','Net Profit','Margin'].map(h =>
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {profRows.map((r: any) => (
              <tr key={r.vehicle?.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono font-bold text-sm">{r.vehicle?.licensePlate}</td>
                <td className="px-3 py-2 text-sm">{r.vehicle?.name}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{r.vehicle?.vehicleType?.replace('_',' ')}</td>
                <td className="px-3 py-2 text-sm text-green-700 font-medium">{r.income.toLocaleString()}</td>
                <td className="px-3 py-2 text-sm text-red-700">{r.totalExpenses.toLocaleString()}</td>
                <td className="px-3 py-2 text-sm text-gray-600">{(r.expenses?.MAINTENANCE??0).toLocaleString()}</td>
                <td className="px-3 py-2 text-sm text-gray-600">{(r.expenses?.FUEL??0).toLocaleString()}</td>
                <td className="px-3 py-2 text-sm text-gray-600">{(r.expenses?.FINE??0).toLocaleString()}</td>
                <td className={cn('px-3 py-2 text-sm font-bold', r.netProfit >= 0 ? 'text-green-700' : 'text-red-700')}>
                  {r.netProfit.toLocaleString()} RWF
                </td>
                <td className="px-3 py-2 text-xs">{r.profitMargin}%</td>
              </tr>
            ))}
            {!profRows.length && <tr><td colSpan={10} className="text-center py-12 text-gray-400 text-sm">No data</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Trip activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold text-gray-800 text-sm">GPS Activity Summary</div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>{['Vehicle ID','Records','Max Speed','Avg Speed','Avg Fuel'].map(h =>
              <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r: any) => (
              <tr key={r.vehicleId} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs font-mono text-gray-700">{r.vehicleId.slice(0,8)}…</td>
                <td className="px-4 py-2 text-sm">{r._count?.id ?? 0}</td>
                <td className="px-4 py-2 text-sm font-bold">{Math.round(r._max?.speed??0)} km/h</td>
                <td className="px-4 py-2 text-sm">{Math.round(r._avg?.speed??0)} km/h</td>
                <td className="px-4 py-2 text-sm">{Math.round(r._avg?.fuelLevel??0)}%</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No GPS data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Driver Reports Tab ───────────────────────────────────────────────────────
function DriversTab({ from, to }: { from: string; to: string }) {
  const year = new Date(from).getFullYear();
  const { data: payments = [] } = useQuery({
    queryKey: ['driver-payments', year],
    queryFn: () => financialApi.driverPayments({ year }),
  });
  const paid    = payments.filter((p: any) => p.status === 'PAID');
  const pending = payments.filter((p: any) => p.status === 'PENDING');
  const overdue = payments.filter((p: any) => p.status === 'OVERDUE');
  const totalPaid = paid.reduce((s: number, p: any) => s + (p.totalAmount ?? 0), 0);
  const exportData = payments.map((p: any) => ({
    Driver: `${p.driver?.user?.firstName} ${p.driver?.user?.lastName}`,
    Vehicle: p.driver?.vehicle?.licensePlate ?? '',
    Month: p.month, Year: p.year,
    Expected: p.expectedAmount, Paid: p.paidAmount,
    Difference: p.difference, Base: p.baseSalary,
    Commission: p.commission, Bonus: p.bonus, Deductions: p.deductions,
    Total: p.totalAmount, Status: p.status, PaidAt: p.paidAt ?? '',
  }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Paid RWF', value: totalPaid.toLocaleString(), color: 'text-green-600' },
          { label: 'Completed',      value: paid.length,    color: 'text-green-600' },
          { label: 'Pending',        value: pending.length, color: 'text-yellow-600' },
          { label: 'Overdue',        value: overdue.length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-end"><ExportBtn data={exportData} name="driver-payments" /></div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>{['Driver','Vehicle','Month/Year','Expected','Paid','Diff','Base','Commission','Bonus','Deductions','Total','Status'].map(h =>
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm font-medium">{p.driver?.user?.firstName} {p.driver?.user?.lastName}</td>
                <td className="px-3 py-2 text-xs font-mono">{p.driver?.vehicle?.licensePlate ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{p.month}/{p.year}</td>
                <td className="px-3 py-2 text-sm">{(p.expectedAmount??0).toLocaleString()}</td>
                <td className="px-3 py-2 text-sm text-green-700">{(p.paidAmount??0).toLocaleString()}</td>
                <td className={cn('px-3 py-2 text-sm font-medium', (p.difference??0)<0?'text-red-600':'text-gray-700')}>
                  {(p.difference??0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-sm">{(p.baseSalary??0).toLocaleString()}</td>
                <td className="px-3 py-2 text-sm">{(p.commission??0).toLocaleString()}</td>
                <td className="px-3 py-2 text-sm text-green-700">+{(p.bonus??0).toLocaleString()}</td>
                <td className="px-3 py-2 text-sm text-red-600">-{(p.deductions??0).toLocaleString()}</td>
                <td className="px-3 py-2 text-sm font-bold">{(p.totalAmount??0).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                    p.status==='PAID'?'bg-green-100 text-green-800':
                    p.status==='PENDING'?'bg-yellow-100 text-yellow-800':
                    p.status==='OVERDUE'?'bg-red-100 text-red-800':'bg-gray-100 text-gray-700')}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {!payments.length && <tr><td colSpan={12} className="text-center py-12 text-gray-400 text-sm">No driver payment records for {year}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Financial Reports Tab ────────────────────────────────────────────────────
function FinancialTab({ from, to }: { from: string; to: string }) {
  const { data: stmt }      = useQuery({ queryKey: ['stmt', from, to],      queryFn: () => financialApi.statement({ from, to }) });
  const { data: cf }        = useQuery({ queryKey: ['cf', from, to],        queryFn: () => financialApi.cashFlow({ from, to }) });
  const { data: profData }  = useQuery({ queryKey: ['prof2', from, to],     queryFn: () => financialApi.profitability({ from, to }) });
  const { data: expSumm }   = useQuery({ queryKey: ['expSumm', from, to],   queryFn: () => expenseApi.summary({ from, to }) });

  const fmt = (n: number) => n.toLocaleString('en-RW');

  // Build monthly chart from cash flow
  const monthlyMap: Record<string, { month: string; income: number; expenses: number }> = {};
  (cf?.income  ?? []).forEach((t: any) => {
    const k = format(new Date(t.paidDate), 'MMM yy');
    if (!monthlyMap[k]) monthlyMap[k] = { month: k, income: 0, expenses: 0 };
    monthlyMap[k].income += t.amount;
  });
  (cf?.expenses ?? []).forEach((t: any) => {
    const k = format(new Date(t.date), 'MMM yy');
    if (!monthlyMap[k]) monthlyMap[k] = { month: k, income: 0, expenses: 0 };
    monthlyMap[k].expenses += t.amount;
  });
  const monthlyChart = Object.values(monthlyMap);

  const expChart = (expSumm?.summary ?? []).map((e: any) => ({
    name: e.category.replace(/_/g, ' '), value: e._sum.amount ?? 0,
  }));

  const exportStmt = [{
    From: from, To: to,
    Revenue:       stmt?.revenue       ?? 0,
    TotalExpenses: stmt?.totalExpenses ?? 0,
    GrossProfit:   stmt?.grossProfit   ?? 0,
    Depreciation:  stmt?.depreciation  ?? 0,
    NetProfit:     stmt?.netProfit     ?? 0,
  }];

  const exportExpenses = expChart.map((e: any) => ({ Category: e.name, Amount: e.value }));

  return (
    <div className="space-y-5">
      {/* P&L statement */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Income Statement</h3>
          <ExportBtn data={exportStmt} name="income-statement" />
        </div>
        <div className="space-y-2 max-w-md">
          {[
            { label: 'Total Revenue',    value: stmt?.revenue       ?? 0, color: 'text-green-700', bold: false },
            { label: 'Total Expenses',   value: stmt?.totalExpenses ?? 0, color: 'text-red-700',   bold: false },
            { label: 'Gross Profit',     value: stmt?.grossProfit   ?? 0, color: (stmt?.grossProfit??0)>=0?'text-green-700':'text-red-700', bold: true },
            { label: 'Depreciation',     value: stmt?.depreciation  ?? 0, color: 'text-gray-600',  bold: false },
            { label: 'Net Profit',       value: stmt?.netProfit     ?? 0, color: (stmt?.netProfit??0)>=0?'text-green-700':'text-red-700', bold: true },
          ].map(r => (
            <div key={r.label} className={cn('flex justify-between py-2 border-b border-gray-100', r.bold && 'border-t-2 border-gray-300 pt-3')}>
              <span className={cn('text-sm', r.bold ? 'font-bold text-gray-900' : 'text-gray-600')}>{r.label}</span>
              <span className={cn('text-sm', r.bold ? 'font-bold' : 'font-medium', r.color)}>{fmt(r.value)} RWF</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expense breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Expenses by Category</h3>
            <ExportBtn data={exportExpenses} name="expenses-by-category" />
          </div>
          {expChart.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={expChart} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value">
                  {expChart.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${fmt(v)} RWF`]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-gray-400 py-10 text-sm">No expense data</p>}
        </div>

        {/* Monthly income vs expenses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Monthly Income vs Expenses</h3>
          {monthlyChart.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyChart} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [`${fmt(v)} RWF`]} />
                <Legend />
                <Bar dataKey="income"   fill="#22c55e" name="Income"   radius={[3,3,0,0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-gray-400 py-10 text-sm">No monthly data</p>}
        </div>
      </div>

      {/* Expense category detail table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold text-gray-800 text-sm">Detailed Expense Breakdown</div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Count</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Total Amount</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">% of Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(expSumm?.summary ?? []).map((e: any) => {
              const pct = stmt?.totalExpenses > 0
                ? ((e._sum.amount / stmt.totalExpenses) * 100).toFixed(1) : '0';
              return (
                <tr key={e.category} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium">{e.category.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{e._count}</td>
                  <td className="px-4 py-2 text-sm font-bold text-red-700">{fmt(e._sum.amount ?? 0)} RWF</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!(expSumm?.summary?.length) && (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No expense records</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab]   = useState<Tab>('summary');
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo]     = useState(format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm">Fleet analytics, driver performance, financial statements</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition',
              tab === t.id ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-gray-700'
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Date range (hide for summary which uses built-in today/month) */}
      {tab !== 'summary' && (
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      )}

      {tab === 'summary'   && <SummaryTab   from={from} to={to} />}
      {tab === 'fleet'     && <FleetTab     from={from} to={to} />}
      {tab === 'vehicles'  && <VehiclesTab  from={from} to={to} />}
      {tab === 'drivers'   && <DriversTab   from={from} to={to} />}
      {tab === 'financial' && <FinancialTab from={from} to={to} />}
    </div>
  );
}
