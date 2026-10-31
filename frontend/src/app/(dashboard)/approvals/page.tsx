'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi, platformApi, requisitionApi, financialApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { CheckSquare, Clock, CheckCircle2, XCircle, Building2, X, AlertTriangle, WalletCards, DollarSign } from 'lucide-react';

type TabId = 'pending-orgs' | 'finance-approvals' | 'tickets';

export default function ApprovalsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const rawRoles = Array.isArray(user?.roles) ? user.roles : user ? [user.role] : [];
  const canManageRegistrations = rawRoles.includes('SUPER_ADMIN') || rawRoles.includes('ADMIN');
  const isFinanceApprover = rawRoles.includes('FINANCE_MANAGER') || rawRoles.includes('SUPER_ADMIN') || rawRoles.includes('ADMIN');
  const [tab, setTab] = useState<TabId>(isFinanceApprover ? 'finance-approvals' : 'pending-orgs');
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: pendingOrgs = [], isLoading: orgsLoading } = useQuery({
    queryKey: ['pending-orgs'],
    queryFn: supportApi.pendingOrgs,
    enabled: canManageRegistrations,
  });

  const { data: financeApprovals = { data: [] }, isLoading: financeLoading } = useQuery({
    queryKey: ['finance-approval-queue'],
    queryFn: () => requisitionApi.list({ status: 'SUBMITTED' }),
    enabled: isFinanceApprover,
  });

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const { data: payrollQueue = { data: [] }, isLoading: payrollLoading } = useQuery({
    queryKey: ['finance-payroll-queue', currentMonth, currentYear],
    queryFn: () => financialApi.payroll({ month: currentMonth, year: currentYear }),
    enabled: isFinanceApprover,
  });

  const { data: payoutQueue = { data: [] }, isLoading: payoutLoading } = useQuery({
    queryKey: ['finance-owner-payout-queue'],
    queryFn: () => financialApi.ownerPayouts(),
    enabled: isFinanceApprover,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => supportApi.allTickets(),
    enabled: canManageRegistrations,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: platformApi.plans,
    enabled: rawRoles.includes('SUPER_ADMIN'),
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

  const requisitionApprove = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => requisitionApi.approve(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-approval-queue'] });
      toast.success('Requisition approved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Approval failed'),
  });

  const requisitionReject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => requisitionApi.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-approval-queue'] });
      toast.success('Requisition rejected');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Rejection failed'),
  });

  const openTickets = (tickets as any[]).filter((t: any) => t.status === 'OPEN').length;
  const requisitionQueue = (financeApprovals as any)?.data ?? [];
  const payrollItems = (payrollQueue as any)?.data ?? [];
  const ownerPayoutItems = (payoutQueue as any)?.data ?? [];
  const financeQueue = [
    ...requisitionQueue.map((item: any) => ({ ...item, queueType: 'REQUISITION' })),
    ...payrollItems
      .filter((item: any) => (item.status ?? '').toString().toUpperCase() !== 'PAID')
      .map((item: any) => ({
        id: item.id,
        queueType: 'PAYROLL',
        amount: Number(item.net ?? 0),
        requester: { firstName: 'Payroll', lastName: 'Run', email: item.email ?? 'n/a' },
        type: 'PAYROLL_RUN',
        reason: `${item.driverName} • ${item.vehicle} • net ${Number(item.net ?? 0).toLocaleString()} RWF`,
        neededBy: null,
        status: item.status,
      })),
    ...ownerPayoutItems.map((item: any) => ({
      id: item.ownerId,
      queueType: 'OWNER_PAYOUT',
      amount: Number(item.netPayout ?? 0),
      requester: { firstName: 'Owner', lastName: 'Settlement', email: item.email ?? 'n/a' },
      type: 'OWNER_PAYOUT',
      reason: `${item.ownerName} • ${item.vehicleCount} vehicle(s) • ${Number(item.netPayout ?? 0).toLocaleString()} RWF`,
      neededBy: null,
      status: 'PENDING',
    })),
  ];

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
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {canManageRegistrations && (
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
        )}
        {isFinanceApprover && (
          <button onClick={() => setTab('finance-approvals')}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition relative',
              tab === 'finance-approvals' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            <DollarSign size={14} /> Finance Queue
            {financeQueue.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center px-1 font-bold">
                {financeQueue.length}
              </span>
            )}
          </button>
        )}
        {canManageRegistrations && (
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
        )}
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

      {tab === 'finance-approvals' && isFinanceApprover && (
        <div className="space-y-3">
          {financeLoading || payrollLoading || payoutLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : financeQueue.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <WalletCards size={36} className="text-emerald-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-600">No pending finance items</p>
              <p className="text-gray-400 text-sm mt-1">All requisitions, payroll, and owner payouts are clear.</p>
            </div>
          ) : financeQueue.map((item: any) => (
            <div key={`${item.queueType}-${item.id}`} className="bg-white rounded-xl border border-emerald-200 shadow-sm p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{item.queueType === 'PAYROLL' ? 'PAYROLL' : item.queueType === 'OWNER_PAYOUT' ? 'OWNER PAYOUT' : item.status}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">{(item.type ?? item.queueType).replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{Number(item.amount ?? 0).toLocaleString()} RWF</p>
                  <p className="text-sm text-gray-600">{item.requester?.firstName} {item.requester?.lastName} · {item.requester?.email}</p>
                  {item.neededBy && (
                    <p className="text-xs text-gray-500 mt-1">Needed {formatDate(new Date(item.neededBy))}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {item.queueType === 'REQUISITION' ? (
                    <>
                      <button
                        onClick={() => requisitionApprove.mutate({ id: item.id, notes: 'Approved from approvals queue' })}
                        disabled={requisitionApprove.isPending}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-60">
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button
                        onClick={() => requisitionReject.mutate({ id: item.id, reason: 'Rejected from approvals queue' })}
                        disabled={requisitionReject.isPending}
                        className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-60">
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => toast.success(`${item.queueType === 'PAYROLL' ? 'Payroll' : 'Owner payout'} item reviewed`)}
                      className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition">
                      <CheckCircle2 size={14} /> Review
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                <p className="font-medium text-gray-700">Reason</p>
                <p>{item.reason}</p>
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
