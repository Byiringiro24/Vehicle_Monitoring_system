'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useParams, useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Truck, User, Calendar, CheckCircle2, Camera, Fuel, Gauge, FileText, Save } from 'lucide-react';

export default function RentalHandoverPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const contractId = params.id as string;

  const [checklist, setChecklist] = useState({
    fuelLevel: '',
    odometer: '',
    frontPhoto: false,
    rearPhoto: false,
    leftPhoto: false,
    rightPhoto: false,
    interiorPhoto: false,
    dashboardPhoto: false,
    spareTyre: false,
    jack: false,
    tools: false,
    registrationCard: false,
    insuranceCert: false,
    customerSignature: false,
    notes: '',
  });

  const { data: contract } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => apiClient.get(`/contracts/contracts/${contractId}`).then(r => r.data),
    enabled: !!contractId,
  });

  const c: any = contract;
  const checklistItems = [
    { key: 'frontPhoto',      label: 'Front photo',           icon: <Camera size={14} /> },
    { key: 'rearPhoto',       label: 'Rear photo',             icon: <Camera size={14} /> },
    { key: 'leftPhoto',       label: 'Left side photo',        icon: <Camera size={14} /> },
    { key: 'rightPhoto',      label: 'Right side photo',       icon: <Camera size={14} /> },
    { key: 'interiorPhoto',   label: 'Interior photo',         icon: <Camera size={14} /> },
    { key: 'dashboardPhoto',  label: 'Dashboard photo',       icon: <Camera size={14} /> },
    { key: 'spareTyre',       label: 'Spare tyre present',     icon: <CheckCircle2 size={14} /> },
    { key: 'jack',            label: 'Jack present',           icon: <CheckCircle2 size={14} /> },
    { key: 'tools',           label: 'Tools present',          icon: <CheckCircle2 size={14} /> },
    { key: 'registrationCard',label: 'Registration card',     icon: <FileText size={14} /> },
    { key: 'insuranceCert',   label: 'Insurance certificate',  icon: <FileText size={14} /> },
    { key: 'customerSignature',label: 'Customer signed',      icon: <CheckCircle2 size={14} /> },
  ];

  const completedCount = checklistItems.filter(item => (checklist as any)[item.key]).length;
  const allComplete = completedCount === checklistItems.length;

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/rentals" className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500 shrink-0">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rental Handover</h1>
          <p className="text-gray-500 text-sm mt-0.5">Vehicle condition checklist and customer signature</p>
        </div>
      </div>

      {/* Contract summary */}
      {c && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Truck size={14} className="text-gray-400" />
              <span className="font-medium text-gray-900">{c.vehicle?.licensePlate ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <User size={14} className="text-gray-400" />
              <span className="text-gray-700">{c.customer?.name ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-gray-600">{formatDate(c.startDate)} → {c.endDate ? formatDate(c.endDate) : 'Ongoing'}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-gray-400" />
              <span className="text-gray-600">{c.contractType?.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${(completedCount / checklistItems.length) * 100}%` }} />
        </div>
        <span className="text-xs text-gray-500 shrink-0">{completedCount}/{checklistItems.length} complete</span>
      </div>

      {/* Fuel and odometer */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          <Fuel size={14} className="text-brand-600" /> Vehicle Condition
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fuel level (%)</label>
            <div className="relative">
              <Fuel size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="number" value={checklist.fuelLevel} onChange={e => setChecklist(c => ({...c, fuelLevel: e.target.value}))}
                placeholder="75" className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Odometer (km)</label>
            <div className="relative">
              <Gauge size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="number" value={checklist.odometer} onChange={e => setChecklist(c => ({...c, odometer: e.target.value}))}
                placeholder="84210" className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Handover Checklist</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {checklistItems.map(item => (
            <label key={item.key} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={(checklist as any)[item.key]}
                onChange={e => setChecklist(c => ({...c, [item.key]: e.target.checked}))}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-gray-400">{item.icon}</span>
              <span className={cn('text-sm flex-1', (checklist as any)[item.key] ? 'text-gray-900' : 'text-gray-500')}>
                {item.label}
              </span>
              {(checklist as any)[item.key] && <CheckCircle2 size={14} className="text-green-500" />}
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes / damage report</label>
        <textarea value={checklist.notes} onChange={e => setChecklist(c => ({...c, notes: e.target.value}))}
          rows={3} placeholder="Any existing damage, scratches, or observations…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
      </div>

      {/* Save button */}
      <div className="flex items-center justify-between gap-4">
        <p className={cn('text-sm', allComplete ? 'text-green-600 font-medium' : 'text-gray-400')}>
          {allComplete ? 'All items checked — ready to complete handover' : `${checklistItems.length - completedCount} items remaining`}
        </p>
        <button disabled={!allComplete}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
          <Save size={14} /> Complete handover
        </button>
      </div>
    </div>
  );
}
