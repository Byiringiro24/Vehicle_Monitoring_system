'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { AlertTriangle, Plus, Search, Loader2, X, CheckCircle2 } from 'lucide-react';

const REASON_COLORS: Record<string, string> = {
  TRAFFIC:  'bg-red-100 text-red-700',
  POLICE:   'bg-orange-100 text-orange-700',
  ACCIDENT: 'bg-purple-100 text-purple-700',
  OTHER:    'bg-gray-100 text-gray-600',
};

export default function MotoFinesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ driverId: '', plateNumber: '', reason: 'TRAFFIC', amount: '', fineDate: new Date().toISOString().slice(0, 10), paidByCompany: false, notes: '' });

  const { data: fines = [], isLoading } = useQuery({
    queryKey: ['moto-fines'],
    queryFn: () => motoApi.listFines({ limit: 200 }),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['moto-drivers-for-fines'],
    queryFn: () => motoApi.listDrivers({ active: 'true' }),
    enabled: showAdd,
  });

  const filtered = (fines as any[]).filter((f: any) => {
    const q = search.toLowerCase();
    return !q || f.plateNumber?.toLowerCase().includes(q) || f.reason?.toLowerCase().includes(q) || f.driver?.firstName?.toLowerCase().includes(q);
  });

  const totalAmount = (fines as any[]).reduce((s, f) => s + f.amount, 0);
  const unrecovered = (fines as any[]).filter((f: any) => !f.recovered).reduce((s, f) => s + f.amount, 0);

  const addMutation = useMutation({
    mutationFn: () => motoApi.addFine({
      ...form,
      amount: parseFloat(form.amount),
      fineDate: form.fineDate ? new Date(form.fineDate).toISOString() : new Date().toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moto-fines'] });
      toast.success('Fine recorded');
      setShowAdd(false);
      setForm({ driverId: '', plateNumber: '', reason: 'TRAFFIC', amount: '', fineDate: new Date().toISOString().slice(0, 10), paidByCompany: false, notes: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fines</h1>
          <p className="text-gray-500 text-sm mt-0.5">Traffic fines, police fines and accident charges per bike/driver</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition shadow-sm">
          <Plus size={14} /> Add fine
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total fines',     value: `RWF ${totalAmount.toLocaleString()}`,     color: 'border-gray-200' },
          { label: 'Not recovered',   value: `RWF ${unrecovered.toLocaleString()}`,     color: 'border-red-200' },
          { label: 'Total records',   value: (fines as any[]).length,                    color: 'border-blue-200' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-white rounded-xl border ${color} p-4 shadow-xs`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-bold text-gray-900 tabular mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plate, reason, driver…"
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      {/* Fines list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <AlertTriangle size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No fines recorded</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 border-b">
                <tr>{['Date','Plate','Driver','Reason','Amount','Status'].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((f: any) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(f.fineDate)}</td>
                    <td className="px-4 py-3"><span className="text-xs font-mono font-bold">{f.plateNumber}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {f.driver ? `${f.driver.firstName} ${f.driver.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', REASON_COLORS[f.reason] ?? 'bg-gray-100 text-gray-600')}>
                        {f.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold tabular text-amber-600">RWF {f.amount?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {f.recovered ? (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={11} /> Recovered</span>
                      ) : f.paidByCompany ? (
                        <span className="text-xs text-blue-600 font-medium">Company paid</span>
                      ) : (
                        <span className="text-xs text-red-500 font-medium">Driver owes</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Fine</h2>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plate number *</label>
                <input value={form.plateNumber} onChange={e => setForm(f => ({...f, plateNumber: e.target.value.toUpperCase()}))}
                  placeholder="RAC 456 B" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver (optional)</label>
                <select value={form.driverId} onChange={e => setForm(f => ({...f, driverId: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select driver…</option>
                  {(drivers as any[]).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.firstName} {d.lastName} — {d.plateNumber ?? 'No bike'}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                  <select value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                    {['TRAFFIC','POLICE','ACCIDENT','OTHER'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (RWF) *</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                    placeholder="5000" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 tabular" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fine date</label>
                <input type="date" value={form.fineDate} onChange={e => setForm(f => ({...f, fineDate: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.paidByCompany} onChange={e => setForm(f => ({...f, paidByCompany: e.target.checked}))}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-gray-700">Company paid this fine on behalf of driver</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  placeholder="e.g. Speeding on KN 3 Rd" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.plateNumber || !form.amount || addMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-1.5">
                {addMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save fine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
