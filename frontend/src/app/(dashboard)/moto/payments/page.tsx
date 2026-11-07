'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { DollarSign, Search, Loader2, CheckCircle2, AlertTriangle, Phone, Bike, Save } from 'lucide-react';

export default function MotoPaymentsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [paying, setPaying] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payPhone, setPayPhone] = useState('');
  const [payCash, setPayCash] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  // Get all drivers for the day's collection
  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['moto-drivers-collection'],
    queryFn: () => motoApi.listDrivers({ active: 'true' }),
  });

  // Today's summary
  const { data: todaySummary } = useQuery({
    queryKey: ['moto-today-summary'],
    queryFn: () => motoApi.todaySummary(),
    refetchInterval: 10000,
  });

  const recordPayment = useMutation({
    mutationFn: (data: any) => motoApi.recordPayment(data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['moto-drivers-collection'] });
      qc.invalidateQueries({ queryKey: ['moto-today-summary'] });
      toast.success(data.message);
      setPaying(null); setPayAmount(''); setPayPhone(''); setPayCash(''); setPayNotes('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to record payment'),
  });

  // Filter drivers by search
  const filtered = (drivers as any[]).filter((d: any) => {
    const q = search.toLowerCase();
    return !q ||
      `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
      d.phone?.includes(q) ||
      d.plateNumber?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Daily Collection</h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} — Record payments from motorcycle drivers</p>
      </div>

      {/* Today's summary KPIs */}
      {todaySummary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Collected',     value: `RWF ${(todaySummary.totalCollected ?? 0).toLocaleString()}`, icon: <DollarSign size={15} className="text-green-600" />,  bg: 'bg-green-50',  border: 'border-green-200' },
            { label: 'Expected',       value: `RWF ${(todaySummary.totalExpected ?? 0).toLocaleString()}`, icon: <DollarSign size={15} className="text-blue-600" />,   bg: 'bg-blue-50',   border: 'border-blue-200' },
            { label: 'Outstanding',    value: `RWF ${(todaySummary.totalDebt ?? 0).toLocaleString()}`,     icon: <AlertTriangle size={15} className="text-amber-600" />, bg: 'bg-amber-50', border: 'border-amber-200' },
            { label: 'Paid',           value: todaySummary.paidCount ?? 0,                                   icon: <CheckCircle2 size={15} className="text-green-600" />, bg: 'bg-green-50', border: 'border-green-200' },
            { label: 'Not recorded',   value: todaySummary.notRecorded ?? 0,                                 icon: <AlertTriangle size={15} className="text-red-600" />, bg: 'bg-red-50',   border: 'border-red-200' },
          ].map(({ label, value, icon, bg, border }) => (
            <div key={label} className={`bg-white rounded-xl border ${border} p-4 shadow-xs flex items-center gap-2`}>
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
              <div>
                <p className="text-sm font-bold text-gray-900 tabular">{value}</p>
                <p className="text-[10px] text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search driver or plate…"
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      {/* Driver collection list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Bike size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No active drivers with bikes</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filtered.map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                {/* Driver info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{d.firstName} {d.lastName}</p>
                    {d.plateNumber && (
                      <span className="text-[10px] font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded">{d.plateNumber}</span>
                    )}
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                      d.todayStatus === 'PAID' ? 'bg-green-100 text-green-700' :
                      d.todayStatus === 'DEBT' ? 'bg-red-100 text-red-700' :
                      d.todayStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-500')}>
                      {d.todayStatus?.replace('_',' ') ?? 'NOT RECORDED'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Phone size={10} /> {d.phone}</span>
                    <span>Rate: RWF {d.dailyRate?.toLocaleString()}/day</span>
                    {d.totalDebt > 0 && <span className="text-red-500 font-medium">Debt: RWF {d.totalDebt.toLocaleString()}</span>}
                  </div>
                </div>

                {/* Today's payment or record button */}
                {d.todayStatus === 'PAID' ? (
                  <span className="text-xs text-green-600 font-medium shrink-0">
                    ✓ RWF {d.todayPaid?.toLocaleString()} paid
                  </span>
                ) : paying === d.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                      placeholder={String(d.dailyRate)}
                      autoFocus
                      className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500 tabular" />
                    <button
                      onClick={() => recordPayment.mutate({
                        driverId: d.id, date: today, paidAmount: parseFloat(payAmount || '0'), notes: payNotes,
                      })}
                      disabled={recordPayment.isPending}
                      className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition disabled:opacity-60">
                      {recordPayment.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    </button>
                    <button onClick={() => { setPaying(null); setPayAmount(''); }}
                      className="px-1.5 py-1 border border-gray-300 text-gray-500 text-xs rounded-lg hover:bg-gray-50">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setPaying(d.id); setPayAmount(String(d.dailyRate)); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition shrink-0">
                    <DollarSign size={11} /> Record
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        <p className="font-medium mb-1">How daily collection works:</p>
        <p>• Enter the amount the driver paid today. If they pay the full daily rate, status becomes PAID.</p>
        <p>• If they pay less than the daily rate, the difference is added to their debt.</p>
        <p>• If they pay more than the daily rate, the extra amount covers their previous debt first.</p>
        <p>• If they don't pay at all, the full daily rate is added to their debt.</p>
      </div>
    </div>
  );
}
