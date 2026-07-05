'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleApi } from '@/lib/api';
import { getStatusColor, formatDate } from '@/lib/utils';
import { Plus, Search, Truck, Pencil, Trash2, Eye, Lock, Unlock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { VehicleModal } from '@/components/vehicles/VehicleModal';
import { cn } from '@/lib/utils';

// ─── Plate-confirmation lock/unlock modal (same as vehicle detail page) ───────
function LockConfirmModal({
  plate,
  action,
  onConfirm,
  onCancel,
}: {
  plate: string;
  action: 'lock' | 'unlock';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isLock   = action === 'lock';
  const match    = input.trim().toUpperCase() === plate.toUpperCase();

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">

        <div className="flex items-center gap-3">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center',
            isLock ? 'bg-red-100' : 'bg-green-100')}>
            {isLock
              ? <Lock size={22} className="text-red-600" />
              : <Unlock size={22} className="text-green-600" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isLock ? 'Lock Engine' : 'Unlock Engine'}
            </h2>
            <p className="text-sm text-gray-500">
              {isLock ? 'This will cut the ignition relay' : 'This will restore the ignition relay'}
            </p>
          </div>
        </div>

        <div className={cn('flex items-start gap-2 p-3 rounded-xl text-sm',
          isLock ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {isLock
              ? 'The vehicle engine will be cut immediately via the relay. Only lock a stationary vehicle.'
              : 'The engine relay will be released. Make sure it is safe to do so.'}
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            Type the plate number{' '}
            <span className="font-mono font-bold text-gray-900">{plate}</span>{' '}
            to confirm
          </label>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && match) onConfirm(); }}
            placeholder={plate}
            className={cn(
              'w-full px-4 py-2.5 border-2 rounded-xl font-mono text-sm uppercase tracking-widest outline-none transition',
              input.length === 0
                ? 'border-gray-300 focus:border-blue-400'
                : match
                  ? 'border-green-400 bg-green-50 text-green-800'
                  : 'border-red-300 bg-red-50 text-red-700'
            )}
          />
          {input.length > 0 && !match && (
            <p className="text-xs text-red-500">Plate doesn't match — check and try again</p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!match}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition',
              isLock
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-200'
                : 'bg-green-600 hover:bg-green-700 disabled:bg-green-200',
              'disabled:cursor-not-allowed'
            )}
          >
            {isLock ? '🔒 Confirm Lock' : '🔓 Confirm Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function VehiclesPage() {
  const qc = useQueryClient();
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);

  // Lock confirmation state
  const [lockTarget, setLockTarget] = useState<{ id: string; plate: string; action: 'lock' | 'unlock' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', search, statusFilter],
    queryFn: () => vehicleApi.list({ search, status: statusFilter || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: vehicleApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); toast.success('Vehicle deleted'); },
    onError:   () => toast.error('Failed to delete vehicle'),
  });

  const lockMutation = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) => vehicleApi.lock(id, locked),
    onSuccess: (_, { locked }) => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(locked ? '🔒 Lock command sent' : '🔓 Unlock command sent');
    },
    onError: () => toast.error('Lock command failed'),
  });

  const vehicles = data?.data ?? [];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-500 text-sm">{data?.pagination?.total ?? 0} vehicles registered</p>
        </div>
        <button
          onClick={() => { setEditingVehicle(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or plate..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">All Status</option>
          {['ACTIVE','IDLE','OFFLINE','MAINTENANCE','AVAILABLE','RENTED','LEASED','RESERVED','OUT_OF_SERVICE','DECOMMISSIONED'].map(s =>
            <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Vehicle','Plate / Type','Fleet','Status','Engine Lock','Last Seen','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              : vehicles.map((v: any) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition">

                    {/* Vehicle name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <Truck size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{v.name}</p>
                          <p className="text-xs text-gray-500">{v.manufacturer} {v.model} {v.year}</p>
                        </div>
                      </div>
                    </td>

                    {/* Plate + type */}
                    <td className="px-4 py-3">
                      <p className="font-mono font-bold text-sm text-gray-900">{v.licensePlate}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v.vehicleClass?.replace(/_/g,' ')} · {v.energyType}
                      </p>
                    </td>

                    {/* Fleet */}
                    <td className="px-4 py-3">
                      {v.fleet ? (
                        <span className="text-xs px-2 py-1 rounded-full text-white font-medium"
                          style={{ backgroundColor: v.fleet.color ?? '#6b7280' }}>
                          {v.fleet.name}
                        </span>
                      ) : <span className="text-gray-400 text-xs">Unassigned</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full font-medium', getStatusColor(v.status))}>
                        {v.status}
                      </span>
                      {v.lastLocation && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {(v.lastLocation.speed ?? 0).toFixed(0)} km/h
                        </p>
                      )}
                    </td>

                    {/* Engine Lock — opens plate confirmation modal */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setLockTarget({
                          id:     v.id,
                          plate:  v.licensePlate,
                          action: v.engineLocked ? 'unlock' : 'lock',
                        })}
                        disabled={lockMutation.isPending}
                        title={v.engineLocked ? 'Click to unlock engine' : 'Click to lock engine'}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border',
                          v.engineLocked
                            ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                            : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
                          'disabled:opacity-50'
                        )}>
                        {v.engineLocked
                          ? <><Lock size={12} /> LOCKED</>
                          : <><Unlock size={12} /> UNLOCKED</>}
                      </button>
                    </td>

                    {/* Last seen */}
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {v.lastLocation
                        ? <>
                            <p>{formatDate(v.lastLocation.updatedAt)}</p>
                            {v.lastLocation.latitude && (
                              <p className="text-gray-400">{v.lastLocation.latitude.toFixed(4)}, {v.lastLocation.longitude.toFixed(4)}</p>
                            )}
                          </>
                        : 'Never'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/vehicles/${v.id}`}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View details">
                          <Eye size={15} />
                        </Link>
                        <button
                          onClick={() => { setEditingVehicle(v); setShowModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition"
                          title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete ${v.licensePlate}?`)) deleteMutation.mutate(v.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {!isLoading && !vehicles.length && (
          <div className="text-center py-14 text-gray-400">
            <Truck size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No vehicles found</p>
            <p className="text-sm mt-1">Add your first vehicle to get started</p>
          </div>
        )}
      </div>

      {/* Plate confirmation modal */}
      {lockTarget && (
        <LockConfirmModal
          plate={lockTarget.plate}
          action={lockTarget.action}
          onConfirm={() => {
            lockMutation.mutate({ id: lockTarget.id, locked: lockTarget.action === 'lock' });
            setLockTarget(null);
          }}
          onCancel={() => setLockTarget(null)}
        />
      )}

      {showModal && (
        <VehicleModal
          vehicle={editingVehicle}
          onClose={() => { setShowModal(false); setEditingVehicle(null); }}
        />
      )}
    </div>
  );
}
