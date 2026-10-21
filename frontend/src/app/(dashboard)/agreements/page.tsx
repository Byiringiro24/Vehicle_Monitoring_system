'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agreementApi, vehicleApi } from '@/lib/api';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Plus, FileText, Search, X, ChevronRight, CheckCircle2,
  AlertTriangle, Clock, DollarSign, Calendar, Car, Users,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MetricCard } from '@/components/ui/MetricCard';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Agreement {
  id: string; title: string; agreementNumber: string; modelType: string;
  status: string; currency: string; rateAmount: number; ratePeriod: string;
  startDate: string; endDate?: string; totalPaid: number; totalBalance: number;
  overdueAmount: number;
  vehicle: { id: string; name: string; licensePlate: string };
  customer: { id: string; name: string; phone: string };
  businessModel?: { name: string };
  _count: { scheduledPayments: number; paymentRecords: number };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:             'bg-gray-100 text-gray-700',
  ACTIVE:            'bg-green-100 text-green-800',
  COMPLETED:         'bg-blue-100 text-blue-800',
  DEFAULTED:         'bg-red-100 text-red-800',
  TERMINATED:        'bg-red-100 text-red-700',
  SUSPENDED:         'bg-amber-100 text-amber-800',
  PENDING_SIGNATURE: 'bg-yellow-100 text-yellow-800',
};

