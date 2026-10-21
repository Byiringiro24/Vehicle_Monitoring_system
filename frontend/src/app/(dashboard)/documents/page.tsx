'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  FileText, AlertTriangle, CheckCircle2, Clock, Upload,
  XCircle, Search, X, Eye, ThumbsUp, ThumbsDown, Trash2,
  Shield, FileWarning, FileCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Doc {
  id: string; label: string; category: string; ownerType: string; ownerId: string;
  status: string; expiresAt?: string; issuedAt?: string; issuer?: string;
  documentNumber?: string; fileUrl?: string; fileMimeType?: string;
  rejectionReason?: string; reviewedAt?: string; createdAt: string;
}

interface Compliance {
  expired: number; expiring30: number; expiring7: number;
  pendingReview: number; verified: number; pendingUpload: number;
  criticalDocs: Doc[];
}

const STATUS_BADGE: Record<string, any> = {
  VERIFIED:       { label: 'Verified',       cls: 'bg-green-100 text-green-800' },
  PENDING_REVIEW: { label: 'Pending Review', cls: 'bg-yellow-100 text-yellow-800' },
  PENDING_UPLOAD: { label: 'Needs Upload',   cls: 'bg-gray-100 text-gray-700' },
  REJECTED:       { label: 'Rejected',       cls: 'bg-red-100 text-red-800' },
  EXPIRED:        { label: 'Expired',        cls: 'bg-red-100 text-red-800' },
  SUPERSEDED:     { label: 'Superseded',     cls: 'bg-gray-100 text-gray-500' },
};

