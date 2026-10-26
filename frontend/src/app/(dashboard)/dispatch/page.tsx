'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Navigation, Plus, X, CheckCircle2, Truck, User,
  AlertTriangle, Clock, ChevronRight, RefreshCw,
} from 'lucide-react';

type TripStatus = 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const STATUS_COLS: { id: TripStatus; label: string; color: string; bg: string }[] = [
  { id: 'UNASSIGNED',  label: 'Unassigned',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  { id: 'ASSIGNED',    label: 'Assigned',     color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  { id: 'IN_PROGRESS', label: 'In Progress',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  { id: 'COMPLETED',   label: 'Completed',    color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200' },
];

const STATUS_BADGE: Record<string, string> = {
  UNASSIGNED:  'bg-amber-100 text-amber-700',
  ASSIGNED:    'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-green-100 text-green-700',
  COMPLETED:   'bg-gray-100 text-gray-600',
  CANCELLED:   'bg-red-100 text-red-600',
};

export default function DispatchPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const [showNew, setShowNew] = useState(false);
  const [assignTrip, setAssignTrip] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [newForm, setNewForm] = useState({ purpose: '', scheduledAt: new Date().toISOString().slice(0, 16), notes: '' });

  const { data: tripsData, isLoading } = useQuery({
    queryKey: ['trips', today],
    queryFn: () => apiClient.get(`/trips?limit=100&date=${today}`).then(r => r.data),
    refetchInterval: 15000,
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => apiClient.get('/drivers').then(r => r.data),
  });
  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => apiClient.get('/vehicles?limit=100').then(r => r.data),
  });

  const trips: any[] = tripsData?.data ?? [];
  const vehicles: any[] = vehiclesData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: object) => apiClient.post('/trips', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); toast.success('Trip created'); setShowNew(false); setNewForm({ purpose: '', scheduledAt: new Date().toISOString().slice(0, 16), notes: '' }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to create trip'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, driverId, vehicleId }: any) => apiClient.patch(`/trips/${id}/assign`, { driverId, vehicleId }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); toast.success('Trip assigned'); setAssignTrip(null); setSelectedDriver(''); setSelectedVehicle(''); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to assign trip'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: any) => apiClient.patch(`/trips/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); toast.success('Status updated'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to update status'),
  });

  function getTripStatus(t: any): TripStatus {
    return (t.pathPoints as any)?.status ?? 'UNASSIGNED';
  }

  function tripsByStatus(status: TripStatus) {
    return trips.filter(t => getTripStatus(t) === status);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch Board</h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())} · {trips.length} trips today</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => qc.invalidateQueries({ queryKey: ['trips'] })}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition shadow-sm">
            <Plus size={14} /> New Trip
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUS_COLS.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
              {[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {STATUS_COLS.map(col => {
            const colTrips = tripsByStatus(col.id);
            return (
              <div key={col.id} className={`rounded-xl border p-3 ${col.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[col.id]}`}>{colTrips.length}</span>
                </div>
                <div className="space-y-2">
                  {colTrips.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs">
                      <CheckCircle2 size={18} className="mx-auto mb-1 opacity-20" />
                      No trips
                    </div>
                  ) : colTrips.map((t: any) => {
                    const meta = t.pathPoints as any ?? {};
                    return (
                      <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs hover:shadow-sm transition">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-gray-400 font-mono">#{t.id.slice(0,6).toUpperCase()}</span>
                          {col.id === 'UNASSIGNED' && (
                            <button onClick={() => setAssignTrip(t)}
                              className="text-[10px] text-brand-600 font-semibold hover:underline">
                              Assign
                            </button>
                          )}
                          {col.id === 'ASSIGNED' && (
                            <button onClick={() => statusMutation.mutate({ id: t.id, status: 'IN_PROGRESS' })}
                              className="text-[10px] text-green-600 font-semibold hover:underline">
                              Start
                            </button>
                          )}
                          {col.id === 'IN_PROGRESS' && (
                            <button onClick={() => statusMutation.mutate({ id: t.id, status: 'COMPLETED' })}
                              className="text-[10px] text-gray-500 font-semibold hover:underline">
                              Complete
                            </button>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {meta.purpose ?? 'Trip'}
                        </p>
                        {t.vehicle && (
                          <div className="flex items-center gap-1 mt-1">
                            <Truck size={11} className="text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-500">{t.vehicle.licensePlate}</span>
                          </div>
                        )}
                        {t.driver && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <User size={11} className="text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-500">{t.driver.user?.firstName} {t.driver.user?.lastName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1.5">
                          <Clock size={10} className="text-gray-300 shrink-0" />
                          <span className="text-[10px] text-gray-400">{meta.scheduledAt ? formatDate(meta.scheduledAt) : formatDate(t.startTime)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New trip modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Trip</h2>
              <button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose / Description</label>
                <input value={newForm.purpose} onChange={e => setNewForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="e.g. Airport pickup"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled at</label>
                <input type="datetime-local" value={newForm.scheduledAt} onChange={e => setNewForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle (optional)</label>
                <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select vehicle…</option>
                  {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.licensePlate} — {v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Additional details…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={() => createMutation.mutate({ vehicleId: selectedVehicle || undefined, scheduledAt: newForm.scheduledAt, purpose: newForm.purpose, notes: newForm.notes })}
                disabled={!newForm.scheduledAt || createMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {createMutation.isPending ? 'Creating…' : 'Create Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign drawer */}
      {assignTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Assign Trip</h2>
              <button onClick={() => setAssignTrip(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {(assignTrip.pathPoints as any)?.purpose ?? 'Trip'} — {formatDate((assignTrip.pathPoints as any)?.scheduledAt ?? assignTrip.startTime)}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Driver</label>
                <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Choose driver…</option>
                  {(drivers as any[]).map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.user?.firstName} {d.user?.lastName} {d.currentVehicle ? `(on ${d.currentVehicle.licensePlate})` : '(available)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Vehicle</label>
                <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Choose vehicle…</option>
                  {vehicles.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.licensePlate} — {v.name} ({v.status})</option>
                  ))}
                </select>
              </div>
            </div>
            {(!selectedDriver && !selectedVehicle) && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertTriangle size={11} /> Select at least a driver or vehicle to assign
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAssignTrip(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={() => assignMutation.mutate({ id: assignTrip.id, driverId: selectedDriver || undefined, vehicleId: selectedVehicle || undefined })}
                disabled={(!selectedDriver && !selectedVehicle) || assignMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {assignMutation.isPending ? 'Assigning…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
