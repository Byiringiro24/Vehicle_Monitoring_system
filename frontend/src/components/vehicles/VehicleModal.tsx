'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleApi, fleetApi } from '@/lib/api';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  licensePlate: z.string().min(1, 'License plate required'),
  make: z.string().min(1, 'Make required'),
  model: z.string().min(1, 'Model required'),
  year: z.coerce.number().min(1990).max(2030),
  color: z.string().optional(),
  vin: z.string().optional(),
  fuelCapacity: z.coerce.number().min(1).max(1000).default(60),
  fleetId: z.string().optional(),
});
type VehicleForm = z.infer<typeof schema>;

export function VehicleModal({ vehicle, onClose }: { vehicle?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!vehicle;

  const { data: fleets } = useQuery({ queryKey: ['fleets'], queryFn: fleetApi.list });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<VehicleForm>({
    resolver: zodResolver(schema),
    defaultValues: vehicle ? { ...vehicle, fleetId: vehicle.fleet?.id } : { year: new Date().getFullYear(), fuelCapacity: 60 },
  });

  const mutation = useMutation({
    mutationFn: (data: VehicleForm) => isEdit ? vehicleApi.update(vehicle.id, data) : vehicleApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(isEdit ? 'Vehicle updated' : 'Vehicle created');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Operation failed'),
  });

  const fields = [
    { name: 'name', label: 'Vehicle Name', placeholder: 'Truck Alpha' },
    { name: 'licensePlate', label: 'License Plate', placeholder: 'KCA 001A' },
    { name: 'make', label: 'Make', placeholder: 'Toyota' },
    { name: 'model', label: 'Model', placeholder: 'Hilux' },
    { name: 'year', label: 'Year', placeholder: '2022', type: 'number' },
    { name: 'color', label: 'Color', placeholder: 'White' },
    { name: 'vin', label: 'VIN (optional)', placeholder: 'JTMHE3FJ...' },
    { name: 'fuelCapacity', label: 'Fuel Capacity (L)', placeholder: '60', type: 'number' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {fields.map(({ name, label, placeholder, type }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input {...register(name as any)} type={type ?? 'text'} placeholder={placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                {errors[name as keyof typeof errors] && (
                  <p className="text-red-500 text-xs mt-1">{(errors[name as keyof typeof errors] as any)?.message}</p>
                )}
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fleet</label>
            <select {...register('fleetId')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="">No Fleet</option>
              {(fleets ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}