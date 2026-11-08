'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Bike, User, Phone, MapPin, FileText, DollarSign,
  AlertTriangle, Edit2, Save, X, Loader2, CheckCircle2,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PAID:    'bg-green-100 text-green-700',
  DEBT:    'bg-red-100 text-red-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-gray-100 text-gray-500',
};

// ── Assign bike modal ─────────────────────────────────────────────────────────
function AssignBikeModal({ driver, onClose }: { driver: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [plate, setPlate]  = useState(driver.plateNumber ?? '');
  const [model, setModel]  = useState(driver.bikeModel ?? '');

  const mutation = useMutation({
    mutationFn: () => motoApi.assignBike(driver.id, { plateNumber: plate || undefined, bikeModel: model || undefined }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['moto-driver', driver.id] });
      qc.invalidateQueries({ queryKey: ['moto-drivers-list'] });
      toast.success(data.message ?? 'Bike updated');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bike size={18} className="text-brand-600" /> Assign / Change Bike
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-400">
          If this plate is already assigned to another driver, it will be automatically transferred.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Plate number</label>
            <input value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="e.g. RAE 123 A"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bike model</label>
            <input value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Bajaj Boxer 150"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2">
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {mutation.isPending ? 'Saving…' : 'Assign Bike'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit driver modal ─────────────────────────────────────────────────────────
function EditDriverModal({ driver, onClose }: { driver: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName:      driver.firstName      ?? '',
    lastName:       driver.lastName       ?? '',
    phone:          driver.phone          ?? '',
    altPhone:       driver.altPhone       ?? '',
    nationalId:     driver.nationalId     ?? '',
    licenseNumber:  driver.licenseNumber  ?? '',
    licenseClass:   driver.licenseClass   ?? 'B',
    address:        driver.address        ?? '',
    referral1Name:  driver.referral1Name  ?? '',
    referral1Phone: driver.referral1Phone ?? '',
    referral2Name:  driver.referral2Name  ?? '',
    referral2Phone: driver.referral2Phone ?? '',
    dailyRate:      String(driver.dailyRate  ?? 6000),
    weeklyRate:     String(driver.weeklyRate ?? 42000),
    paymentType:    driver.paymentType    ?? 'DAILY',
    paymentDeadline: driver.paymentDeadline ?? '21:00',
    status:         driver.status         ?? 'ACTIVE',
    notes:          driver.notes          ?? '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => motoApi.updateDriver(driver.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moto-driver', driver.id] });
      qc.invalidateQueries({ queryKey: ['moto-drivers-list'] });
      toast.success('Driver updated');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to update driver'),
  });

  const Field = ({ label, field, type = 'text', placeholder = '' }: {
    label: string; field: keyof typeof form; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={form[field]} onChange={set(field)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5 my-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Edit2 size={16} className="text-brand-600" /> Edit Driver
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {/* Personal info */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Information</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name *"    field="firstName" />
            <Field label="Last name *"     field="lastName" />
            <Field label="Phone *"         field="phone"   type="tel" />
            <Field label="Alt phone"       field="altPhone" type="tel" />
            <Field label="National ID"     field="nationalId" />
            <Field label="License number"  field="licenseNumber" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">License class</label>
              <select value={form.licenseClass} onChange={set('licenseClass')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                {['A', 'B', 'C', 'D', 'A1', 'B1'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={set('status')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                {['ACTIVE', 'INACTIVE', 'SUSPENDED'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Address / Location</label>
              <input value={form.address} onChange={set('address')} placeholder="e.g. Kicukiro, Kigali"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
        </div>

        {/* Referrals */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Referrals / Contract Witnesses</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Referral 1 — Name"  field="referral1Name"  placeholder="Full name" />
            <Field label="Referral 1 — Phone" field="referral1Phone" type="tel" placeholder="07x xxx xxxx" />
            <Field label="Referral 2 — Name"  field="referral2Name"  placeholder="Full name" />
            <Field label="Referral 2 — Phone" field="referral2Phone" type="tel" placeholder="07x xxx xxxx" />
          </div>
        </div>

        {/* Payment config */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Payment Configuration</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Daily rate (RWF)</label>
              <input type="number" value={form.dailyRate} onChange={set('dailyRate')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Weekly rate (RWF)</label>
              <input type="number" value={form.weeklyRate} onChange={set('weeklyRate')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment type</label>
              <select value={form.paymentType} onChange={set('paymentType')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment deadline (time)</label>
              <input type="time" value={form.paymentDeadline} onChange={set('paymentDeadline')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea value={form.notes} onChange={set('notes')} rows={2}
            placeholder="Any additional notes about this driver…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.firstName || !form.lastName || !form.phone}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2">
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MotoDriverDetailPage() {
  const params    = useParams();
  const driverId  = params.id as string;
  const [showEdit, setShowEdit]           = useState(false);
  const [showAssignBike, setShowAssignBike] = useState(false);

  const { data: driver, isLoading } = useQuery({
    queryKey: ['moto-driver', driverId],
    queryFn:  () => motoApi.getDriver(driverId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-10">
        <p className="font-semibold text-gray-600">Driver not found</p>
        <Link href="/moto" className="text-sm text-brand-600 hover:underline mt-2 inline-block">Back to list</Link>
      </div>
    );
  }

  const d: any       = driver;
  const payments: any[] = d.payments ?? [];
  const fines: any[]    = d.fines    ?? [];
  const summary         = d.summary  ?? {};

  return (
    <div className="max-w-3xl space-y-5">
      {/* Modals */}
      {showEdit       && <EditDriverModal   driver={d} onClose={() => setShowEdit(false)} />}
      {showAssignBike && <AssignBikeModal   driver={d} onClose={() => setShowAssignBike(false)} />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/moto"
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500 shrink-0">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{d.firstName} {d.lastName}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {d.plateNumber && (
              <span className="text-xs font-mono font-bold bg-gray-100 px-2 py-0.5 rounded">{d.plateNumber}</span>
            )}
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
              d.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
              d.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500')}>
              {d.status}
            </span>
            <Link href={`/moto/contract/${d.id}`}
              className="text-xs text-brand-600 hover:underline font-medium">View contract →</Link>
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowAssignBike(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition font-medium">
            <Bike size={14} /> Bike
          </button>
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition">
            <Edit2 size={14} /> Edit
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total paid',   value: `RWF ${(summary.totalPaid    ?? 0).toLocaleString()}`,  color: 'text-green-600' },
          { label: 'Expected',     value: `RWF ${(summary.totalExpected ?? 0).toLocaleString()}`, color: 'text-blue-600' },
          { label: 'Current debt', value: `RWF ${(d.totalDebt          ?? 0).toLocaleString()}`,  color: d.totalDebt > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Total fines',  value: `RWF ${(summary.totalFines   ?? 0).toLocaleString()}`,  color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-xs p-4">
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className={`text-lg font-bold tabular ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <User size={14} className="text-brand-600" /> Personal Information
          </h2>
          <button onClick={() => setShowEdit(true)}
            className="text-xs text-brand-600 hover:underline flex items-center gap-1">
            <Edit2 size={11} /> Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            { label: 'Phone',          value: d.phone,          icon: <Phone size={12} /> },
            { label: 'Alt phone',      value: d.altPhone ?? '—', icon: <Phone size={12} /> },
            { label: 'National ID',    value: d.nationalId ?? '—', icon: <FileText size={12} /> },
            { label: 'License no.',    value: d.licenseNumber ?? '—', icon: <FileText size={12} /> },
            { label: 'License class',  value: d.licenseClass ?? '—', icon: <FileText size={12} /> },
            { label: 'Address',        value: d.address ?? '—', icon: <MapPin size={12} /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="flex items-center gap-2 py-1.5 border-b border-gray-50">
              <span className="text-gray-400 shrink-0">{icon}</span>
              <span className="text-gray-500 w-24 shrink-0">{label}:</span>
              <span className="font-medium text-gray-900 truncate">{value}</span>
            </div>
          ))}
        </div>

        {/* Referrals */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Referrals (Contract witnesses)</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-900">{d.referral1Name ?? '—'}</p>
              <p className="text-xs text-gray-400">{d.referral1Phone ?? ''}</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">{d.referral2Name ?? '—'}</p>
              <p className="text-xs text-gray-400">{d.referral2Phone ?? ''}</p>
            </div>
          </div>
        </div>

        {/* Bike assignment */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bike Assignment</p>
            <button onClick={() => setShowAssignBike(true)}
              className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              <Bike size={11} /> {d.plateNumber ? 'Change' : 'Assign'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
              <Bike size={18} className="text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{d.plateNumber ?? 'No bike assigned'}</p>
              <p className="text-xs text-gray-400">
                {d.bikeModel ?? '—'} · Assigned: {d.bikeAssignedAt ? formatDate(d.bikeAssignedAt) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Payment config */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Configuration</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Daily rate</p><p className="font-medium">RWF {(d.dailyRate ?? 0).toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-400">Weekly rate</p><p className="font-medium">RWF {(d.weeklyRate ?? 0).toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-400">Type</p><p className="font-medium">{d.paymentType}</p></div>
          </div>
          {d.notes && (
            <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{d.notes}</p>
          )}
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <DollarSign size={14} className="text-green-600" /> Payment History ({payments.length})
          </h2>
          <Link href="/moto/payments" className="text-xs text-brand-600 hover:underline">Record payment →</Link>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No payments recorded yet</div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  {['Date', 'Expected', 'Paid', 'Via Phone', 'Via Cash', 'Status', 'Debt After'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="px-3 py-2 text-xs tabular text-gray-600">{(p.expectedAmount ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs tabular font-medium text-green-600">{(p.paidAmount ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs tabular text-gray-400">{p.paidViaPhone ? (p.paidViaPhone).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-xs tabular text-gray-400">{p.paidViaCash ? (p.paidViaCash).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-500')}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs tabular">
                      <span className={p.debtAfter > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                        {(p.debtAfter ?? 0).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fines */}
      {fines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" /> Fines ({fines.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {fines.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{f.reason}</p>
                  <p className="text-xs text-gray-400">{formatDate(f.fineDate)} · {f.plateNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-600 tabular">RWF {(f.amount ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">
                    {f.recovered ? '✓ Recovered' : f.paidByCompany ? 'Company paid' : 'Driver owes'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
