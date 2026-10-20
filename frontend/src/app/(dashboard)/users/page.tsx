'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Plus, Pencil, KeyRound, Shield, UserX, UserCheck2,
  Users, Globe, Building2, Search, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  phone?: string;
  lastLoginAt?: string;
  createdAt: string;
  organization?: { id: string; name: string; slug: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:   'bg-red-100 text-red-800 border border-red-200',
  ADMIN:         'bg-orange-100 text-orange-800 border border-orange-200',
  FLEET_MANAGER: 'bg-blue-100 text-blue-800 border border-blue-200',
  FINANCE_MANAGER: 'bg-purple-100 text-purple-800 border border-purple-200',
  DRIVER:        'bg-green-100 text-green-800 border border-green-200',
  VIEWER:        'bg-gray-100 text-gray-700 border border-gray-200',
};

const ASSIGNABLE_ROLES = ['ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER', 'DRIVER', 'VIEWER'] as const;

// ─── Validation schemas ───────────────────────────────────────────────────────
const userSchema = z.object({
  email:     z.string().email('Valid email required'),
  firstName: z.string().min(1, 'Required'),
  lastName:  z.string().min(1, 'Required'),
  role:      z.enum(ASSIGNABLE_ROLES),
  password:  z.string().min(8, 'Min 8 characters').optional().or(z.literal('')),
  phone:     z.string().optional(),
});
type UserForm = z.infer<typeof userSchema>;