// ─── New Agreement Schema ─────────────────────────────────────────────────────
const createSchema = z.object({
  title:            z.string().min(1, 'Required'),
  vehicleId:        z.string().min(1, 'Required'),
  customerId:       z.string().min(1, 'Required'),
  businessModelId:  z.string().optional(),
  modelType:        z.string().default('CUSTOM'),
  currency:         z.string().default('RWF'),
  rateAmount:       z.coerce.number().min(1, 'Must be > 0'),
  ratePeriod:       z.string().default('daily'),
  depositAmount:    z.coerce.number().default(0),
  totalValue:       z.coerce.number().optional(),
  installmentCount: z.coerce.number().optional(),
  startDate:        z.string().min(1, 'Required'),
  endDate:          z.string().optional(),
  notes:            z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const RATE_PERIODS = ['hourly','daily','weekly','monthly','per_trip','custom'];
const MODEL_TYPES  = ['DAILY_RENTAL','WEEKLY_RENTAL','MONTHLY_RENTAL','ANNUAL_RENTAL','LEASE_TO_OWN','VEHICLE_SALE','DRIVER_SERVICE','TRANSPORT_CONTRACT','FLEET_MANAGEMENT','CUSTOM'];

export default function AgreementsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: agData, isLoading } = useQuery({
    queryKey: ['agreements', filterStatus],
    queryFn:  () => agreementApi.list(filterStatus ? { status: filterStatus } : undefined),
  });
  const agreements: Agreement[] = agData?.data ?? [];

  const { data: businessModels = [] } = useQuery({
    queryKey: ['business-models'],
    queryFn:  agreementApi.businessModels,
    enabled: showModal,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-mini'],
    queryFn:  () => vehicleApi.list({ limit: 200 }),
    select:   (d: any) => d.data ?? d,
    enabled: showModal,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn:  () => apiClient.get('/contracts/customers').then(r => r.data),
    enabled: showModal,
  });

  // ── Summary stats ─────────────────────────────────────────────────────────
  const active    = agreements.filter(a => a.status === 'ACTIVE').length;
  const overdue   = agreements.filter(a => a.overdueAmount > 0);
  const totalPaid = agreements.reduce((s, a) => s + a.totalPaid, 0);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => agreementApi.create(d),
    onSuccess: (agreement) => {
      qc.invalidateQueries({ queryKey: ['agreements'] });
      toast.success('Agreement created');
      setShowModal(false);
      router.push(`/agreements/${agreement.id}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { currency: 'RWF', ratePeriod: 'daily', depositAmount: 0 } });

  function applyModel(model: any) {
    setSelectedModel(model);
    setValue('businessModelId', model.id);
    setValue('modelType',       model.modelType);
    setValue('rateAmount',      model.rateAmount);
    setValue('ratePeriod',      model.ratePeriod);
    setValue('depositAmount',   model.depositAmount);
    setValue('currency',        model.currency);
  }

  const filtered = agreements.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.title.toLowerCase().includes(q)
      || a.customer.name.toLowerCase().includes(q)
      || a.vehicle.licensePlate.toLowerCase().includes(q)
      || a.agreementNumber.includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Agreements</h1>
          <p className="text-gray-500 text-sm mt-0.5">Vehicle rentals, hire-purchase, leases and transport contracts</p>
        </div>
        <button onClick={() => { reset(); setSelectedModel(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> New Agreement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Active Agreements"  value={active}                         icon={FileText}    iconBg="bg-green-50"  iconColor="text-green-600" />
        <MetricCard title="Overdue Accounts"   value={overdue.length}                 icon={AlertTriangle} iconBg="bg-red-50"  iconColor="text-red-600" />
        <MetricCard title="Total Collected"    value={`${totalPaid.toLocaleString()}`} icon={DollarSign} iconBg="bg-blue-50"   iconColor="text-blue-600" />
        <MetricCard title="Total Agreements"   value={agreements.length}              icon={Calendar}    iconBg="bg-purple-50" iconColor="text-purple-600" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search agreements…"
            className="w-full pl-8 pr-7 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={13} /></button>}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Agreements list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No agreements found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Agreement','Vehicle','Customer','Period','Status','Paid','Balance',''].map(h =>
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => router.push(`/agreements/${a.id}`)}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{a.title}</p>
                        <p className="text-xs text-gray-400">{a.modelType.replace(/_/g, ' ')} · #{a.agreementNumber.slice(0,8)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Car size={13} className="text-gray-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{a.vehicle.licensePlate}</p>
                          <p className="text-xs text-gray-400">{a.vehicle.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Users size={13} className="text-gray-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{a.customer.name}</p>
                          <p className="text-xs text-gray-400">{a.customer.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-800">{a.currency} {a.rateAmount.toLocaleString()} / {a.ratePeriod}</p>
                      <p className="text-xs text-gray-400">{formatDate(a.startDate)}{a.endDate ? ` → ${formatDate(a.endDate)}` : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full font-medium', STATUS_COLORS[a.status] ?? 'bg-gray-100')}>
                        {a.status.replace(/_/g, ' ')}
                      </span>
                      {a.overdueAmount > 0 && (
                        <p className="text-xs text-red-600 mt-0.5">⚠ {a.currency} {a.overdueAmount.toLocaleString()} overdue</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-700 font-medium">{a.currency} {a.totalPaid.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{a.totalBalance > 0 ? `${a.currency} ${a.totalBalance.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3"><ChevronRight size={15} className="text-gray-300" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Agreement Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold">New Agreement</h2>
                <p className="text-sm text-gray-500">Choose a template or configure manually</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {/* Business model picker */}
            {businessModels.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 mb-2">Quick templates</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {businessModels.slice(0, 6).map((m: any) => (
                    <button key={m.id} onClick={() => applyModel(m)}
                      className={cn('text-left p-3 rounded-xl border text-xs transition',
                        selectedModel?.id === m.id
                          ? 'border-brand-500 bg-brand-50 text-brand-800'
                          : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50 text-gray-700')}>
                      <p className="font-semibold truncate">{m.name}</p>
                      <p className="text-gray-400 mt-0.5">{m.currency} {m.rateAmount.toLocaleString()} / {m.ratePeriod}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agreement Title *</label>
                <input {...register('title')} placeholder="e.g. Daily Motorbike — Kagabo Jean"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle *</label>
                  <select {...register('vehicleId')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="">Select vehicle…</option>
                    {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.licensePlate} — {v.name}</option>)}
                  </select>
                  {errors.vehicleId && <p className="text-red-500 text-xs mt-1">{errors.vehicleId.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                  <select {...register('customerId')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="">Select customer…</option>
                    {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                  </select>
                  {errors.customerId && <p className="text-red-500 text-xs mt-1">{errors.customerId.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select {...register('modelType')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    {MODEL_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate (RWF) *</label>
                  <input type="number" {...register('rateAmount')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  {errors.rateAmount && <p className="text-red-500 text-xs mt-1">{errors.rateAmount.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                  <select {...register('ratePeriod')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    {RATE_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deposit</label>
                  <input type="number" {...register('depositAmount')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Value (for hire-purchase)</label>
                  <input type="number" {...register('totalValue')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"># Installments</label>
                  <input type="number" {...register('installmentCount')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input type="date" {...register('startDate')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label>
                  <input type="date" {...register('endDate')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2">
                  {(isSubmitting || createMutation.isPending) ? <><Loader2 size={15} className="animate-spin" />Creating…</> : 'Create Agreement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
