'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { DollarSign, Search, Loader2, CheckCircle2, AlertTriangle, Phone, Bike, Save, Smartphone, Wallet, Calculator, Wrench, Plus } from 'lucide-react';

export default function MotoPaymentsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [paying, setPaying] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payPhone, setPayPhone] = useState('');
  const [payCash, setPayCash] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Account balance tracking (from AUTOEARN daily report: BALANCE/PHONE + BALANCE/MACHINE)
  const [showBalance, setShowBalance] = useState(false);
  const [phoneBalance, setPhoneBalance] = useState('');
  const [machineBalance, setMachineBalance] = useState('');

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

      {/* Account Balance Reconciliation — from AUTOEARN daily report */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button onClick={() => setShowBalance(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Calculator size={18} className="text-purple-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">Account Balance Reconciliation</p>
              <p className="text-xs text-gray-400">Record phone + machine balance to reconcile with collections</p>
            </div>
          </div>
          <span className="text-xs text-gray-400">{showBalance ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {showBalance && (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-4 mt-4">
              {/* Phone balance */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone size={16} className="text-blue-600" />
                  <p className="text-sm font-semibold text-blue-900">Phone Balance (Mobile Money)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">RWF</span>
                  <input type="number" value={phoneBalance} onChange={e => setPhoneBalance(e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm tabular outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Recorded: {new Date().toLocaleTimeString()}</p>
              </div>

              {/* Machine/cash balance */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet size={16} className="text-green-600" />
                  <p className="text-sm font-semibold text-green-900">Machine/Cash Balance</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">RWF</span>
                  <input type="number" value={machineBalance} onChange={e => setMachineBalance(e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 border border-green-300 rounded-lg text-sm tabular outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Recorded: {new Date().toLocaleTimeString()}</p>
              </div>
            </div>

            {/* Reconciliation comparison */}
            {todaySummary && (phoneBalance || machineBalance) && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Reconciliation</p>
                {[
                  { label: 'Collected today',     value: todaySummary.totalCollected ?? 0,                        color: 'text-gray-900' },
                  { label: 'Phone balance',        value: parseFloat(phoneBalance || '0'),                        color: 'text-blue-600' },
                  { label: 'Machine balance',      value: parseFloat(machineBalance || '0'),                      color: 'text-green-600' },
                  { label: 'Total in accounts',    value: parseFloat(phoneBalance || '0') + parseFloat(machineBalance || '0'), color: 'text-gray-900' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className={`font-bold tabular ${color}`}>RWF {value.toLocaleString()}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Difference (should be 0):</span>
                  <span className={`text-sm font-bold tabular ${
                    Math.abs(parseFloat(phoneBalance || '0') + parseFloat(machineBalance || '0') - (todaySummary.totalCollected ?? 0)) < 1
                      ? 'text-green-600' : 'text-red-600'}`}>
                    RWF {Math.abs(parseFloat(phoneBalance || '0') + parseFloat(machineBalance || '0') - (todaySummary.totalCollected ?? 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Save balance button */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  motoApi.addGarage({
                    date: new Date().toISOString(),
                    product: `Balance check — Phone: RWF ${phoneBalance || '0'}, Machine: RWF ${machineBalance || '0'}`,
                    amount: parseFloat(phoneBalance || '0') + parseFloat(machineBalance || '0'),
                    category: 'BALANCE_CHECK',
                    notes: `Phone: ${phoneBalance}, Machine: ${machineBalance}`,
                  }).then(() => {
                    toast.success('Balance recorded');
                    setPhoneBalance(''); setMachineBalance('');
                  }).catch(() => toast.error('Failed to save'));
                }}
                disabled={!phoneBalance && !machineBalance}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-60">
                <Save size={14} /> Save balance record
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Garage quick entry */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
          <Wrench size={14} className="text-amber-500" /> Quick Garage Expense
        </h2>
        <GarageQuickEntry />
      </div>
    </div>
  );
}

function GarageQuickEntry() {
  const [plate, setPlate] = useState('');
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('MAINTENANCE');

  const addMutation = useMutation({
    mutationFn: () => motoApi.addGarage({
      date: new Date().toISOString(),
      plateNumber: plate || undefined,
      product,
      amount: parseFloat(amount),
      category,
    }),
    onSuccess: () => {
      toast.success('Garage expense recorded');
      setPlate(''); setProduct(''); setAmount(''); setCategory('MAINTENANCE');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div className="flex-1 min-w-[120px]">
        <label className="block text-[10px] text-gray-400 mb-0.5">Plate (optional)</label>
        <input value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="RAC 456 B"
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500 font-mono" />
      </div>
      <div className="flex-[2] min-w-[150px]">
        <label className="block text-[10px] text-gray-400 mb-0.5">Product / Service *</label>
        <input value={product} onChange={e => setProduct(e.target.value)} placeholder="e.g. Tire, Mechanic fee, Helmet"
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      <div className="w-24">
        <label className="block text-[10px] text-gray-400 mb-0.5">Amount *</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="15000"
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500 tabular" />
      </div>
      <div className="w-32">
        <label className="block text-[10px] text-gray-400 mb-0.5">Category</label>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500">
          {['MAINTENANCE','FUEL','FINE','INSURANCE','TAX','ACCESSORIES','OTHER'].map(c =>
            <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button onClick={() => addMutation.mutate()} disabled={!product || !amount || addMutation.isPending}
        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition disabled:opacity-60">
        {addMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Add
      </button>
    </div>
  );
}
