'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { geofenceApi, vehicleApi } from '@/lib/api';
import { MapPin, Plus, Trash2, Truck, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const COLORS = ['#EF4444','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6','#EC4899','#06B6D4'];

// ─── Vehicle multi-select ──────────────────────────────────────────────────────
function VehicleSelect({ selected, onChange }: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data } = useQuery({
    queryKey: ['vehicles-all'],
    queryFn: () => vehicleApi.list({ limit: 200 }),
  });
  const vehicles = data?.data ?? [];

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700">Affected Vehicles</label>
        <span className="text-xs text-gray-400">
          {selected.length === 0 ? 'All vehicles' : `${selected.length} selected`}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        Leave all unchecked = geofence applies to every vehicle. Select specific vehicles to limit scope.
      </p>
      <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
        {vehicles.length === 0 ? (
          <p className="text-xs text-gray-400 p-3">No vehicles found</p>
        ) : vehicles.map((v: any) => {
          const isSelected = selected.includes(v.id);
          return (
            <label key={v.id}
              className={cn('flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition',
                isSelected && 'bg-brand-50')}>
              <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition',
                isSelected ? 'bg-brand-600 border-brand-600' : 'border-gray-300')}>
                {isSelected && <Check size={10} className="text-white" />}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 bg-brand-100 rounded flex items-center justify-center shrink-0">
                  <Truck size={12} className="text-brand-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 font-mono truncate">{v.licensePlate}</p>
                  <p className="text-[10px] text-gray-400 truncate">{v.name}</p>
                </div>
              </div>
              <input type="checkbox" className="sr-only" checked={isSelected} onChange={() => toggle(v.id)} />
            </label>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button onClick={() => onChange([])}
          className="mt-1.5 text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
          <X size={10} /> Clear selection (apply to all vehicles)
        </button>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function GeofencesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', color: '#EF4444', alertOnEntry: true, alertOnExit: true,
    coordinates: '', type: 'polygon', vehicleIds: [] as string[],
  });

  const { data: geofences = [], isLoading } = useQuery({
    queryKey: ['geofences'],
    queryFn: geofenceApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error('Name is required');
      let coords;
      try { coords = JSON.parse(form.coordinates); } catch { throw new Error('Invalid coordinates JSON'); }
      if (!Array.isArray(coords) || coords.length < 3) throw new Error('Need at least 3 coordinate pairs');
      return geofenceApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        color: form.color,
        alertOnEntry: form.alertOnEntry,
        alertOnExit: form.alertOnExit,
        coordinates: coords,
        type: form.type,
        vehicleIds: form.vehicleIds,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geofences'] });
      toast.success('Geofence created');
      setShowModal(false);
      setForm({ name:'', description:'', color:'#EF4444', alertOnEntry:true, alertOnExit:true, coordinates:'', type:'polygon', vehicleIds:[] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create geofence'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => geofenceApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geofences'] });
      toast.success('Geofence deleted');
      setDeleteTarget(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => geofenceApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences'] }),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Geofences</h1>
          <p className="text-gray-500 text-sm">{geofences.length} zone{geofences.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> Add Geofence
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="space-y-px">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse" />)}</div>
        ) : geofences.length ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Zone','Type','Vehicles Affected','Alerts','Events','Active',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {geofences.map((geo: any) => (
                <tr key={geo.id} className="hover:bg-gray-50 transition">
                  {/* Zone */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 shrink-0"
                        style={{ backgroundColor: geo.color + '30', borderColor: geo.color }} />
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{geo.name}</p>
                        {geo.description && <p className="text-xs text-gray-400 truncate max-w-40">{geo.description}</p>}
                      </div>
                    </div>
                  </td>
                  {/* Type */}
                  <td className="px-4 py-3">
                    <Badge variant="info">{geo.type}</Badge>
                  </td>
                  {/* Vehicles Affected */}
                  <td className="px-4 py-3">
                    {!geo.vehicleIds || geo.vehicleIds.length === 0 ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-medium">
                        All vehicles
                      </span>
                    ) : (
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 font-medium">
                        {geo.vehicleIds.length} vehicle{geo.vehicleIds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  {/* Alerts */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {geo.alertOnEntry && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Entry</span>}
                      {geo.alertOnExit  && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Exit</span>}
                    </div>
                  </td>
                  {/* Events */}
                  <td className="px-4 py-3 text-sm text-gray-600 font-medium">{geo._count?.events ?? 0}</td>
                  {/* Toggle */}
                  <td className="px-4 py-3">
                    <button onClick={() => toggleMutation.mutate({ id: geo.id, isActive: !geo.isActive })}
                      className={cn('w-10 h-5 rounded-full transition-colors relative', geo.isActive ? 'bg-green-500' : 'bg-gray-300')}>
                      <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
                        geo.isActive ? 'left-5' : 'left-0.5')} />
                    </button>
                  </td>
                  {/* Delete */}
                  <td className="px-4 py-3">
                    <button onClick={() => setDeleteTarget(geo.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={MapPin} title="No geofences defined"
            description="Create zones to get alerts when vehicles enter or exit them."
            action={{ label: 'Add Geofence', onClick: () => setShowModal(true) }} />
        )}
      </div>

      {/* Create Geofence Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white rounded-t-2xl flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
                  <MapPin size={16} className="text-brand-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">New Geofence</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Kigali City Centre, Warehouse Zone A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Zone Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                      className={cn('w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                        form.color === c ? 'border-gray-800 scale-110' : 'border-white')}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                    className="w-8 h-8 rounded-full cursor-pointer border border-gray-200"
                    title="Custom color" />
                </div>
              </div>

              {/* Coordinates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coordinates <span className="text-red-500">*</span>
                </label>
                <textarea value={form.coordinates} onChange={e => setForm(p => ({ ...p, coordinates: e.target.value }))} rows={3}
                  placeholder={'[[-1.9441, 30.0619], [-1.9272, 30.0534], [-1.9380, 30.1033], [-1.9441, 30.0619]]'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono text-xs resize-none" />
                <p className="text-xs text-gray-400 mt-1">
                  Array of [lat, lng] pairs. First and last point must be the same (closed polygon).
                  Get coordinates from Google Maps (right-click → "What's here?").
                </p>
              </div>

              {/* Alerts */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Alerts</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={form.alertOnEntry}
                      onChange={e => setForm(p => ({ ...p, alertOnEntry: e.target.checked }))}
                      className="w-4 h-4 text-brand-600 rounded" />
                    <span className="text-green-700 font-medium">Alert on Entry</span>
                    <span className="text-xs text-gray-400">— when vehicle enters the zone</span>
                  </label>
                </div>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={form.alertOnExit}
                      onChange={e => setForm(p => ({ ...p, alertOnExit: e.target.checked }))}
                      className="w-4 h-4 text-brand-600 rounded" />
                    <span className="text-orange-700 font-medium">Alert on Exit</span>
                    <span className="text-xs text-gray-400">— when vehicle leaves the zone</span>
                  </label>
                </div>
              </div>

              {/* Vehicle selection */}
              <VehicleSelect
                selected={form.vehicleIds}
                onChange={ids => setForm(p => ({ ...p, vehicleIds: ids }))}
              />

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name.trim() || !form.coordinates.trim()}
                  className="flex-1 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {createMutation.isPending ? 'Creating…' : 'Create Zone'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Geofence"
          message="This will permanently remove the geofence and all its event history. This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteMutation.mutate(deleteTarget!)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
