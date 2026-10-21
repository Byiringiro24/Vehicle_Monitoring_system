'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agreementApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, FileText, CheckCircle2, Clock, AlertTriangle,
  DollarSign, Car, Users, Calendar, X, CreditCard, ChevronDown,
  ChevronRight, PlayCircle, Loader2, Receipt,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScheduledPayment {
  id: string; periodLabel: string; dueDate: string;
  amountDue: number; amountPaid: number; currency: string;
  status: string; lateFee: number; paidAt?: string; notes?: string;
}

interface PaymentRecord {
  id: string; amount: number; currency: string; paidAt: string;
  method: string; reference?: string; notes?: string;
}

interface Agreement {
  id: string; title: string; agreementNumber: string; modelType: string;
  status: string; currency: string; rateAmount: number; ratePeriod: string;
  depositAmount: number; depositPaid: number; totalValue?: number;
  installmentCount?: number; totalPaid: number; totalBalance: number; overdueAmount: number;
  startDate: string; endDate?: string; expectedEndDate?: string; signedAt?: string; notes?: string;
  vehicle:  { id: string; name: string; licensePlate: string; manufacturer: string; model: string };
  customer: { id: string; name: string; phone: string; email?: string };
  businessModel?: { name: string; modelType: string };
  scheduledPayments: ScheduledPayment[];
  paymentRecords:    PaymentRecord[];
}

// ─── Status config ────────────────────────────────────────────────────────────
const SP_STATUS: Record<string, { cls: string; icon: JSX.Element; label: string }> = {
  PENDING:   { cls: 'bg-gray-100 text-gray-700',   icon: <Clock size={12} />,         label: 'Pending' },
  PAID:      { cls: 'bg-green-100 text-green-800',  icon: <CheckCircle2 size={12} />,  label: 'Paid' },
  PARTIAL:   { cls: 'bg-blue-100 text-blue-800',    icon: <ChevronDown size={12} />,   label: 'Partial' },
  OVERDUE:   { cls: 'bg-red-100 text-red-800',      icon: <AlertTriangle size={12} />, label: 'Overdue' },
  WAIVED:    { cls: 'bg-purple-100 text-purple-700',icon: <X size={12} />,             label: 'Waived' },
  CANCELLED: { cls: 'bg-gray-100 text-gray-500',    icon: <X size={12} />,             label: 'Cancelled' },
};

const AG_STATUS: Record<string, string> = {
  DRAFT:             'bg-gray-100 text-gray-700',
  ACTIVE:            'bg-green-100 text-green-800',
  COMPLETED:         'bg-blue-100 text-blue-800',
  DEFAULTED:         'bg-red-100 text-red-800',
  TERMINATED:        'bg-red-100 text-red-700',
  SUSPENDED:         'bg-amber-100 text-amber-800',
  PENDING_SIGNATURE: 'bg-yellow-100 text-yellow-800',
};

const METHODS = ['CASH','MOBILE_MONEY','BANK','CARD','OTHER'];

