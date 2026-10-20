'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maintenanceApi, vehicleApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Plus, Wrench, Calendar, AlertTriangle, CheckCircle2,
  Clock, Search, X, Pencil, Trash2, Car, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  maintenanceType: string;
  description: string;
  garage?: string;
  mechanicName?: string;
  cost: number;
  currency: string;
  mileageAtService?: number;
  nextServiceDate?: string;
  date: string;
  notes?: string;
  vehicle: { id: string; name: string; licensePlate: string; manufacturer: string; model: string };
}

interface UpcomingVehicle {
  id: string; name: string; licensePlate: string; manufacturer: string; model: string;
  nextServiceDate?: string; inspectionExpiry?: string; insuranceExpiry?: string; roadTaxExpiry?: string;
  odometer: number;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  vehicleId:       z.string().min(1, 'Select a vehicle'),
  maintenanceType: z.string().min(1, 'Required'),
  description:     z.string().min(1, 'Required'),
  garage:          z.string().optional(),
  mechanicName:    z.string().optional(),
  cost:            z.coerce.number().min(0, 'Must be 0 or more'),
  currency:        z.string().default('RWF'),
  mileageAtService:z.coerce.number().optional(),
  nextServiceDate: z.string().optional(),
  date:            z.string().optional(),
  notes:           z.string().optional(),
});
type MaintForm = z.infer<typeof schema>;

const MAINTENANCE_TYPES = [
  'Oil Change', 'Tyre Replacement', 'Brake Service', 'Engine Repair',
  'Transmission Service', 'Battery Replacement', 'AC Service', 'Electrical',
  'Body Repair', 'Inspection', 'Full Service', 'Coolant Flush',
  'Suspension', 'Exhaust', 'Other',
];

