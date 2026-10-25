/**
 * FINANCE_MANAGER dashboard
 * Content: P&L summary, outstanding payments, agreements, top customers,
 * compliance alerts, expense breakdown. NO GPS map.
 */
'use client';
import { useQuery } from '@tanstack/react-query';
import { financialApi, agreementApi } from '@/lib/api';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle,
  Clock, FileText, Users, CreditCard, ChevronRight,
  CheckCircle2, ShieldAlert, BarChart3,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

function KpiCard({ label, value, sub, icon, borderColor }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; borderColor: string;
}) {
  return (
    <div className={cn('bg-white rounded-xl border-l-4 border border-gray-200 p-4 shadow-sm', borderColor)}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function FinanceDashboard() {
  const { data: fin, isLoading } = useQuery({
    queryKey: ['fin-dash-main'],
    queryFn: () => financialApi.dashboard(),
    refetchInterval: 60_000,
  });
  const { data: agData } = useQuery({
    queryKey: ['agreements-active'],
    queryFn:  () => agreementApi.list({ status: 'ACTIVE', limit: 6 }),
  });

  const fmt = (n: number) => `${(n ?? 0).toLocaleString()} RWF`;
  const t = fin?.today ?? {};
  const m = fin?.month ?? {};
  const agreements = agData?.data ?? [];

  const barData = [
    { name: 'Income',      v: m.income      ?? 0, color: '#22c55e' },
    { name: 'Expenses',    v: m.expenses    ?? 0, color: '#ef4444' },
    { name: 'Maintenance', v: fin?.monthlyStats?.maintenance ?? 0, color: '#f97316' },
    { name: 'Fuel',        v: fin?.monthlyStats?.fuel        ?? 0, color: '#3b82f6' },
    { name: 'Fines',       v: fin?.monthlyStats?.fines       ?? 0, color: '#8b5cf6' },
  ];

  if (isLoading) return (
    <div className="animate-pulse space-y-5">
      <div className="h-8 bg-gray-100 rounded w-56" />
      {[...Array(3)].map((_,i) => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · Financial overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/agreements" className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium transition">
            <FileText size={13} /> New Agreement
          </Link>
          <Link href="/reports" className="flex items-center gap-1.5 text-xs border border-brand-200 text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg font-medium transition">
            <BarChart3 size={13} /> Reports
          </Link>
        </div>
      </div>

      {/* Today row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Today's Income"   value={fmt(t.income)}   icon={<TrendingUp size={18} className="text-green-600" />}  borderColor="border-l-green-500" />
        <KpiCard label="Today's Expenses" value={fmt(t.expenses)} icon={<TrendingDown size={18} className="text-red-600" />}  borderColor="border-l-red-500" />
        <KpiCard label="Today's Profit"   value={fmt(t.profit)}   icon={<DollarSign size={18} className={cn((t.profit??0)>=0 ? 'text-emerald-600' : 'text-red-600')} />} borderColor={cn((t.profit??0)>=0?'border-l-emerald-500':'border-l-red-500')} />
      </div>

      {/* Monthly row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Monthly Income"   value={fmt(m.income)}   icon={<TrendingUp size={16} className="text-green-600" />}   borderColor="border-l-green-400" />
        <KpiCard label="Monthly Expenses" value={fmt(m.expenses)} icon={<TrendingDown size={16} className="text-red-600" />}   borderColor="border-l-red-400" />
        <KpiCard label="Outstanding"      value={fmt(fin?.outstanding)} sub={`${fin?.overdueCount??0} overdue`} icon={<AlertCircle size={16} className="text-amber-600" />} borderColor="border-l-amber-400" />
        <KpiCard label="Due Today"        value={`${fin?.dueTodayCount??0} payments`} icon={<Clock size={16} className="text-orange-600" />} borderColor="border-l-orange-400" />
      </div>

      {/* Chart + agreements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <DollarSign size={14} className="text-brand-600" /> Monthly Cost Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} RWF`]} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="v" radius={[4,4,0,0]}>
                {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2"><FileText size={14} className="text-brand-600" /><span className="text-sm font-semibold text-gray-800">Active Agreements</span></div>
            <Link href="/agreements" className="text-xs text-brand-600 font-medium flex items-center gap-1">All <ChevronRight size={12} /></Link>
          </div>
          {agreements.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm"><FileText size={28} className="mx-auto mb-2 opacity-20" />No active agreements</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {agreements.map((a: any) => (
                <Link key={a.id} href={`/agreements/${a.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition">
                  <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                    <CreditCard size={14} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.customer?.name}</p>
                    <p className="text-xs text-gray-400">{a.vehicle?.licensePlate} · {a.currency} {a.rateAmount?.toLocaleString()}/{a.ratePeriod}</p>
                  </div>
                  {a.overdueAmount > 0
                    ? <span className="text-xs text-red-600 font-semibold shrink-0">⚠ Overdue</span>
                    : <span className="text-xs text-green-700 font-medium shrink-0">{a.currency} {a.totalPaid?.toLocaleString()} paid</span>
                  }
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top customers + compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <Users size={14} className="text-brand-600" /> Top Paying Customers (Month)
          </h3>
          {(fin?.topCustomers ?? []).slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.customer?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{c.customer?.phone}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-green-700">{fmt(c._sum?.amount ?? 0)}</p>
            </div>
          ))}
          {!fin?.topCustomers?.length && <p className="text-sm text-gray-400 text-center py-4">No payment data yet</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-brand-600" /> Compliance Alerts
          </h3>
          {[
            { l:'Insurance expiring (30d)', v: fin?.compliance?.insuranceExpiring ?? 0 },
            { l:'Road tax expiring (30d)',  v: fin?.compliance?.roadTaxExpiring   ?? 0 },
            { l:'Inspection due (15d)',     v: fin?.compliance?.inspectionExpiring ?? 0 },
          ].map(({ l, v }) => (
            <div key={l} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">{l}</span>
              <span className={cn('text-sm font-bold', v > 0 ? 'text-amber-600' : 'text-gray-400')}>{v} vehicles</span>
            </div>
          ))}
          <div className="pt-3 flex gap-2">
            <Link href="/documents" className="flex-1 text-center text-xs text-brand-600 hover:text-brand-700 border border-brand-200 rounded-lg py-1.5 font-medium transition">Documents</Link>
            <Link href="/vehicles"  className="flex-1 text-center text-xs text-brand-600 hover:text-brand-700 border border-brand-200 rounded-lg py-1.5 font-medium transition">Vehicles</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
