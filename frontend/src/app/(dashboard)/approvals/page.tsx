'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi, platformApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { CheckSquare, Clock, CheckCircle2, XCircle, Building2, X, AlertTriangle } from 'lucide-react';

type TabId = 'pending-orgs' | 'tickets';

export default function ApprovalsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('pending-orgs');
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: pendingOrgs = [], isLoading: orgsLoading } = useQuery({
    queryKey: ['pending-orgs'],
    queryFn: supportApi.pendingOrgs,
    enabled: user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN',
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => supportApi.allTickets(),
    enabled: user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN',
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: platformApi.plans,
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const [selectedPlan, setSelectedPlan] = useState('');

  const approveMutation = useMutation({
    mutationFn: ({ id, planId }: { id: string; planId?: string }) => supportApi.approveOrg(id, planId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-orgs'] }); toast.success('Organization approved!'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => supportApi.rejectOrg(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-orgs'] }); toast.success('Rejected'); setRejectModal(null); setRejectReason(''); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const ticketMutation = useMutation({
    mutationFn: ({ id, status, adminNotes }: any) => supportApi.updateTicket(id, { status, adminNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-tickets'] }); toast.success('Ticket updated'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const openTickets = (tickets as any[]).filter((t: any) => t.status === 'OPEN').length;

  const TICKET_STATUS_COLORS: Record<string, string> = {
    OPEN:        'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-amber-100 text-amber-700',
    RESOLVED:    'bg-green-100 text-green-700',
    CLOSED:      'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {user?.firstName} {user?.lastName}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('pending-orgs')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition relative',
            tab === 'pending-orgs' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
          <Building2 size={14} /> Pending Registrations
          {(pendingOrgs as any[]).length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center px-1 font-bold">
              {(pendingOrgs as any[]).length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('tickets')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition relative',
            tab === 'tickets' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
          <CheckSquare size={14} /> Support Tickets
          {openTickets > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center px-1 font-bold">
              {openTickets}
            </span>
          )}
        </button>
      </div>

      {/* Pending orgs */}
      {tab === 'pending-orgs' && (
        <div className="space-y-4">
          {orgsLoading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : (pendingOrgs as any[]).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <CheckCircle2 size={36} className="text-green-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-600">No pending registrations</p>
              <p className="text-gray-400 text-sm mt-1">All company applications have been reviewed.</p>
            </div>
          ) : (pendingOrgs as any[]).map((org: any) => (
            <div key={org.id} className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                    <Clock size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{org.name}</p>
                    <p className="text-sm text-gray-500">{org.email} · {org.country}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Registered {formatDate(org.createdAt)} · {org._count?.users ?? 0} user(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {user?.role === 'SUPER_ADMIN' && (
                    <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none"
                      value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>
                      <option value="">No plan yet</option>
                      {(plans as any[]).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} — ${p.monthlyPriceUsd}/mo</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => approveMutation.mutate({ id: org.id, planId: selectedPlan || undefined })}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-60">
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button
                    onClick={() => { setRejectModal(org); setRejectReason(''); }}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Support tickets */}
      {tab === 'tickets' && (
        <div className="space-y-3">
          {ticketsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : (tickets as any[]).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <CheckSquare size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="font-semibold text-gray-600">No support tickets yet</p>
            </div>
          ) : (tickets as any[]).map((t: any) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-xs p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TICKET_STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-600')}>
                      {t.status?.replace('_',' ')}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.category}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.priority}</span>
                  </div>
                  <p className="font-semibold text-gray-900">{t.subject}</p>
                  <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{t.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{t.userName} · {t.userEmail} · {formatDate(t.createdAt)}</p>
                </div>
                <select
                  defaultValue={t.status}
                  onChange={e => ticketMutation.mutate({ id: t.id, status: e.target.value, adminNotes: t.adminNotes })}
                  className="px-2 py-1 border border-gray-300 rounded-lg text-xs outline-none shrink-0">
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>
              {t.adminNotes && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500"><strong>Admin reply:</strong> {t.adminNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={18} className="text-red-500" />
              <h2 className="text-lg font-semibold">Reject Registration</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">{rejectModal.name}</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder="Reason for rejection (shown to the applicant)…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason })}
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