// ─── Days until helper ────────────────────────────────────────────────────────
function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function DueBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0)  return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Expired {Math.abs(days)}d ago</span>;
  if (days <= 7)  return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{days}d left</span>;
  if (days <= 30) return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{days}d left</span>;
  return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{days}d left</span>;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const qc = useQueryClient();
  const [tab, setTab]         = useState<'records' | 'upcoming'>('upcoming');
  const [search, setSearch]   = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: recordsData, isLoading: loadingRecords } = useQuery({
    queryKey: ['maintenance'],
    queryFn:  () => maintenanceApi.list(),
    enabled:  tab === 'records',
  });

  const { data: upcoming = [], isLoading: loadingUpcoming } = useQuery<UpcomingVehicle[]>({
    queryKey: ['maintenance', 'upcoming'],
    queryFn:  () => maintenanceApi.upcoming({ days: 60 }),
    enabled:  tab === 'upcoming',
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-mini'],
    queryFn:  () => vehicleApi.list({ limit: 200 }),
    select:   (d: any) => d.data ?? d,
  });

  const records: MaintenanceRecord[] = recordsData?.data ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (d: MaintForm) =>
      editing ? maintenanceApi.update(editing.id, d) : maintenanceApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      toast.success(editing ? 'Record updated' : 'Record created');
      setShowModal(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => maintenanceApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); toast.success('Record deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  // ── Form ──────────────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<MaintForm>({ resolver: zodResolver(schema) });

  function openAdd() {
    reset({ currency: 'RWF', date: new Date().toISOString().split('T')[0] });
    setEditing(null); setShowModal(true);
  }
  function openEdit(r: MaintenanceRecord) {
    reset({
      vehicleId: r.vehicleId, maintenanceType: r.maintenanceType, description: r.description,
      garage: r.garage ?? '', mechanicName: r.mechanicName ?? '', cost: r.cost,
      currency: r.currency, mileageAtService: r.mileageAtService,
      nextServiceDate: r.nextServiceDate ? r.nextServiceDate.split('T')[0] : '',
      date: r.date.split('T')[0], notes: r.notes ?? '',
    });
    setEditing(r); setShowModal(true);
  }

  const filteredUpcoming = upcoming.filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    return v.licensePlate.toLowerCase().includes(q) || v.name.toLowerCase().includes(q) || v.manufacturer.toLowerCase().includes(q);
  });

  const filteredRecords = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.vehicle.licensePlate.toLowerCase().includes(q) || r.maintenanceType.toLowerCase().includes(q) || r.vehicle.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track service records and upcoming maintenance due dates</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> Log Service
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([['upcoming', 'Upcoming', Calendar], ['records', 'Service Records', Wrench]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition',
              tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vehicles…"
          className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
      </div>

      {/* ── UPCOMING TAB ─────────────────────────────────────────────────────── */}
      {tab === 'upcoming' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loadingUpcoming ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading upcoming maintenance…</div>
          ) : filteredUpcoming.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 size={36} className="text-green-400 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No vehicles due for maintenance in the next 60 days.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Vehicle', 'Next Service', 'Inspection', 'Insurance', 'Road Tax', ''].map(h =>
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUpcoming.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                            <Car size={16} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900">{v.licensePlate}</p>
                            <p className="text-xs text-gray-400">{v.manufacturer} {v.model}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {v.nextServiceDate ? (
                          <div className="space-y-0.5">
                            <p className="text-xs text-gray-500">{formatDate(v.nextServiceDate)}</p>
                            <DueBadge days={daysUntil(v.nextServiceDate)} />
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {v.inspectionExpiry ? (
                          <div className="space-y-0.5">
                            <p className="text-xs text-gray-500">{formatDate(v.inspectionExpiry)}</p>
                            <DueBadge days={daysUntil(v.inspectionExpiry)} />
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {v.insuranceExpiry ? (
                          <div className="space-y-0.5">
                            <p className="text-xs text-gray-500">{formatDate(v.insuranceExpiry)}</p>
                            <DueBadge days={daysUntil(v.insuranceExpiry)} />
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {v.roadTaxExpiry ? (
                          <div className="space-y-0.5">
                            <p className="text-xs text-gray-500">{formatDate(v.roadTaxExpiry)}</p>
                            <DueBadge days={daysUntil(v.roadTaxExpiry)} />
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { reset({ vehicleId: v.id, currency: 'RWF', date: new Date().toISOString().split('T')[0] }); setEditing(null); setShowModal(true); }}
                          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                          Log service <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── RECORDS TAB ──────────────────────────────────────────────────────── */}
      {tab === 'records' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loadingRecords ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading records…</div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center">
              <Wrench size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">{search ? 'No records match your search.' : 'No service records yet. Log the first one.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Vehicle', 'Type', 'Date', 'Mileage', 'Cost', 'Garage', ''].map(h =>
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-sm">{r.vehicle.licensePlate}</p>
                          <p className="text-xs text-gray-400">{r.vehicle.manufacturer} {r.vehicle.model}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">{r.maintenanceType}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.mileageAtService ? `${r.mileageAtService.toLocaleString()} km` : '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.currency} {r.cost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.garage ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Pencil size={14} /></button>
                          <button onClick={() => { if (confirm('Delete this record?')) deleteMutation.mutate(r.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Modal ──────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Service Record' : 'Log Service'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
              {/* Vehicle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle *</label>
                <select {...register('vehicleId')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  <option value="">Select vehicle…</option>
                  {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.licensePlate} — {v.name}</option>)}
                </select>
                {errors.vehicleId && <p className="text-red-500 text-xs mt-1">{errors.vehicleId.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select {...register('maintenanceType')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="">Select…</option>
                    {MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.maintenanceType && <p className="text-red-500 text-xs mt-1">{errors.maintenanceType.message}</p>}
                </div>
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Date</label>
                  <input type="date" {...register('date')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea {...register('description')} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Cost */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost (RWF) *</label>
                  <input type="number" {...register('cost')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  {errors.cost && <p className="text-red-500 text-xs mt-1">{errors.cost.message}</p>}
                </div>
                {/* Mileage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Odometer (km)</label>
                  <input type="number" {...register('mileageAtService')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Garage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Garage / Workshop</label>
                  <input {...register('garage')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                {/* Mechanic */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mechanic</label>
                  <input {...register('mechanicName')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>

              {/* Next service */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Service Date</label>
                <input type="date" {...register('nextServiceDate')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={isSubmitting || saveMutation.isPending}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                  {isSubmitting || saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
