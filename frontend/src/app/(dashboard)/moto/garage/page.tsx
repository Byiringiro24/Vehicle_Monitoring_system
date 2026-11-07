'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Wrench, Plus, Search, Loader2, X, DollarSign } from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  MAINTENANCE: 'bg-amber-100 text-amber-700',
  FUEL:        'bg-blue-100 text-blue-700',
  FINE:        'bg-red-100 text-red-700',
  INSURANCE:   'bg-purple-100 text-purple-700',
  TAX:         'bg-orange-100 text-orange-700',
  ACCESSORIES: 'bg-teal-100 text-teal-700',
  BALANCE_CHECK: 'bg-indigo-100 text-indigo-700',
  OTHER:       'bg-gray-100 text-gray-600',
};

export default function MotoGaragePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ plateNumber: '', product: '', amount: '', category: 'MAINTENANCE', notes: '' });

  const { data: garageData, isLoading } = useQuery({
    queryKey: ['moto-garage'],
    queryFn: () => motoApi.listGarage({ limit: 200 }),
  });

  const expenses: any[] = garageData?.data ?? [];
  const total = garageData?.total ?? 0;

  const filtered = expenses.filter((e: any) => {
    const q = search.toLowerCase();
    return !q || e.product?.toLowerCase().includes(q) || e.plateNumber?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q);
  });

  // Group by date
  const byDate: Record<string, any[]> = {};
  filtered.forEach((e: any) => {
    const day = e.date ? new Date(e.date).toISOString().slice(0, 10) : 'Unknown';
    if (!byDate[day]) byDate[day] = [];
    byDate[day].push(e);
  });
  const dateKeys = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const addMutation = useMutation({
    mutationFn: () => motoApi.addGarage({
      date: new Date().toISOString(),
      ...form,
      amount: parseFloat(form.amount),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moto-garage'] });
      toast.success('Garage expense recorded');
      setShowAdd(false);
      setForm({ plateNumber: '', product: '', amount: '', category: 'MAINTENANCE', notes: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Garage Expenses</h1>
          <p className="text-gray-500 text-sm mt-0.5">Maintenance, repairs, tires, fines, insurance and other vehicle costs</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition shadow-sm">
          <Plus size={14} /> Add expense
        </button>
      </div>

      {/* Total */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
            <DollarSign size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total garage expenses (all time)</p>
            <p className="text-2xl font-bold text-gray-900 tabular">RWF {total.toLocaleString()}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{expenses.length} records</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, plate, category…"
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      {/* Expenses grouped by date */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Wrench size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No garage expenses recorded</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateKeys.map(date => {
            const dayExpenses = byDate[date];
            const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0);
            return (
              <div key={date} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <p className="text-sm font-semibold text-gray-800">{formatDate(date)}</p>
                  <p className="text-sm font-bold text-amber-600 tabular">RWF {dayTotal.toLocaleString()}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {dayExpenses.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">{e.product}</p>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', CATEGORY_COLORS[e.category] ?? 'bg-gray-100 text-gray-600')}>
                            {e.category?.replace(/_/g,' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {e.plateNumber ? `Plate: ${e.plateNumber} · ` : ''}{e.notes ?? ''}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-amber-600 tabular shrink-0">RWF {e.amount?.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Garage Expense</h2>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product / Service *</label>
                <input value={form.product} onChange={e => setForm(f => ({...f, product: e.target.value}))}
                  placeholder="e.g. Tire replacement, Mechanic fee, Helmet"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plate number (optional)</label>
                  <input value={form.plateNumber} onChange={e => setForm(f => ({...f, plateNumber: e.target.value.toUpperCase()}))}
                    placeholder="RAC 456 B" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (RWF) *</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                    placeholder="15000" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 tabular" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  {['MAINTENANCE','FUEL','FINE','INSURANCE','TAX','ACCESSORIES','OTHER'].map(c =>
                    <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  placeholder="Additional details…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.product || !form.amount || addMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-1.5">
                {addMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