const resetSchema = z.object({
  newPassword:    z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string().min(8, 'Min 8 characters'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type ResetForm = z.infer<typeof resetSchema>;

// ─── Avatar initials ──────────────────────────────────────────────────────────
function Avatar({ user }: { user: UserRecord }) {
  return (
    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">
      {user.firstName[0]}{user.lastName[0]}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: me } = useAuthStore();
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';
  const canManage    = isSuperAdmin || me?.role === 'ADMIN';

  const qc = useQueryClient();

  // View toggle — SUPER_ADMIN can switch between own-org and all-org
  const [viewAll, setViewAll] = useState(false);
  const [search, setSearch]   = useState('');

  // Modals
  const [showUserModal,  setShowUserModal]  = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editing,        setEditing]        = useState<UserRecord | null>(null);
  const [resettingUser,  setResettingUser]  = useState<UserRecord | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const { data: users = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ['users', viewAll],
    queryFn:  () => (isSuperAdmin && viewAll ? userApi.listAll() : userApi.list()),
  });

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q)  ||
      u.email.toLowerCase().includes(q)     ||
      u.role.toLowerCase().includes(q)      ||
      (u.organization?.name.toLowerCase().includes(q) ?? false)
    );
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (d: UserForm) =>
      editing
        ? userApi.update(editing.id, d)
        : userApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(editing ? 'User updated' : 'User created');
      setShowUserModal(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to save user'),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      userApi.resetPassword(id, newPassword),
    onSuccess: (_, { id }) => {
      const name = users.find(u => u.id === id);
      toast.success(`Password reset for ${name?.firstName ?? 'user'}. Their sessions have been invalidated.`);
      setShowResetModal(false);
      setResettingUser(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Reset failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userApi.setStatus(id, isActive),
    onSuccess: (_, { isActive }) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(isActive ? 'User activated' : 'User deactivated');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  // ── User form ────────────────────────────────────────────────────────────────
  const { register: regUser, handleSubmit: hsUser, reset: resetUser,
    formState: { errors: errUser, isSubmitting: submittingUser } } =
    useForm<UserForm>({ resolver: zodResolver(userSchema) });

  function openAdd() {
    resetUser({ role: 'VIEWER' });
    setEditing(null);
    setShowUserModal(true);
  }
  function openEdit(u: UserRecord) {
    resetUser({ email: u.email, firstName: u.firstName, lastName: u.lastName,
      role: u.role as any, phone: u.phone ?? '' });
    setEditing(u);
    setShowUserModal(true);
  }

  // ── Reset-password form ───────────────────────────────────────────────────────
  const { register: regReset, handleSubmit: hsReset, reset: resetPwd,
    formState: { errors: errReset, isSubmitting: submittingReset } } =
    useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  function openReset(u: UserRecord) {
    resetPwd({});
    setResettingUser(u);
    setShowResetModal(true);
  }

  // ── Access guard ─────────────────────────────────────────────────────────────
  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <Shield size={40} className="text-gray-300" />
        <p className="text-lg font-semibold text-gray-700">Access Restricted</p>
        <p className="text-sm text-gray-500">Only Admins and Super Admins can manage users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
            {search ? ` matching "${search}"` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* All-org toggle — SUPER_ADMIN only */}
          {isSuperAdmin && (
            <div className="flex items-center bg-gray-100 rounded-lg p-1 text-sm gap-1">
              <button
                onClick={() => setViewAll(false)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition',
                  !viewAll ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
              >
                <Building2 size={14} /> My Org
              </button>
              <button
                onClick={() => setViewAll(true)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition',
                  viewAll ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
              >
                <Globe size={14} /> All Orgs
              </button>
            </div>
          )}
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or role…"
          className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── SUPER_ADMIN info banner ──────────────────────────────────────────── */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <Shield size={14} className="shrink-0" />
          <span>
            <strong>Super Admin view.</strong>{' '}
            You can reset any user's password and see all organisations.
          </span>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  'User', 'Email', 'Role',
                  ...(isSuperAdmin && viewAll ? ['Organisation'] : []),
                  'Status', 'Last Login', 'Actions',
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(isSuperAdmin && viewAll ? 7 : 6)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4" /></td>
                      ))}
                    </tr>
                  ))
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={isSuperAdmin && viewAll ? 7 : 6} className="px-4 py-12 text-center text-gray-400 text-sm">
                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                        {search ? 'No users match your search.' : 'No users yet.'}
                      </td>
                    </tr>
                  )
                  : filtered.map(u => (
                    <tr key={u.id} className={cn('hover:bg-gray-50 transition', !u.isActive && 'opacity-60')}>
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar user={u} />
                          <div>
                            <p className="font-medium text-sm text-gray-900">
                              {u.firstName} {u.lastName}
                              {u.id === me?.id && (
                                <span className="ml-1.5 text-xs text-brand-600 font-medium">(you)</span>
                              )}
                            </p>
                            {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap',
                          ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-700')}>
                          {u.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      {/* Organisation — SUPER_ADMIN all-org view only */}
                      {isSuperAdmin && viewAll && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {u.organization?.name ?? '—'}
                        </td>
                      )}
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-1 rounded-full font-medium',
                          u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {/* Last login */}
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Edit — ADMIN can edit own-org, SUPER_ADMIN can edit anyone */}
                          {(canManage && (isSuperAdmin || !u.role.includes('SUPER'))) && (
                            <button
                              onClick={() => openEdit(u)}
                              title="Edit user"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {/* Reset password — SUPER_ADMIN only */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => openReset(u)}
                              title="Reset password"
                              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                            >
                              <KeyRound size={15} />
                            </button>
                          )}
                          {/* Activate / Deactivate — not self */}
                          {canManage && u.id !== me?.id && (
                            <button
                              onClick={() => statusMutation.mutate({ id: u.id, isActive: !u.isActive })}
                              title={u.isActive ? 'Deactivate' : 'Activate'}
                              className={cn('p-1.5 rounded-lg transition',
                                u.isActive
                                  ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                              )}
                            >
                              {u.isActive ? <UserX size={15} /> : <UserCheck2 size={15} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit User Modal ────────────────────────────────────────────── */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit User' : 'Add User'}
              </h2>
              <button onClick={() => setShowUserModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={hsUser(d => saveMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {(['firstName', 'lastName'] as const).map(f => (
                  <div key={f}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {f === 'firstName' ? 'First Name' : 'Last Name'}
                    </label>
                    <input
                      {...regUser(f)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                    {errUser[f] && <p className="text-xs text-red-500 mt-1">{errUser[f]?.message}</p>}
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  {...regUser('email')}
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
                {errUser.email && <p className="text-xs text-red-500 mt-1">{errUser.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                <input
                  {...regUser('phone')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  {...regUser('role')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  {ASSIGNABLE_ROLES.map(r => (
                    <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editing ? 'New Password (leave blank to keep)' : 'Password'}
                </label>
                <input
                  {...regUser('password')}
                  type="password"
                  placeholder={editing ? '••••••••' : 'Min 8 characters'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
                {errUser.password && <p className="text-xs text-red-500 mt-1">{errUser.password.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser || saveMutation.isPending}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60"
                >
                  {submittingUser || saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal (SUPER_ADMIN only) ──────────────────────────── */}
      {showResetModal && resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-900">Reset Password</h2>
              <button onClick={() => setShowResetModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>
            {/* Who we're resetting */}
            <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg mb-5">
              <Avatar user={resettingUser} />
              <div>
                <p className="text-sm font-medium text-gray-900">{resettingUser.firstName} {resettingUser.lastName}</p>
                <p className="text-xs text-gray-500">{resettingUser.email}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              The user's current sessions will be invalidated. They will need to log in with the new password.
            </p>
            <form onSubmit={hsReset(d => resetMutation.mutate({ id: resettingUser.id, newPassword: d.newPassword }))} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  {...regReset('newPassword')}
                  type="password"
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                />
                {errReset.newPassword && <p className="text-xs text-red-500 mt-1">{errReset.newPassword.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  {...regReset('confirmPassword')}
                  type="password"
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                />
                {errReset.confirmPassword && <p className="text-xs text-red-500 mt-1">{errReset.confirmPassword.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReset || resetMutation.isPending}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60"
                >
                  {submittingReset || resetMutation.isPending ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
