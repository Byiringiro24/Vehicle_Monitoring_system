'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { DollarSign, CheckCircle2, XCircle, Play, Plus, X, AlertTriangle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PENDING:  'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  EXECUTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function PayoutsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isFinance = ['SUPER_ADMIN','ADMIN','FINANCE_MANAGER'].includes(user?.role ?? '');

  const [showCreate, setShowCreate] = useState(false);
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({ ownerId:'', amount:'', periodFrom:'', periodTo:'', notes:'', method:'MOBILE_MONEY' });

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['payouts'],
    queryFn: () => apiClient.get('/payouts').then(r => r.data),
  });

  const { data: owners = [] } = useQuery({
    queryKey: ['owner-vehicles'],
    queryFn: () => apiClient.get('/owner/vehicles').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.post('/payouts', { ...form, amount: parseFloat(form.amount) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payouts'] }); toast.success('Payout request created'); setShowCreate(false); setForm({ ownerId:'', amount:'', periodFrom:'', periodTo:'', notes:'', method:'MOBILE_MONEY' }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/payouts/${id}/approve`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payouts'] }); toast.success('Payout approved'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed — remember: you cannot approve your own request'),
  });

  const executeMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference?: string }) =>
      apiClient.patch(`/payouts/${id}/execute`, { reference }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payouts'] }); toast.success('Payout executed — marked as paid'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.patch(`/payouts/${id}/reject`, { reason }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payouts'] }); toast.success('Payout rejected'); setRejectModal(null); setRejectReason(''); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const list: any[] = payouts as any[];
  const pending  = list.filter(p => p.status === 'PENDING').length;
  const approved = list.filter(p => p.status === 'APPROVED').length;
  const total    = list.reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="text-gray-500 text-sm mt-0.5">Owner payout approval workflow — two-step approval required</p>
        </div>
        {isFinance && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition shadow-sm">
            <Plus size={14} /> Request payout
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending approval', value: pending,                 color: 'border-amber-200 bg-amber-50',  textColor: 'text-amber-700' },
          { label: 'Awaiting execution', value: approved,              color: 'border-blue-200 bg-blue-50',    textColor: 'text-blue-700' },
          { label: 'Total this period', value: `RWF ${(total/1000).toFixed(0)}k`, color: 'border-gray-200',   textColor: 'text-gray-900' },
        ].map(({ label, value, color, textColor }) => (
          <div key={label} className={`bg-white rounded-xl border p-4 shadow-xs ${color}`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-xl font-bold tabular mt-0.5 ${textColor}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Separation of duties notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
        <AlertTriangle size={14} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <strong>Separation of duties:</strong> The person who creates a payout request cannot approve it. Approval and execution require a different Finance Manager or Admin.
        </p>
      </div>

      {/* Payouts list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <DollarSign size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No payout requests yet</p>
          <p className="text-sm text-gray-400 mt-1">Create a payout request to start the approval workflow.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600')}>
                      {p.status}
                    </span>
                    <span className="text-xs text-gray-400">{p.method ?? 'MOBILE_MONEY'}</span>
                  </div>
                  <p className="font-bold text-gray-900 text-lg tabular">RWF {(p.amount ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(p.periodFrom)} → {formatDate(p.periodTo)}
                  </p>
                  {p.notes && <p className="text-xs text-gray-400 mt-1">{p.notes}</p>}
                  {p.rejectionReason && (
                    <p className="text-xs text-red-500 mt-1">Rejected: {p.rejectionReason}</p>
                  )}
                </div>
                {isFinance && (
                  <div className="flex gap-2 flex-wrap shrink-0">
                    {p.status === 'PENDING' && (
                      <>
                        <button onClick={() => approveMutation.mutate(p.id)} disabled={approveMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition disabled:opacity-60">
                          <CheckCircle2 size={12} /> Approve
                        </button>
                        <button onClick={() => { setRejectModal(p); setRejectReason(''); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition">
                          <XCircle size={12} /> Reject
                        </button>
                      </>
                    )}
                    {p.status === 'APPROVED' && (
                      <button onClick={() => executeMutation.mutate({ id: p.id })} disabled={executeMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded-lg transition disabled:opacity-60">
                        <Play size={12} /> Execute payout
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Request Payout</h2>
              <button onClick={() => setShowCreate(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner *</label>
                <select value={form.ownerId} onChange={e => setForm(f=>({...f, ownerId: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select owner…</option>
                  {(owners as any[]).map((v: any) => (
                    <option key={v.ownerUserId ?? v.id} value={v.ownerUserId ?? v.id}>
                      {v.name ?? v.licensePlate ?? 'Vehicle'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (RWF) *</label>
                <input type="number" value={form.amount} onChange={e => setForm(f=>({...f, amount: e.target.value}))}
                  placeholder="330000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period from *</label>
                  <input type="date" value={form.periodFrom} onChange={e => setForm(f=>({...f, periodFrom: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period to *</label>
                  <input type="date" value={form.periodTo} onChange={e => setForm(f=>({...f, periodTo: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment method</label>
                <select value={form.method} onChange={e => setForm(f=>({...f, method: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  {['MOBILE_MONEY','BANK','CASH'].map(m => <option key={m} value={m}>{m.replace('_',' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f=>({...f, notes: e.target.value}))}
                  rows={2} placeholder="October net payout after deductions…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.ownerId || !form.amount || !form.periodFrom || !form.periodTo || createMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {createMutation.isPending ? 'Creating…' : 'Request payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-1">Reject Payout</h2>
            <p className="text-sm text-gray-500 mb-4">RWF {(rejectModal.amount ?? 0).toLocaleString()}</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder="Reason for rejection…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
