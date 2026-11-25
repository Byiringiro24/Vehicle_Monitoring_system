'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ShieldCheck, AlertTriangle, FileText, Truck, Clock, Search, CheckCircle2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const DOC_STATUS_COLORS: Record<string, string> = {
  VERIFIED:       'bg-green-100 text-green-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
  PENDING_UPLOAD: 'bg-gray-100 text-gray-600',
  REJECTED:       'bg-red-100 text-red-700',
  EXPIRED:        'bg-red-100 text-red-700',
};

type TabId = 'review' | 'expiry' | 'all';

export default function CompliancePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('review');
  const [search, setSearch] = useState('');
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const verifyMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/documents/${id}/verify`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-docs'] }); toast.success('Document verified ✓'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to verify document'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/documents/${id}/reject`, { reason }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-docs'] }); toast.success('Document rejected'); setRejectDocId(null); setRejectReason(''); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to reject document'),
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['compliance-docs'],
    queryFn: () => apiClient.get('/documents?limit=200').then(r => r.data?.data ?? r.data ?? []),
    refetchInterval: 60000,
  });
  const { data: compliance } = useQuery({
    queryKey: ['compliance-summary'],
    queryFn: () => apiClient.get('/documents/compliance').then(r => r.data),
  });

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);

  const pendingReview = (docs as any[]).filter((d: any) => d.status === 'PENDING_REVIEW');
  const expiringSoon  = (docs as any[]).filter((d: any) => d.expiresAt && new Date(d.expiresAt) <= in30 && d.status !== 'EXPIRED');
  const expired       = (docs as any[]).filter((d: any) => d.status === 'EXPIRED');

  const displayDocs = tab === 'review' ? pendingReview
    : tab === 'expiry' ? [...expired, ...expiringSoon].filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i)
    : (docs as any[]);

  const filtered = displayDocs.filter((d: any) => {
    const q = search.toLowerCase();
    return !q || d.label?.toLowerCase().includes(q) || d.vehicle?.licensePlate?.toLowerCase().includes(q) || d.driver?.user?.firstName?.toLowerCase().includes(q);
  });

  const daysUntil = (dateStr: string) => Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);

  const TABS = [
    { id: 'review' as TabId,  label: 'Review Queue', badge: pendingReview.length },
    { id: 'expiry' as TabId,  label: 'Expiry',        badge: expiringSoon.length + expired.length },
    { id: 'all' as TabId,     label: 'All Documents', badge: 0 },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
      </div>

      {/* KPIs */}
      {compliance && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pending review', value: compliance.pendingReview  ?? pendingReview.length, icon: <FileText size={15} className="text-amber-600" />,   bg: 'bg-amber-50',  border: 'border-amber-200' },
            { label: 'Expiring 30d',   value: compliance.expiringSoon30 ?? expiringSoon.length,  icon: <Clock size={15} className="text-orange-600" />,      bg: 'bg-orange-50', border: 'border-orange-200' },
            { label: 'Expired',        value: compliance.expired        ?? expired.length,        icon: <AlertTriangle size={15} className="text-red-600" />, bg: 'bg-red-50',    border: 'border-red-200' },
            { label: 'Verified',       value: compliance.verified       ?? 0,                    icon: <ShieldCheck size={15} className="text-green-600" />, bg: 'bg-green-50',  border: 'border-green-200' },
          ].map(({ label, value, icon, bg, border }) => (
            <div key={label} className={`bg-white rounded-xl border ${border} p-4 shadow-xs flex items-center gap-3`}>
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
              <div>
                <p className="text-xl font-bold text-gray-900 tabular">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition relative',
                tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {t.label}
              {t.badge > 0 && (
                <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center px-1 font-bold">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle2 size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">
            {tab === 'review' ? 'No documents pending review' : tab === 'expiry' ? 'No expiring documents' : 'No documents found'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 border-b">
                <tr>{['Document','Vehicle/Driver','Expiry','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((d: any) => {
                  const days = d.expiresAt ? daysUntil(d.expiresAt) : null;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{d.label}</p>
                        <p className="text-xs text-gray-400">{d.documentType?.replace(/_/g,' ')}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {d.vehicle ? (
                          <div className="flex items-center gap-1">
                            <Truck size={12} className="text-gray-400" />
                            {d.vehicle.licensePlate}
                          </div>
                        ) : d.driver ? (
                          <span>{d.driver.user?.firstName} {d.driver.user?.lastName}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {d.expiresAt ? (
                          <span className={cn('font-medium', days !== null && days <= 0 ? 'text-red-600' : days !== null && days <= 7 ? 'text-orange-600' : days !== null && days <= 30 ? 'text-amber-600' : 'text-gray-700')}>
                            {days !== null && days <= 0 ? 'EXPIRED' : days !== null ? `${days}d left` : '—'}
                            <span className="block text-xs text-gray-400 font-normal">{formatDate(d.expiresAt)}</span>
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', DOC_STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-600')}>
                          {d.status?.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {d.status === 'PENDING_REVIEW' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => verifyMutation.mutate(d.id)}
                              disabled={verifyMutation.isPending}
                              className="text-green-600 hover:text-green-700 font-medium disabled:opacity-50">
                              Verify
                            </button>
                            <button
                              onClick={() => { setRejectDocId(d.id); setRejectReason(''); }}
                              className="text-red-500 hover:text-red-600 font-medium">
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Reason for rejection</h2>
              <button onClick={() => setRejectDocId(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16} /></button>
            </div>
            <p className="text-xs text-gray-500">This reason will be visible to the document owner so they know what to fix.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Document is blurry, wrong vehicle plate, expired certificate…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectDocId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectDocId, reason: rejectReason.trim() || 'Document rejected' })}
                disabled={rejectMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
