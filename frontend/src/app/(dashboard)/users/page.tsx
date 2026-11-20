'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Plus, Pencil, KeyRound, Shield, UserX, UserCheck2,
  Users, Globe, Building2, Search, X, Info, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles?: string[];
  pendingRoles?: string[];
  isActive: boolean;
  phone?: string;
  lastLoginAt?: string;
  createdAt: string;
  organization?: { id: string; name: string; slug: string };
}

// ─── Role lists ───────────────────────────────────────────────────────────────
// SUPER_ADMIN creates these only:
const SUPER_ADMIN_CREATABLE = ['ADMIN'] as const;

// ADMIN creates these only (not SUPER_ADMIN, not ADMIN):
const ADMIN_CREATABLE = [
  'FLEET_MANAGER',
  'FINANCE_MANAGER',
  'HR_MANAGER',
  'MECHANIC',
  'COMPLIANCE_OFFICER',
  'RENTAL_MANAGER',
  'SALES_AGENT',
  'AUDITOR',
  'DRIVER',
  'VIEWER',
] as const;

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:        'bg-red-100 text-red-800 border border-red-200',
  ADMIN:              'bg-orange-100 text-orange-800 border border-orange-200',
  FLEET_MANAGER:      'bg-blue-100 text-blue-800 border border-blue-200',
  FINANCE_MANAGER:    'bg-purple-100 text-purple-800 border border-purple-200',
  HR_MANAGER:         'bg-indigo-100 text-indigo-800 border border-indigo-200',
  MECHANIC:           'bg-yellow-100 text-yellow-800 border border-yellow-200',
  COMPLIANCE_OFFICER: 'bg-teal-100 text-teal-800 border border-teal-200',
  RENTAL_MANAGER:     'bg-cyan-100 text-cyan-800 border border-cyan-200',
  SALES_AGENT:        'bg-pink-100 text-pink-800 border border-pink-200',
  AUDITOR:            'bg-slate-100 text-slate-800 border border-slate-200',
  DRIVER:             'bg-green-100 text-green-800 border border-green-200',
  VIEWER:             'bg-gray-100 text-gray-700 border border-gray-200',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  FLEET_MANAGER:      'Vehicles, drivers, dispatch, geofences, maintenance',
  FINANCE_MANAGER:    'Finance dashboard, invoices, payouts, vehicle reports',
  HR_MANAGER:         'Staff attendance and HR management',
  MECHANIC:           'Workshop jobs and maintenance records',
  COMPLIANCE_OFFICER: 'Document verification and compliance',
  RENTAL_MANAGER:     'Rental calendar and handovers',
  SALES_AGENT:        'Vehicle sales listings',
  AUDITOR:            'Read-only audit log access',
  DRIVER:             'Vehicle operations and rider hub',
  VIEWER:             'Personal account (owner / customer / provider)',
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user }: { user: UserRecord }) {
  return (
    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">
      {user.firstName[0]}{user.lastName[0]}
    </div>
  );
}

