'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useParams } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Printer, Save, Truck, Check, Send,
  ShieldCheck, XCircle, Clock, AlertTriangle, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const CONTRACT_STATUS_STYLES: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  DRAFT:            { label: 'Draft',            color: 'text-gray-600',   bg: 'bg-gray-100',   icon: <Clock size={13} /> },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'text-amber-700',  bg: 'bg-amber-100',  icon: <Clock size={13} /> },
  APPROVED:         { label: 'Approved',         color: 'text-green-700',  bg: 'bg-green-100',  icon: <ShieldCheck size={13} /> },
  REJECTED:         { label: 'Rejected',         color: 'text-red-700',    bg: 'bg-red-100',    icon: <XCircle size={13} /> },
};

export default function VehicleContractPage() {
  const params    = useParams();
  const qc        = useQueryClient();
  const { user }  = useAuthStore();
  const driverId  = params.id as string;
  const role      = (user as any)?.role ?? '';
  const isAdmin   = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const canSubmit = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'FLEET_MANAGER' || role === 'FINANCE_MANAGER';

  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  // Rate fields that fleet manager sets when submitting
  const [showRateEditor, setShowRateEditor] = useState(false);
  const [submitDailyRate, setSubmitDailyRate]   = useState('');
  const [submitWeeklyRate, setSubmitWeeklyRate] = useState('');
  const [submitDeadline, setSubmitDeadline]     = useState('');

  const { data: driver, isLoading } = useQuery({
    queryKey: ['vehicle-driver-contract', driverId],
    queryFn: () => motoApi.getDriver(driverId),
  });

  const submitMutation = useMutation({
    mutationFn: () => motoApi.submitContract(
      driverId,
      undefined,
      submitDailyRate ? parseFloat(submitDailyRate) : undefined,
      submitWeeklyRate ? parseFloat(submitWeeklyRate) : undefined,
      submitDeadline || undefined,
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-driver-contract', driverId] }); setShowRateEditor(false); toast.success('Contract submitted for admin approval'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: () => motoApi.approveContract(driverId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-driver-contract', driverId] }); toast.success('Contract approved ✓'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => motoApi.rejectContract(driverId, rejectReason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-driver-contract', driverId] }); setShowRejectBox(false); setRejectReason(''); toast.success('Contract rejected'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  if (isLoading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse max-w-3xl" />;
  if (!driver)   return <div className="text-center py-10">Driver not found</div>;

  const d: any       = driver;
  const orgName      = (user as any)?.organization?.name ?? 'ARTIC VMS Company';
  const today        = new Date();
  const contractSt   = d.contractStatus ?? 'DRAFT';
  const stStyle      = CONTRACT_STATUS_STYLES[contractSt] ?? CONTRACT_STATUS_STYLES.DRAFT;

  return (
    <div className="max-w-3xl space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <Link href={`/vehicle-report/${driverId}`} className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to driver
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status badge */}
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full', stStyle.color, stStyle.bg)}>
            {stStyle.icon} {stStyle.label}
          </span>

          {/* FLEET_MANAGER / ADMIN: submit for approval (if still draft or rejected) */}
          {canSubmit && (contractSt === 'DRAFT' || contractSt === 'REJECTED') && (
            <>
              {/* Rate editor — fleet manager must confirm rate before submitting */}
              {showRateEditor ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="number" value={submitDailyRate} onChange={e => setSubmitDailyRate(e.target.value)}
                    placeholder="Daily rate (RWF)" className="w-36 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                  <input type="number" value={submitWeeklyRate} onChange={e => setSubmitWeeklyRate(e.target.value)}
                    placeholder="Weekly rate" className="w-32 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                  <input type="time" value={submitDeadline} onChange={e => setSubmitDeadline(e.target.value)}
                    placeholder="Deadline" className="w-28 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                  <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !submitDailyRate}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition disabled:opacity-60">
                    {submitMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Confirm & Submit
                  </button>
                  <button onClick={() => setShowRateEditor(false)} className="text-xs text-gray-400 hover:text-gray-600 underline">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowRateEditor(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition disabled:opacity-60">
                  <Send size={13} /> Submit for Approval
                </button>
              )}
            </>
          )}

          {/* ADMIN only: approve / reject (if pending) */}
          {isAdmin && contractSt === 'PENDING_APPROVAL' && (
            <>
              <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-60">
                {approveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                Approve Contract
              </button>
              <button onClick={() => setShowRejectBox(v => !v)}
                className="flex items-center gap-1.5 px-4 py-2 border border-red-300 hover:bg-red-50 text-red-600 text-sm font-medium rounded-xl transition">
                <XCircle size={13} /> Reject
              </button>
            </>
          )}

          {/* Approved banner */}
          {contractSt === 'APPROVED' && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <Check size={14} /> Approved {d.contractApprovedAt ? `on ${formatDate(d.contractApprovedAt)}` : ''}
            </span>
          )}

          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Rejection reason box */}
      {showRejectBox && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 no-print space-y-3">
          <p className="text-sm font-medium text-red-700 flex items-center gap-2">
            <AlertTriangle size={14} /> Reason for rejection (optional — will be saved in notes)
          </p>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
            placeholder="e.g. Missing national ID number, incorrect referral phone…"
            className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-300" />
          <div className="flex gap-2">
            <button onClick={() => setShowRejectBox(false)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}
              className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60 flex items-center gap-1.5">
              {rejectMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
              Confirm Rejection
            </button>
          </div>
        </div>
      )}

      {/* Workflow hint */}
      {contractSt === 'DRAFT' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 no-print flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>
            {canSubmit
              ? 'This contract is a draft. Fill in the driver details, then click "Submit for Approval" to send to the Company Admin for final approval.'
              : 'This contract is a draft and has not been submitted for approval yet.'}
          </span>
        </div>
      )}
      {contractSt === 'REJECTED' && d.contractNotes && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 no-print flex items-start gap-2">
          <XCircle size={15} className="shrink-0 mt-0.5" />
          <span>{d.contractNotes}</span>
        </div>
      )}

      {/* ── Contract document ─────────────────────────────────────────────── */}
      <div id="contract-print" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 print:border-0 print:shadow-none">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
              <Truck size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-gray-900">{orgName}</h1>
          </div>
          <h2 className="text-lg font-bold text-gray-900">AMASEZERANO YO GUKORESHA IMODOKA / MOTO</h2>
          <p className="text-sm text-gray-600">CONTRACT FOR THE USE OF VEHICLE / MOTORCYCLE</p>
          {d.plateNumber && (
            <p className="text-xs font-mono font-bold text-gray-500 mt-1">Plate: {d.plateNumber}</p>
          )}
        </div>

        {/* Parties */}
        <div className="space-y-3 text-sm mb-6">
          <p><strong>Hano hashyizweho (Employer):</strong> {orgName}</p>
          <p><strong>N'umukoresha (Driver):</strong> <span className="font-bold underline">{d.firstName} {d.lastName}</span></p>
          <p><strong>Indangamuntu (National ID):</strong> <span className="underline">{d.nationalId ?? '________________'}</span></p>
          <p><strong>Permis ya gutwara (License no.):</strong> <span className="underline">{d.licenseNumber ?? '________________'}</span> · <strong>Ubwoko:</strong> {d.licenseClass ?? 'B'}</p>
          <p><strong>Telefoni:</strong> <span className="underline">{d.phone ?? '________________'}</span></p>
          <p><strong>Aho atuye (Address):</strong> <span className="underline">{d.address ?? '________________'}</span></p>
        </div>

        {/* Articles */}
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <p className="font-bold">Ingingo ya 1: INTEGO Y'AMASEZERANO (Purpose)</p>
            <p className="mt-1">Urwasezerano rugamije gukoresha imodoka/moto mu gutwara abagenzi (taxi/moto-taxi) gusa. Nta kindi cyo gukoresha bisabwa.</p>
          </div>
          <div>
            <p className="font-bold">Ingingo ya 2: UBYISHYUWE (Payment)</p>
            <p className="mt-1">Umukoresha abyishyura <strong>RWF {(d.dailyRate ?? 0).toLocaleString()}</strong> ku munsi, cyangwa <strong>RWF {(d.weeklyRate ?? 0).toLocaleString()}</strong> mu cyumweru (iminsi 6).</p>
            <p className="mt-1">Amafaranga agomba kumenyekerewa saa <strong>{d.paymentDeadline ?? '21:00'}</strong> z'umugoroba. Igihe atabyishyuye, igisebe gishingwa ku munsi ukurikira.</p>
          </div>
          <div>
            <p className="font-bold">Ingingo ya 3: INSHINGANO ZO KUBUNGA (Maintenance)</p>
            <p className="mt-1">Umukoresha ashinzwe gusukura imodoka/moto, kugenzura inzuzi, amapine, n'ibindi byo kwitabaho ku buri munsi.</p>
          </div>
          <div>
            <p className="font-bold">Ingingo ya 4: GUKORESHA IMODOKA/MOTO (Vehicle Use)</p>
            <p className="mt-1">Imodoka/moto igomba gukoreshwa mu gihugu cy'u Rwanda gusa. Ntibishoboka kuyiguza cyangwa gukoresha abandi bantu batangiwe uburenganzira.</p>
          </div>
          <div>
            <p className="font-bold">Ingingo ya 5: IGIHE CY'AMASEZERANO (Duration)</p>
            <p className="mt-1">Urwasezerano rwa tangira ku itariki: <span className="underline">{d.bikeAssignedAt ? formatDate(d.bikeAssignedAt) : formatDate(today)}</span>. Gusoza bisaba itangazo ry'iminsi 7 mbere y'isanga.</p>
          </div>
          <div>
            <p className="font-bold">Ingingo ya 6: AMAKOSA N'IHAZABU (Fines & Penalties)</p>
            <p className="mt-1">Amakosa y'umuhanda (police fines) yose yishyurwa n'umukoresha. Igihe yishe amabwiriza y'urwasezerano, nyirubwite ashobora kuvanaho imodoka/moto ubundi bwite.</p>
          </div>
        </div>

        {/* Referrals */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="font-bold text-sm text-gray-900 mb-3">Abahamya (Contract Witnesses / Referrals)</p>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p>1. <span className="underline font-medium">{d.referral1Name ?? '________________'}</span></p>
              <p className="text-xs text-gray-500 mt-1">Tel: <span className="underline">{d.referral1Phone ?? '________________'}</span></p>
            </div>
            <div>
              <p>2. <span className="underline font-medium">{d.referral2Name ?? '________________'}</span></p>
              <p className="text-xs text-gray-500 mt-1">Tel: <span className="underline">{d.referral2Phone ?? '________________'}</span></p>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-3 gap-8 text-center text-sm">
          {[
            { title: "Nyir'Ikigo (Employer)", sub: orgName },
            { title: 'Umukoresha (Driver)',  sub: `${d.firstName} ${d.lastName}` },
            { title: 'Umuhamya (Witness)',   sub: 'Witness 1' },
          ].map(({ title, sub }) => (
            <div key={title}>
              <p className="font-medium text-gray-900 text-xs">{title}</p>
              <p className="text-xs text-gray-500">{sub}</p>
              <div className="mt-14 border-t border-gray-400 pt-1">
                <p className="text-xs text-gray-400">Umukono (Signature) & Itariki (Date)</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            Generated by ARTIC VMS · {formatDate(today)} · {orgName}<br />
            Status: <strong>{stStyle.label}</strong>
            {d.contractApprovedAt ? ` — Approved on ${formatDate(d.contractApprovedAt)}` : ''}
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #contract-print, #contract-print * { visibility: visible; }
          #contract-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