// ─── Payment form schema ──────────────────────────────────────────────────────
const paySchema = z.object({
  amount:     z.coerce.number().min(1, 'Amount must be > 0'),
  method:     z.string().default('CASH'),
  reference:  z.string().optional(),
  notes:      z.string().optional(),
  paidAt:     z.string().optional(),
});
type PayForm = z.infer<typeof paySchema>;

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{pct.toFixed(0)}% paid</span>
        <span>{paid.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : 'bg-amber-400')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AgreementDetailPage({ params }: { params: { id: string } }) {
  const qc = useQueryClient();
  const [payingId, setPayingId]     = useState<string | null>(null); // scheduledPaymentId being paid
  const [showPayModal, setShowPayModal] = useState(false);
  const [activeTab, setActiveTab]   = useState<'schedule' | 'payments' | 'details'>('schedule');

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: agreement, isLoading } = useQuery<Agreement>({
    queryKey: ['agreement', params.id],
    queryFn:  () => agreementApi.get(params.id),
  });

  const { data: payData } = useQuery({
    queryKey: ['agreement-payments', params.id],
    queryFn:  () => agreementApi.payments(params.id),
    enabled: activeTab === 'payments',
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const activateMutation = useMutation({
    mutationFn: () => agreementApi.activate(params.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreement', params.id] });
      qc.invalidateQueries({ queryKey: ['agreements'] });
      toast.success('Agreement activated — payment schedule generated');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => agreementApi.update(params.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreement', params.id] });
      qc.invalidateQueries({ queryKey: ['agreements'] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const recordMutation = useMutation({
    mutationFn: (d: PayForm & { scheduledPaymentId?: string }) =>
      agreementApi.recordPayment(params.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreement', params.id] });
      qc.invalidateQueries({ queryKey: ['agreement-payments', params.id] });
      qc.invalidateQueries({ queryKey: ['agreements'] });
      toast.success('Payment recorded');
      setShowPayModal(false);
      setPayingId(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  // ── Form ──────────────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<PayForm>({ resolver: zodResolver(paySchema), defaultValues: { method: 'CASH' } });

  function openPayModal(sp?: ScheduledPayment) {
    reset({ method: 'CASH', paidAt: new Date().toISOString().split('T')[0] });
    if (sp) {
      setPayingId(sp.id);
      setValue('amount', sp.amountDue - sp.amountPaid);
    } else {
      setPayingId(null);
    }
    setShowPayModal(true);
  }

  if (isLoading || !agreement) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-40 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const schedule   = agreement.scheduledPayments ?? [];
  const overdueSPs = schedule.filter(s => s.status === 'OVERDUE');
  const pendingSPs = schedule.filter(s => s.status === 'PENDING');
  const paidSPs    = schedule.filter(s => s.status === 'PAID');
  const totalDue   = schedule.reduce((s, p) => s + p.amountDue, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/agreements" className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500 shrink-0 mt-0.5">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{agreement.title}</h1>
            <span className={cn('text-xs px-2 py-1 rounded-full font-medium', AG_STATUS[agreement.status] ?? 'bg-gray-100')}>
              {agreement.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5 font-mono">#{agreement.agreementNumber.slice(0, 8).toUpperCase()}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {agreement.status === 'DRAFT' && (
            <button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60"
            >
              {activateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
              Activate
            </button>
          )}
          {agreement.status === 'ACTIVE' && (
            <button
              onClick={() => openPayModal()}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <CreditCard size={15} /> Record Payment
            </button>
          )}
          {['ACTIVE','DRAFT'].includes(agreement.status) && (
            <select
              onChange={e => { if (e.target.value) statusMutation.mutate(e.target.value); }}
              defaultValue=""
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="" disabled>Change status…</option>
              {['SUSPENDED','TERMINATED','COMPLETED'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Overdue warning */}
      {overdueSPs.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-red-600 shrink-0" />
          <div>
            <p className="font-semibold text-red-800 text-sm">{overdueSPs.length} overdue payment{overdueSPs.length !== 1 ? 's' : ''}</p>
            <p className="text-red-600 text-xs">Total overdue: {agreement.currency} {agreement.overdueAmount.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Car size={13} /> Vehicle</div>
          <p className="font-semibold text-gray-900">{agreement.vehicle.licensePlate}</p>
          <p className="text-xs text-gray-400">{agreement.vehicle.manufacturer} {agreement.vehicle.model}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Users size={13} /> Customer</div>
          <p className="font-semibold text-gray-900">{agreement.customer.name}</p>
          <p className="text-xs text-gray-400">{agreement.customer.phone}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><DollarSign size={13} /> Rate</div>
          <p className="font-semibold text-gray-900">{agreement.currency} {agreement.rateAmount.toLocaleString()}</p>
          <p className="text-xs text-gray-400">per {agreement.ratePeriod}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Calendar size={13} /> Period</div>
          <p className="font-semibold text-gray-900">{formatDate(agreement.startDate)}</p>
          <p className="text-xs text-gray-400">{agreement.endDate ? `→ ${formatDate(agreement.endDate)}` : 'Open-ended'}</p>
        </div>
      </div>

      {/* Payment progress */}
      {totalDue > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">Payment Progress</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full inline-block" />{paidSPs.length} paid</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-full inline-block" />{pendingSPs.length} pending</span>
              {overdueSPs.length > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full inline-block" />{overdueSPs.length} overdue</span>}
            </div>
          </div>
          <ProgressBar paid={agreement.totalPaid} total={totalDue} />
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-gray-500">Collected</span>
            <span className="font-semibold text-green-700">{agreement.currency} {agreement.totalPaid.toLocaleString()}</span>
          </div>
          {agreement.totalBalance > 0 && (
            <div className="flex items-center justify-between mt-1 text-sm">
              <span className="text-gray-500">Remaining</span>
              <span className="font-semibold text-gray-800">{agreement.currency} {agreement.totalBalance.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 -mx-0">
        {([['schedule','Payment Schedule',FileText],['payments','Payment History',Receipt],['details','Details',DollarSign]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px whitespace-nowrap',
              activeTab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── SCHEDULE TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {schedule.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No payment schedule yet</p>
              <p className="text-gray-400 text-xs mt-1">
                {agreement.status === 'DRAFT'
                  ? 'Activate the agreement to generate the payment schedule automatically.'
                  : 'Payment schedule will appear here once the agreement is activated.'}
              </p>
              {agreement.status === 'DRAFT' && (
                <button onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}
                  className="mt-4 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition mx-auto disabled:opacity-60">
                  {activateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                  Activate now
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Period','Due Date','Amount Due','Paid','Status','Late Fee',''].map(h =>
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedule.map(sp => {
                    const st = SP_STATUS[sp.status] ?? SP_STATUS.PENDING;
                    const outstanding = sp.amountDue - sp.amountPaid;
                    return (
                      <tr key={sp.id} className={cn('hover:bg-gray-50 transition', sp.status === 'OVERDUE' && 'bg-red-50/30')}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{sp.periodLabel}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(sp.dueDate)}</td>
                        <td className="px-4 py-3 text-sm font-medium">{sp.currency} {sp.amountDue.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-green-700">{sp.amountPaid > 0 ? `${sp.currency} ${sp.amountPaid.toLocaleString()}` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium', st.cls)}>
                            {st.icon} {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-red-600">{sp.lateFee > 0 ? `+${sp.lateFee.toLocaleString()}` : '—'}</td>
                        <td className="px-4 py-3">
                          {['PENDING','PARTIAL','OVERDUE'].includes(sp.status) && agreement.status === 'ACTIVE' && (
                            <button
                              onClick={() => openPayModal(sp)}
                              className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                            >
                              <CreditCard size={11} /> Pay {outstanding > 0 ? `(${outstanding.toLocaleString()})` : ''}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENTS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          {payData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Due',    value: `${agreement.currency} ${(payData.summary?.totalDue ?? 0).toLocaleString()}`,    cls: 'text-gray-800' },
                { label: 'Total Paid',   value: `${agreement.currency} ${(payData.summary?.totalPaid ?? 0).toLocaleString()}`,   cls: 'text-green-700' },
                { label: 'Outstanding',  value: `${agreement.currency} ${(payData.summary?.outstanding ?? 0).toLocaleString()}`, cls: 'text-blue-700' },
                { label: 'Overdue',      value: `${agreement.currency} ${(payData.summary?.overdue ?? 0).toLocaleString()}`,     cls: 'text-red-700' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className={cn('font-bold text-lg', c.cls)}>{c.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {!payData?.records?.length ? (
              <div className="p-10 text-center text-gray-400 text-sm">
                <Receipt size={32} className="mx-auto mb-2 opacity-20" />
                No payment records yet.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Date','Amount','Method','Reference','Notes'].map(h =>
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payData.records.map((r: PaymentRecord) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(r.paidAt)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-700">{r.currency} {r.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">{r.method}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">{r.reference ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{r.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── DETAILS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Agreement Number', value: agreement.agreementNumber },
            { label: 'Business Model',   value: agreement.businessModel?.name ?? agreement.modelType.replace(/_/g,' ') },
            { label: 'Currency',         value: agreement.currency },
            { label: 'Deposit Required', value: `${agreement.currency} ${agreement.depositAmount.toLocaleString()}` },
            { label: 'Deposit Paid',     value: `${agreement.currency} ${agreement.depositPaid.toLocaleString()}` },
            { label: 'Total Value',      value: agreement.totalValue ? `${agreement.currency} ${agreement.totalValue.toLocaleString()}` : '—' },
            { label: 'Installments',     value: agreement.installmentCount?.toString() ?? '—' },
            { label: 'Start Date',       value: formatDate(agreement.startDate) },
            { label: 'Expected End',     value: agreement.expectedEndDate ? formatDate(agreement.expectedEndDate) : '—' },
            { label: 'Signed At',        value: agreement.signedAt ? formatDate(agreement.signedAt) : 'Not signed' },
          ].map(row => (
            <div key={row.label} className="bg-white rounded-xl border border-gray-200 p-4 flex justify-between items-center">
              <span className="text-sm text-gray-500">{row.label}</span>
              <span className="text-sm font-medium text-gray-900">{row.value}</span>
            </div>
          ))}
          {agreement.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:col-span-2">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-800">{agreement.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Record Payment Modal ─────────────────────────────────────────────── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Record Payment</h2>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {payingId && (
              <div className="bg-blue-50 rounded-lg p-3 mb-4 text-xs text-blue-800">
                Linked to: <strong>{schedule.find(s => s.id === payingId)?.periodLabel}</strong>
              </div>
            )}

            <form onSubmit={handleSubmit(d => recordMutation.mutate({ ...d, scheduledPaymentId: payingId ?? undefined }))} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({agreement.currency}) *</label>
                <input type="number" {...register('amount')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                  <select {...register('method')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    {METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" {...register('paidAt')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Receipt #</label>
                <input {...register('reference')} placeholder="Mobile money code, receipt number…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input {...register('notes')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPayModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={isSubmitting || recordMutation.isPending}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2">
                  {(isSubmitting || recordMutation.isPending) ? <Loader2 size={14} className="animate-spin" /> : null}
                  {recordMutation.isPending ? 'Saving…' : 'Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
