'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleApi } from '@/lib/api';
import { getStatusColor, formatDate } from '@/lib/utils';
import { Plus, Search, Truck, RefreshCw, Pencil, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { VehicleModal } from '@/components/vehicles/VehicleModal';
import { cn } from '@/lib/utils';

export default function VehiclesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', search, statusFilter],
    queryFn: () => vehicleApi.list({ search, status: statusFilter || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: vehicleApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); toast.success('Vehicle deleted'); },
    onError: () => toast.error('Failed to delete vehicle'),
  });

  function handleEdit(vehicle: any) { setEditingVehicle(vehicle); setShowModal(true); }
  function handleAdd() { setEditingVehicle(null); setShowModal(true); }
  function handleCloseModal() { setShowModal(false); setEditingVehicle(null); }

  const vehicles = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-500 text-sm">{data?.pagination?.total ?? 0} vehicles registered</p>
        </div>
        <button onClick={handleAdd}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicles..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
          <option value="">All Status</option>
          {['ACTIVE','IDLE','OFFLINE','MAINTENANCE'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Vehicle','License Plate','Fleet','Status','Last Seen','Actions'].map(h =>
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? [...Array(5)].map((_, i) => (
              <tr key={i} className="animate-pulse">
                {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>)}
              </tr>
            )) : vehicles.map((v: any) => (
              <tr key={v.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
                      <Truck size={16} className="text-brand-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{v.name}</p>
                      <p className="text-xs text-gray-500">{v.make} {v.model} {v.year}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-700">{v.licensePlate}</td>
                <td className="px-4 py-3">
                  {v.fleet ? (
                    <span className="text-xs px-2 py-1 rounded-full text-white font-medium" style={{ backgroundColor: v.fleet.color }}>
                      {v.fleet.name}
                    </span>
                  ) : <span className="text-gray-400 text-xs">Unassigned</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-1 rounded-full font-medium', getStatusColor(v.status))}>{v.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {v.lastLocation ? formatDate(v.lastLocation.updatedAt) : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={/vehicles/} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition">
                      <Eye size={15} />
                    </Link>
                    <button onClick={() => handleEdit(v)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => { if (confirm('Delete this vehicle?')) deleteMutation.mutate(v.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !vehicles.length && (
          <div className="text-center py-12 text-gray-400">
            <Truck size={40} className="mx-auto mb-3 opacity-20" />
            <p>No vehicles found. Add your first vehicle.</p>
          </div>
        )}
      </div>

      {showModal && <VehicleModal vehicle={editingVehicle} onClose={handleCloseModal} />}
    </div>
  );
}