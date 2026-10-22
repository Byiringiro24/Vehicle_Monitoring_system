/**
 * FINANCE_MANAGER dashboard
 * Visual identity: emerald/green palette — money focus.
 * Shows P&L, outstanding payments, agreements overview, top customers.
 * No GPS map — not relevant to this role.
 */
'use client';
import { useQuery } from '@tanstack/react-query';
import { financialApi, agreementApi } from '@/lib/api';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Clock,
  FileText, Users, CreditCard, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function FinanceDashboard() {
  const { data: fin, isLoading } = useQuery({ queryKey: ['fin-dash-main'], queryFn: () => financialApi.dashboard(), refetchInterval: 60_000 });
  const { data: agData } = useQuery({ queryKey: ['agreements', 'ACTIVE'], queryFn: () => agreementApi.list({ status: 'ACTIVE', limit: 5 }) });

  const t = fin?.today ?? {};
  const m = fin?.month ?? {};
  const fmt = (n: number) => `${(n ?? 0).toLocaleString()} RWF`;
  const agreements = agData?.data ?? [];

  const chartData = [
    { name: 'Income',      value: m.income   ?? 0, fill: '#10b981' },
    { name: 'Expenses',    value: m.expenses ?? 0, fill: '#ef4444' },
    { name: 'Maintenance', value: fin?.monthlyStats?.maintenance ?? 0, fill: '#f97316' },
    { name: 'Fuel',        value: fin?.monthlyStats?.fuel        ?? 0, fill: '#3b82f6' },
  ];

  if (isLoading) return <div className="animate-pulse space-y-5">{[...Array(3)].map((_,i) => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5">
      {/* Header — green tint */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 rounded-2xl p-5 text-white">
        <h1 className="text-2xl font-bold">Finance Centre</h1>
        <p className="text-emerald-200 text-sm mt-0.5">{formatDate(new Date())} · Financial overview</p>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div><p className="text-emerald-300 text-xs">Today Income</p><p className="text-xl font-bold">{fmt(t.income)}</p></div>
          <div><p className="text-emerald-300 text-xs">Today Expenses</p><p className="text-xl font-bold">{fmt(t.expenses)}</p></div>
          <div><p className="text-emerald-300 text-xs">Today Profit</p><p className={cn('text-xl font-bold', (t.profit??0) >= 0 ? 'text-green-300' : 'text-red-300')}>{fmt(t.profit)}</p></div>
        </div>
      </div>

      {/* Monthly KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l:'Monthly Income',    v:fmt(m.income),   cl:'border-emerald-200 text-emerald-700', ic:<TrendingUp size={18}/> },
          { l:'Monthly Expenses',  v:fmt(m.expenses), cl:'border-red-200 text-red-700',         ic:<TrendingDown size={18}/> },
          { l:'Outstanding',       v:fmt(fin?.outstanding), sub:`${fin?.overdueCount??0} overdue`, cl:'border-amber-200 text-amber-700', ic:<AlertCircle size={18}/> },
          { l:'Due Today',         v:`${fin?.dueTodayCount??0} payments`, cl:'border-orange-200 text-orange-700', ic:<Clock size={18}/> },
        ].map(({l,v,sub,cl,ic}: any) => (
          <div key={l} className={cn('bg-white rounded-xl border p-4 shadow-sm', cl)}>
            <div className="w-9 h-9 rounded-xl bg-current/10 flex items-center justify-center mb-2">{ic}</div>
            <p className="text-xs text-gray-500">{l}</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{v}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Chart + agreements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Monthly breakdown bar chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><DollarSign size={14} className="text-emerald-600" /> Monthly Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} RWF`]} />
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {chartData.map((d, i) => <rect key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active agreements */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2"><FileText size={14} className="text-emerald-600" /><span className="text-sm font-semibold">Active Agreements</span></div>
            <Link href="/agreements" className="text-xs text-emerald-600 font-medium flex items-center gap-1">All <ChevronRight size={12} /></Link>
          </div>
          {agreements.length === 0
            ? <div className="p-10 text-center text-gray-400 text-sm"><FileText size={28} className="mx-auto mb-2 opacity-20" />No active agreements</div>
            : <div className="divide-y divide-gray-100">
                {agreements.map((a: any) => (
                  <Link key={a.id} href={`/agreements/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0"><CreditCard size={14} className="text-emerald-600" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.customer?.name}</p>
                      <p className="text-xs text-gray-400">{a.vehicle?.licensePlate} · {a.currency} {a.rateAmount.toLocaleString()} / {a.ratePeriod}</p>
                    </div>
                    {a.overdueAmount > 0
                      ? <span className="text-xs text-red-600 font-medium shrink-0">⚠ Overdue</span>
                      : <span className="text-xs text-emerald-700 font-medium shrink-0">{a.currency} {a.totalPaid.toLocaleString()} paid</span>}
                  </Link>
                ))}
              </div>
          }
        </div>
      </div>

      {/* Top customers + compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Users size={14} className="text-emerald-600" /> Top Paying Customers</h3>
          {(fin?.topCustomers ?? []).slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">{i+1}</span>
                <div><p className="text-sm font-medium text-gray-900">{c.customer?.name ?? 'Unknown'}</p><p className="text-xs text-gray-400">{c.customer?.phone}</p></div>
              </div>
              <p className="text-sm font-bold text-emerald-700">{fmt(c._sum?.amount ?? 0)}</p>
            </div>
          ))}
          {!fin?.topCustomers?.length && <p className="text-sm text-gray-400 text-center py-4">No data yet</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> Compliance Alerts</h3>
          {[
            { l: 'Insurance expiring (30d)', v: fin?.compliance?.insuranceExpiring ?? 0, warn: (fin?.compliance?.insuranceExpiring ?? 0) > 0 },
            { l: 'Road tax expiring (30d)',  v: fin?.compliance?.roadTaxExpiring   ?? 0, warn: (fin?.compliance?.roadTaxExpiring   ?? 0) > 0 },
            { l: 'Inspection expiring (15d)',v: fin?.compliance?.inspectionExpiring ?? 0, warn: (fin?.compliance?.inspectionExpiring ?? 0) > 0 },
          ].map(({l,v,warn}) => (
            <div key={l} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">{l}</span>
              <span className={cn('text-sm font-bold', warn ? 'text-amber-600' : 'text-gray-400')}>{v} vehicles</span>
            </div>
          ))}
          <Link href="/documents" className="block text-center text-xs text-emerald-600 mt-3 hover:text-emerald-700">View compliance dashboard →</Link>
        </div>
      </div>
    </div>
  );
}
