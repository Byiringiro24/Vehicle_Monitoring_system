'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Plus, Users, Shield, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800',
  ADMIN: 'bg-orange-100 text-orange-800',
  FLEET_MANAGER: 'bg-blue-100 text-blue-800',
  DRIVER: 'bg-green-100 text-green-800',
  VIEWER: 'bg-gray-100 text-gray-800',
};

const schema = z.object({
  email: z.string().email(), firstName: z.string().min(1), lastName: z.string().min(1),
  role: z.enum(['ADMIN','FLEET_MANAGER','DRIVER','VIEWER']),
  password: z.string().min(8).optional().or(z.literal('')),
  phone: z.string().optional(),
});
type UserForm = z.infer<typeof schema>;

export default function UsersPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'], queryFn: () => apiClient.get('/users').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: (d: UserForm) => editing
      ? apiClient.put(/users/, d).then(r => r.data)
      : apiClient.post('/users', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(editing ? 'User updated' : 'User created'); setShowModal(false); setEditing(null); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserForm>({ resolver: zodResolver(schema) });

  function openAdd() { reset({}); setEditing(null); setShowModal(true); }
  function openEdit(u: any) { reset({ email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, phone: u.phone ?? '' }); setEditing(u); setShowModal(true); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Users</h1><p className="text-gray-500 text-sm">{users.length} users</p></div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>{['Name','Email','Role','Status','Last Login',''].map(h =>
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? [...Array(4)].map((_, i) => <tr key={i} className="animate-pulse">{[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>)}</tr>)
            : users.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-bold">
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <p className="font-medium text-sm">{u.firstName} {u.lastName}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                <td className="px-4 py-3"><span className={cn('text-xs px-2 py-1 rounded-full font-medium', roleColors[u.role] ?? 'bg-gray-100')}>{u.role.replace('_', ' ')}</span></td>
                <td className="px-4 py-3"><span className={cn('text-xs px-2 py-1 rounded-full font-medium', u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3 text-xs text-gray-500">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</td>
                <td className="px-4 py-3"><button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition"><Pencil size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit User' : 'Add User'}</h2>
            <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {(['firstName','lastName'] as const).map(f => (
                  <div key={f}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f === 'firstName' ? 'First Name' : 'Last Name'}</label>
                    <input {...register(f)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input {...register('email')} type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select {...register('role')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  {['ADMIN','FLEET_MANAGER','DRIVER','VIEWER'].map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{editing ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <input {...register('password')} type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                  {isSubmitting ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}