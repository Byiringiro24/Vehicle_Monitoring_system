'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  Bike, User, Plus, Search, X, ArrowRight, Truck, Phone, MapPin,
  CheckCircle2, AlertTriangle, DollarSign, FileText, Calendar,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  INACTIVE:  'bg-gray-100 text-gray-500',
  SUSPENDED: 'bg-red-100 text-red-700',
};

const TODAY_STATUS_COLORS: Record<string, string> = {
  PAID:        'bg-green-100 text-green-700',
  DEBT:        'bg-red-100 text-red-700',
  PARTIAL:     'bg-amber-100 text-amber-700',
  PENDING:     'bg-gray-100 text-gray-500',
  NOT_RECORDED:'bg-slate-100 text-slate-500',
};

export default function MotoPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [assignModal, setAssignModal] = useState<any>(null);
  const [newPlate, setNewPlate] = useState('');
  const [newBikeModel, setNewBikeModel] = useState('');

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['moto-drivers', search, filter],
    queryFn: () => motoApi.listDrivers({
      search: search || undefined,
      active: filter === 'active' ? 'true' : filter === 'inactive' ? 'false' : undefined,
    }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, plate, model }: any) => motoApi.assignBike(id, { plateNumber: plate, bikeModel: model }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['moto-drivers'] });
      toast.success(data.message);
      setAssignModal(null); setNewPlate(''); setNewBikeModel('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Motorcycle Fleet</h1>
          <p className="text-gray-500 text-sm mt-0.5">Boda-boda / E-moto drivers, bike assignments and daily payments</p>
        </div>
        <div className="flex gap-2">
          <Link href="/moto/payments"
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-xl transition shadow-sm">
            <DollarSign size={14} /> Daily Collection
          </Link>
          <Link href="/moto/daily-report"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition">
            <FileText size={14} /> Daily Report
          </Link>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-xl transition shadow-sm">
            <Plus size={14} /> Add Driver
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total drivers',   value: (drivers as any[]).length,                    icon: <User size={15} className="text-brand-600" />,     bg: 'bg-brand-50', border: 'border-brand-200' },
          { label: 'Active (with bike)',value: (drivers as any[]).filter((d:any)=>d.hasBike).length, icon: <Bike size={15} className="text-green-600" />,    bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'With debt',         value: (drivers as any[]).filter((d:any)=>d.totalDebt > 0).length, icon: <AlertTriangle size={15} className="text-amber-600" />, bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Not paid today',    value: (drivers as any[]).filter((d:any)=>['DEBT','NOT_RECORDED','PENDING'].includes(d.todayStatus)).length, icon: <DollarSign size={15} className="text-red-600" />, bg: 'bg-red-50', border: 'border-red-200' },
        ].map(({ label, value, icon, bg, border }) => (
          <div key={label} className={`bg-white rounded-xl border ${border} p-4 shadow-xs flex items-center gap-3`}>
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
            <div>
              <p className="text-lg font-bold text-gray-900 tabular">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all','active','inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition capitalize',
                filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {f === 'all' ? 'All drivers' : f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, plate…"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      {/* Driver list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i=><div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : (drivers as any[]).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Bike size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No drivers registered yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first motorcycle driver to start tracking daily payments.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b">
                <tr>{['Driver','Phone','Plate','Assigned','Daily Rate','Today','Debt','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(drivers as any[]).map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <Link href={`/moto/${d.id}`} className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                          {d.firstName?.[0]}{d.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 hover:text-brand-600">{d.firstName} {d.lastName}</p>
                          <p className="text-xs text-gray-400">{d.nationalId ?? 'No ID'}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{d.phone}</td>
                    <td className="px-4 py-3">
                      {d.plateNumber ? (
                        <span className="text-xs font-mono font-bold bg-gray-100 px-2 py-1 rounded">{d.plateNumber}</span>
                      ) : (
                        <span className="text-xs text-gray-300">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {d.bikeAssignedAt ? formatDate(d.bikeAssignedAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 tabular">RWF {d.dailyRate?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TODAY_STATUS_COLORS[d.todayStatus] ?? 'bg-gray-100 text-gray-500')}>
                        {d.todayStatus?.replace('_',' ') ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm tabular font-medium">
                      {d.totalDebt > 0
                        ? <span className="text-red-600">RWF {d.totalDebt.toLocaleString()}</span>
                        : <span className="text-green-600">RWF 0</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setAssignModal(d)}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline">
                          {d.plateNumber ? 'Reassign' : 'Assign bike'}
                        </button>
                        <Link href={`/moto/${d.id}`} className="text-xs text-gray-500 hover:text-gray-700 font-medium hover:underline">
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign bike modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Assign bike to {assignModal.firstName}</h2>
              <button onClick={() => setAssignModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            {assignModal.plateNumber && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-700">
                  Currently assigned: <strong>{assignModal.plateNumber}</strong>. If you assign a new plate, the bike will be removed from this driver.
                </p>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plate number *</label>
                <input value={newPlate} onChange={e => setNewPlate(e.target.value.toUpperCase())}
                  placeholder="e.g. RAC 456 B"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bike model (optional)</label>
                <input value={newBikeModel} onChange={e => setNewBikeModel(e.target.value)}
                  placeholder="e.g. TVS iQube Electric"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAssignModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => assignMutation.mutate({ id: assignModal.id, plate: newPlate, model: newBikeModel })}
                disabled={!newPlate || assignMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {assignMutation.isPending ? 'Assigning…' : 'Assign bike'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add driver modal (simplified) */}
      {showAdd && <AddDriverModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddDriverModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', altPhone: '', nationalId: '',
    licenseNumber: '', address: '', plateNumber: '', bikeModel: '',
    dailyRate: '6000', weeklyRate: '42000', paymentType: 'DAILY',
    referral1Name: '', referral1Phone: '', referral2Name: '', referral2Phone: '',
  });

  const createMutation = useMutation({
    mutationFn: () => motoApi.createDriver(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['moto-drivers'] }); toast.success('Driver added'); onClose(); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Add Motorcycle Driver</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'First name *', key: 'firstName', placeholder: 'Jean' },
              { label: 'Last name *', key: 'lastName', placeholder: 'Kagabo' },
              { label: 'Phone *', key: 'phone', placeholder: '+250 78X XXX XXX' },
              { label: 'Alt phone', key: 'altPhone', placeholder: '+250 72X XXX XXX' },
              { label: 'National ID', key: 'nationalId', placeholder: '119XXXXXXXX' },
              { label: 'License number', key: 'licenseNumber', placeholder: 'DL-XXXXXX' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address / where they live</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Kigali, Nyarugenge..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          {/* Referrals — required by contract */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-600 mb-2">Referrals (required by contract)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Referral 1 name</label>
                <input value={form.referral1Name} onChange={e => setForm(f => ({ ...f, referral1Name: e.target.value }))}
                  placeholder="Name" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Referral 1 phone</label>
                <input value={form.referral1Phone} onChange={e => setForm(f => ({ ...f, referral1Phone: e.target.value }))}
                  placeholder="Phone" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Referral 2 name</label>
                <input value={form.referral2Name} onChange={e => setForm(f => ({ ...f, referral2Name: e.target.value }))}
                  placeholder="Name" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Referral 2 phone</label>
                <input value={form.referral2Phone} onChange={e => setForm(f => ({ ...f, referral2Phone: e.target.value }))}
                  placeholder="Phone" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          </div>
          {/* Bike + payment config */}
          <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plate number (optional)</label>
              <input value={form.plateNumber} onChange={e => setForm(f => ({ ...f, plateNumber: e.target.value.toUpperCase() }))}
                placeholder="RAC 456 B" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bike model</label>
              <input value={form.bikeModel} onChange={e => setForm(f => ({ ...f, bikeModel: e.target.value }))}
                placeholder="TVS iQube" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Daily rate (RWF)</label>
              <input type="number" value={form.dailyRate} onChange={e => setForm(f => ({ ...f, dailyRate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment type</label>
              <select value={form.paymentType} onChange={e => setForm(f => ({ ...f, paymentType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                {['DAILY','WEEKLY','MONTHLY'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
          <button onClick={() => createMutation.mutate()} disabled={!form.firstName || !form.lastName || !form.phone || createMutation.isPending}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
            {createMutation.isPending ? 'Adding…' : 'Add driver'}
          </button>
        </div>
      </div>
    </div>
  );
}