// ─── User Modal ───────────────────────────────────────────────────────────────
function UserModal({
  isSuperAdmin,
  editing,
  onClose,
  onSave,
  saving,
}: {
  isSuperAdmin: boolean;
  editing: UserRecord | null;
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const isNew = !editing;

  const availableRoles = isSuperAdmin ? SUPER_ADMIN_CREATABLE : ADMIN_CREATABLE;
  const defaultRole    = isSuperAdmin ? 'ADMIN' : 'FLEET_MANAGER';

  const [form, setForm] = useState({
    firstName: editing?.firstName ?? '',
    lastName:  editing?.lastName  ?? '',
    email:     editing?.email     ?? '',
    phone:     editing?.phone     ?? '',
    password:  '',
    roles:     editing?.roles?.length ? editing.roles : [defaultRole],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggle(role: string) {
    if (isSuperAdmin) return; // SUPER_ADMIN always has exactly ADMIN
    setForm(p => ({
      ...p,
      roles: p.roles.includes(role)
        ? p.roles.filter(r => r !== role)
        : [...p.roles, role],
    }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim())  e.lastName  = 'Required';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required';
    if (isNew && form.password.length < 8) e.password = 'Minimum 8 characters';
    if (!isSuperAdmin && form.roles.length === 0) e.roles = 'Select at least one role';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const payload: any = {
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      email:     form.email.trim().toLowerCase(),
      phone:     form.phone.trim() || undefined,
      roles:     isSuperAdmin ? ['ADMIN'] : form.roles,
    };
    if (form.password) payload.password = form.password;
    onSave(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 my-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {editing
                ? `Edit — ${editing.firstName} ${editing.lastName}`
                : isSuperAdmin
                  ? 'Create Company Admin'
                  : 'Add Team Member'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isSuperAdmin
                ? 'Company Admins manage their own team and cannot be created by anyone else.'
                : 'Team members are managed within your company.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            {(['firstName', 'lastName'] as const).map(f => (
              <div key={f}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {f === 'firstName' ? 'First name *' : 'Last name *'}
                </label>
                <input
                  value={form[f]}
                  onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
                {errors[f] && <p className="text-xs text-red-500 mt-1">{errors[f]}</p>}
              </div>
            ))}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              disabled={!!editing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone (optional)</label>
            <input
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {/* Role selector */}
          {isSuperAdmin ? (
            /* SUPER_ADMIN — fixed to ADMIN, no choice */
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <Shield size={18} className="text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Role: Company Admin</p>
                <p className="text-xs text-orange-600 mt-0.5">
                  This account can manage their company's team, vehicles, finance and settings.
                  All other roles within that company are created by this admin.
                </p>
              </div>
            </div>
          ) : (
            /* ADMIN — full role picker, no SUPER_ADMIN / ADMIN */
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Role(s) *</label>
              <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                {ADMIN_CREATABLE.map(role => (
                  <label key={role}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition',
                      form.roles.includes(role) ? 'bg-brand-50' : 'hover:bg-gray-50'
                    )}>
                    <input
                      type="checkbox"
                      checked={form.roles.includes(role)}
                      onChange={() => toggle(role)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{role.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-400 truncate">{ROLE_DESCRIPTIONS[role] ?? ''}</p>
                    </div>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0', ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600')}>
                      {role.replace(/_/g, ' ')}
                    </span>
                  </label>
                ))}
              </div>
              {errors.roles && <p className="text-xs text-red-500 mt-1">{errors.roles}</p>}
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {editing ? 'New password (leave blank to keep)' : 'Password *'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder={editing ? '••••••••' : 'Min 8 characters'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : editing ? 'Save changes' : isSuperAdmin ? 'Create Admin' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────
function ResetPasswordModal({
  user: target,
  onClose,
  onSave,
  saving,
}: {
  user: UserRecord;
  onClose: () => void;
  onSave: (pw: string) => void;
  saving: boolean;
}) {
  const [pw, setPw]   = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setErr('Minimum 8 characters'); return; }
    if (pw !== pw2)    { setErr('Passwords do not match'); return; }
    setErr('');
    onSave(pw);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Reset Password</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg mb-4">
          <Avatar user={target} />
          <div>
            <p className="text-sm font-medium text-gray-900">{target.firstName} {target.lastName}</p>
            <p className="text-xs text-gray-500">{target.email}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-4">Sessions will be invalidated. The user must log in with the new password.</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 8 characters"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirm password</label>
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Re-enter password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Reset password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: me } = useAuthStore();
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';
  const isAdmin      = me?.role === 'ADMIN';
  const canManage    = isSuperAdmin || isAdmin;

  const qc = useQueryClient();

  const [viewAll,        setViewAll]        = useState(false);
  const [search,         setSearch]         = useState('');
  const [showUserModal,  setShowUserModal]  = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editing,        setEditing]        = useState<UserRecord | null>(null);
  const [resettingUser,  setResettingUser]  = useState<UserRecord | null>(null);

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
      (u.roles ?? [u.role]).join(' ').toLowerCase().includes(q) ||
      (u.organization?.name.toLowerCase().includes(q) ?? false)
    );
  });

  const saveMutation = useMutation({
    mutationFn: (d: any) => editing ? userApi.update(editing.id, d) : userApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(editing ? 'User updated' : isSuperAdmin ? 'Company Admin created — welcome email sent' : 'Team member added');
      setShowUserModal(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to save user'),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) => userApi.resetPassword(id, newPassword),
    onSuccess: (_, { id }) => {
      toast.success(`Password reset for ${users.find(u => u.id === id)?.firstName ?? 'user'}`);
      setShowResetModal(false);
      setResettingUser(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Reset failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => userApi.setStatus(id, isActive),
    onSuccess: (_, { isActive }) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(isActive ? 'User activated' : 'User deactivated');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {isSuperAdmin ? 'Company Admins' : 'Team Members'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isSuperAdmin
              ? 'Create and manage Company Admin accounts. Each company admin manages their own team.'
              : `${filtered.length} member${filtered.length !== 1 ? 's' : ''} in your organisation`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* All-org toggle — SUPER_ADMIN only */}
          {isSuperAdmin && (
            <div className="flex items-center bg-gray-100 rounded-lg p-1 text-sm gap-1">
              <button onClick={() => setViewAll(false)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition',
                  !viewAll ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                <Building2 size={14} /> My Org
              </button>
              <button onClick={() => setViewAll(true)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition',
                  viewAll ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                <Globe size={14} /> All Orgs
              </button>
            </div>
          )}
          <button onClick={() => { setEditing(null); setShowUserModal(true); }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            <Plus size={16} />
            {isSuperAdmin ? 'Create Company Admin' : 'Add Member'}
          </button>
        </div>
      </div>

      {/* Role scope banners */}
      {isSuperAdmin && (
        <div className="flex items-start gap-2.5 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <Shield size={15} className="shrink-0 mt-0.5 text-orange-500" />
          <span>
            <strong>Super Admin:</strong> You create Company Admin accounts only.
            Once an Admin logs into their company, they create all other roles
            (Fleet Manager, Finance, Drivers, etc.) from their own Users page.
          </span>
        </div>
      )}
      {isAdmin && (
        <div className="flex items-start gap-2.5 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info size={15} className="shrink-0 mt-0.5 text-blue-500" />
          <span>
            <strong>Company Admin:</strong> You can add any team member role
            (Fleet Manager, Finance, Driver, etc.) and enable or disable accounts
            within your organisation.
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={isSuperAdmin ? 'Search admins…' : 'Search by name, email or role…'}
          className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  'User', 'Email',
                  'Role',
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
                ? [...Array(4)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(isSuperAdmin && viewAll ? 7 : 6)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4" /></td>
                      ))}
                    </tr>
                  ))
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={isSuperAdmin && viewAll ? 7 : 6} className="px-4 py-14 text-center text-gray-400 text-sm">
                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                        {search
                          ? 'No users match your search.'
                          : isSuperAdmin
                            ? 'No company admins yet. Create the first one above.'
                            : 'No team members yet. Add your first member above.'}
                      </td>
                    </tr>
                  )
                  : filtered.map(u => (
                    <tr key={u.id} className={cn('hover:bg-gray-50 transition', !u.isActive && 'opacity-60')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar user={u} />
                          <div>
                            <p className="font-medium text-sm text-gray-900">
                              {u.firstName} {u.lastName}
                              {u.id === me?.id && <span className="ml-1.5 text-xs text-brand-600 font-medium">(you)</span>}
                            </p>
                            {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles?.length ? u.roles : [u.role]).map(role => (
                            <span key={role} className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap',
                              ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700')}>
                              {role.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </td>
                      {isSuperAdmin && viewAll && (
                        <td className="px-4 py-3 text-sm text-gray-600">{u.organization?.name ?? '—'}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-1 rounded-full font-medium',
                          u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Edit */}
                          {canManage && (isSuperAdmin || !u.role.includes('SUPER')) && (
                            <button onClick={() => { setEditing(u); setShowUserModal(true); }}
                              title="Edit" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                              <Pencil size={15} />
                            </button>
                          )}
                          {/* Reset password — SUPER_ADMIN only */}
                          {isSuperAdmin && (
                            <button onClick={() => { setResettingUser(u); setShowResetModal(true); }}
                              title="Reset password" className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition">
                              <KeyRound size={15} />
                            </button>
                          )}
                          {/* Enable / Disable — not self */}
                          {canManage && u.id !== me?.id && (
                            <button
                              onClick={() => statusMutation.mutate({ id: u.id, isActive: !u.isActive })}
                              title={u.isActive ? 'Disable account' : 'Enable account'}
                              className={cn('p-1.5 rounded-lg transition',
                                u.isActive
                                  ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50')}>
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

      {/* Add/Edit modal */}
      {showUserModal && (
        <UserModal
          isSuperAdmin={isSuperAdmin}
          editing={editing}
          onClose={() => { setShowUserModal(false); setEditing(null); }}
          onSave={d => saveMutation.mutate(d)}
          saving={saveMutation.isPending}
        />
      )}

      {/* Reset password modal */}
      {showResetModal && resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => { setShowResetModal(false); setResettingUser(null); }}
          onSave={pw => resetMutation.mutate({ id: resettingUser.id, newPassword: pw })}
          saving={resetMutation.isPending}
        />
      )}
    </div>
  );
}
