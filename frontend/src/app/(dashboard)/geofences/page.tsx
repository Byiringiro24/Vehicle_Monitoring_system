'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { geofenceApi } from '@/lib/api';
import { MapPin, Plus, Trash2, Toggle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function GeofencesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', color: '#EF4444', alertOnEntry: true, alertOnExit: true,
    coordinates: '', type: 'polygon',
  });

  const { data: geofences = [], isLoading } = useQuery({
    queryKey: ['geofences'],
    queryFn: geofenceApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      let coords;
      try { coords = JSON.parse(form.coordinates); } catch { throw new Error('Invalid coordinates JSON'); }
      return geofenceApi.create({ ...form, coordinates: coords });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['geofences'] }); toast.success('Geofence created'); setShowModal(false); },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => geofenceApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['geofences'] }); toast.success('Geofence deleted'); setDeleteTarget(null); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      geofenceApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences'] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Geofences</h1>
          <p className="text-gray-500 text-sm">{geofences.length} zones configured</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> Add Geofence
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="space-y-px">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse" />)}</div>
        ) : geofences.length ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Zone', 'Type', 'Alerts', 'Events', 'Status', ''].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {geofences.map((geo: any) => (
                <tr key={geo.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full border-2" style={{ backgroundColor: geo.color + '40', borderColor: geo.color }} />
                      <div>
                        <p className="font-medium text-sm text-gray-900">{geo.name}</p>
                        {geo.description && <p className="text-xs text-gray-500 truncate max-w-48">{geo.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="info">{geo.type}</Badge></td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {geo.alertOnEntry && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded mr-1">Entry</span>}
                    {geo.alertOnExit && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Exit</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{geo._count?.events ?? 0}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleMutation.mutate({ id: geo.id, isActive: !geo.isActive })}
                      className={cn('w-10 h-5 rounded-full transition-colors relative', geo.isActive ? 'bg-green-500' : 'bg-gray-300')}>
                      <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', geo.isActive ? 'left-5' : 'left-0.5')} />
                    </button>
                  </td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Geofence</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
            </div>
            {[
              { label: 'Name', key: 'name', placeholder: 'City Centre Zone' },
              { label: 'Description', key: 'description', placeholder: 'Optional description' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coordinates (GeoJSON polygon array)</label>
              <textarea value={form.coordinates} onChange={e => setForm(p => ({ ...p, coordinates: e.target.value }))} rows={4}
                placeholder='[[-1.28,36.81],[-1.29,36.82],[-1.28,36.83],[-1.28,36.81]]'
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono text-xs" />
              <p className="text-xs text-gray-400 mt-1">Array of [lat, lng] pairs forming a closed polygon</p>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.alertOnEntry} onChange={e => setForm(p => ({ ...p, alertOnEntry: e.target.checked }))}
                  className="w-4 h-4 text-brand-600 rounded" />
                Alert on Entry
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.alertOnExit} onChange={e => setForm(p => ({ ...p, alertOnExit: e.target.checked }))}
                  className="w-4 h-4 text-brand-600 rounded" />
                Alert on Exit
              </label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
                className="flex-1 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60">
                {createMutation.isPending ? 'Creating...' : 'Create Zone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog title="Delete Geofence" message="This will permanently remove the geofence and all its events."
          confirmLabel="Delete" danger
          onConfirm={() => deleteMutation.mutate(deleteTarget!)}
          onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}