function daysUntil(d?: string) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function ExpiryBadge({ date }: { date?: string }) {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0)  return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Expired {Math.abs(days)}d ago</span>;
  if (days <= 7)  return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium animate-pulse">{days}d left</span>;
  if (days <= 30) return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{days}d left</span>;
  return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{days}d</span>;
}

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [tab, setTab]         = useState<'compliance' | 'all'>('compliance');
  const [search, setSearch]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [rejectModal, setRejectModal]   = useState<Doc | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: compliance } = useQuery<Compliance>({
    queryKey: ['doc-compliance'],
    queryFn:  documentApi.compliance,
  });

  const { data: allDocs = [], isLoading } = useQuery<Doc[]>({
    queryKey: ['documents', filterStatus],
    queryFn:  () => documentApi.list(filterStatus ? { status: filterStatus } : undefined),
    enabled:  tab === 'all',
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => documentApi.verify(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['documents'] }); qc.invalidateQueries({ queryKey: ['doc-compliance'] }); toast.success('Document verified'); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => documentApi.reject(id, reason),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['documents'] }); qc.invalidateQueries({ queryKey: ['doc-compliance'] }); toast.success('Document rejected'); setRejectModal(null); setRejectReason(''); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['documents'] }); qc.invalidateQueries({ queryKey: ['doc-compliance'] }); toast.success('Document deleted'); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const filtered = allDocs.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.label.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.ownerType.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents & Compliance</h1>
        <p className="text-gray-500 text-sm mt-0.5">Track document status, expiry and verification across your fleet</p>
      </div>

      {/* KPI summary */}
      {compliance && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard title="Expired"        value={compliance.expired}       icon={XCircle}       iconBg="bg-red-50"    iconColor="text-red-600" />
          <MetricCard title="Expiring 30d"   value={compliance.expiring30}    icon={FileWarning}   iconBg="bg-amber-50"  iconColor="text-amber-600" />
          <MetricCard title="Expiring 7d"    value={compliance.expiring7}     icon={AlertTriangle} iconBg="bg-orange-50" iconColor="text-orange-600" />
          <MetricCard title="Pending Review" value={compliance.pendingReview} icon={Clock}         iconBg="bg-yellow-50" iconColor="text-yellow-600" />
          <MetricCard title="Verified"       value={compliance.verified}      icon={FileCheck}     iconBg="bg-green-50"  iconColor="text-green-600" />
          <MetricCard title="Needs Upload"   value={compliance.pendingUpload} icon={Upload}        iconBg="bg-gray-50"   iconColor="text-gray-600" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([['compliance', 'Compliance Overview', Shield], ['all', 'All Documents', FileText]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition',
              tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── COMPLIANCE TAB ──────────────────────────────────────────────────── */}
      {tab === 'compliance' && compliance && (
        <div className="space-y-4">
          {compliance.expired > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <XCircle size={20} className="text-red-600 shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">{compliance.expired} expired document{compliance.expired !== 1 ? 's' : ''}</p>
                <p className="text-red-600 text-xs">These documents have passed their expiry date and need immediate renewal.</p>
              </div>
            </div>
          )}
          {compliance.pendingReview > 0 && (
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
              <Clock size={20} className="text-yellow-600 shrink-0" />
              <div>
                <p className="font-semibold text-yellow-800 text-sm">{compliance.pendingReview} document{compliance.pendingReview !== 1 ? 's' : ''} awaiting review</p>
                <p className="text-yellow-600 text-xs">These have been uploaded but not yet verified by an authorized reviewer.</p>
              </div>
            </div>
          )}

          {compliance.criticalDocs.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-sm">Documents Expiring Within 30 Days</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {compliance.criticalDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition">
                    <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{doc.label}</p>
                      <p className="text-xs text-gray-400">{doc.category.replace(/_/g, ' ')} · {doc.ownerType}</p>
                    </div>
                    <ExpiryBadge date={doc.expiresAt} />
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[doc.status]?.cls ?? 'bg-gray-100 text-gray-700')}>
                      {STATUS_BADGE[doc.status]?.label ?? doc.status}
                    </span>
                    {doc.fileUrl && (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                        <Eye size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
              <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">All documents are valid</p>
              <p className="text-gray-400 text-sm mt-1">No documents are expiring within the next 30 days.</p>
            </div>
          )}
        </div>
      )}

      {/* ── ALL DOCUMENTS TAB ────────────────────────────────────────────────── */}
      {tab === 'all' && (
        <>
          <div className="flex gap-3 flex-wrap">
            <div className="relative max-w-xs flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="w-full pl-8 pr-7 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={13} /></button>}
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="">All statuses</option>
              {Object.keys(STATUS_BADGE).map(s => <option key={s} value={s}>{STATUS_BADGE[s].label}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Document', 'Category', 'Owner', 'Expires', 'Status', 'Actions'].map(h =>
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading
                    ? [...Array(5)].map((_, i) => <tr key={i} className="animate-pulse">{[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4" /></td>)}</tr>)
                    : filtered.length === 0
                      ? <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm"><FileText size={32} className="mx-auto mb-2 opacity-30" />No documents found.</td></tr>
                      : filtered.map(doc => (
                          <tr key={doc.id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                                  <FileText size={14} className="text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-gray-900">{doc.label}</p>
                                  {doc.documentNumber && <p className="text-xs text-gray-400">#{doc.documentNumber}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{doc.category.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{doc.ownerType}</td>
                            <td className="px-4 py-3">
                              {doc.expiresAt ? (
                                <div className="space-y-0.5">
                                  <p className="text-xs text-gray-500">{formatDate(doc.expiresAt)}</p>
                                  <ExpiryBadge date={doc.expiresAt} />
                                </div>
                              ) : <span className="text-xs text-gray-400">No expiry</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn('text-xs px-2 py-1 rounded-full font-medium', STATUS_BADGE[doc.status]?.cls ?? 'bg-gray-100 text-gray-700')}>
                                {STATUS_BADGE[doc.status]?.label ?? doc.status}
                              </span>
                              {doc.rejectionReason && <p className="text-xs text-red-500 mt-0.5">{doc.rejectionReason}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {doc.fileUrl && (
                                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View">
                                    <Eye size={14} />
                                  </a>
                                )}
                                {doc.status === 'PENDING_REVIEW' && (
                                  <>
                                    <button onClick={() => verifyMutation.mutate(doc.id)}
                                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition" title="Verify">
                                      <ThumbsUp size={14} />
                                    </button>
                                    <button onClick={() => { setRejectModal(doc); setRejectReason(''); }}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Reject">
                                      <ThumbsDown size={14} />
                                    </button>
                                  </>
                                )}
                                <button onClick={() => { if (confirm('Delete this document?')) deleteMutation.mutate(doc.id); }}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-1">Reject Document</h2>
            <p className="text-sm text-gray-500 mb-4">{rejectModal.label}</p>
            <textarea
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder="Reason for rejection…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
