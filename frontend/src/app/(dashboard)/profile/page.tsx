'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { authApi, apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Key, Shield, Loader2, Building2, Mail, Phone, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  phone:     z.string().optional(),
});
const pwdSchema = z.object({
  currentPassword:  z.string().min(1, 'Current password is required'),
  newPassword:      z.string().min(8, 'Minimum 8 characters'),
  confirmPassword:  z.string().min(1, 'Please confirm your password'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PwdForm     = z.infer<typeof pwdSchema>;

type TabId = 'profile' | 'security' | 'org';

export default function ProfilePage() {
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const [tab, setTab] = useState<TabId>('profile');

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
  });

  // ── Profile form ─────────────────────────────────────────────────────────────
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    values: {
      firstName: me?.firstName ?? user?.firstName ?? '',
      lastName:  me?.lastName  ?? user?.lastName  ?? '',
      phone:     me?.phone     ?? user?.phone      ?? '',
    },
  });

  // ── Password form ─────────────────────────────────────────────────────────────
  const pwdForm = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
    mode: 'onTouched',
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const profileMutation = useMutation({
    mutationFn: (d: ProfileForm) => apiClient.put(`/users/${user?.id}`, d).then(r => r.data),
    onSuccess: (updated) => {
      // Sync the updated name back into the auth store
      if (user && accessToken && refreshToken) {
        setAuth({ ...user, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone }, accessToken, refreshToken);
      }
      toast.success('Profile updated successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to update profile'),
  });

  const pwdMutation = useMutation({
    mutationFn: (d: PwdForm) => apiClient.post('/auth/change-password', {
      currentPassword: d.currentPassword,
      newPassword: d.newPassword,
    }).then(r => r.data),
    onSuccess: () => {
      toast.success('Password changed — you will need to sign in again on other devices.');
      pwdForm.reset();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to change password'),
  });

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'profile',  label: 'Personal info', icon: <User size={14} /> },
    { id: 'security', label: 'Security',       icon: <Key size={14} /> },
    { id: 'org',      label: 'Organization',   icon: <Building2 size={14} /> },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-brand-600/25 shrink-0">
            {initials || <User size={24} />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                {user?.role?.replace(/_/g, ' ')}
              </span>
              {me?.lastLoginAt && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock size={10} /> Last login: {formatDate(me.lastLoginAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition',
              tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── PERSONAL INFO TAB ───────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <User size={16} className="text-brand-600" /> Personal Information
          </h2>
          <form onSubmit={profileForm.handleSubmit(d => profileMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {(['firstName', 'lastName'] as const).map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field === 'firstName' ? 'First name' : 'Last name'}
                  </label>
                  <input {...profileForm.register(field)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none transition" />
                  {profileForm.formState.errors[field] && (
                    <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors[field]?.message}</p>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone number
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input {...profileForm.register('phone')} placeholder="+250 78X XXX XXX"
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none transition" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={user?.email ?? ''} disabled
                  className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact your administrator.</p>
            </div>

            <button type="submit" disabled={profileMutation.isPending}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 shadow-sm shadow-brand-600/20">
              {profileMutation.isPending
                ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : <><CheckCircle2 size={14} /> Save changes</>}
            </button>
          </form>
        </div>
      )}

      {/* ── SECURITY TAB ─────────────────────────────────────────────────── */}
      {tab === 'security' && (
        <div className="space-y-4">
          {/* Change password */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
              <Key size={16} className="text-brand-600" /> Change Password
            </h2>
            <form onSubmit={pwdForm.handleSubmit(d => pwdMutation.mutate(d))} className="space-y-4">
              {([
                { name: 'currentPassword' as const,  label: 'Current password',      placeholder: 'Your current password' },
                { name: 'newPassword' as const,       label: 'New password',           placeholder: 'Min 8 characters' },
                { name: 'confirmPassword' as const,   label: 'Confirm new password',   placeholder: 'Re-enter new password' },
              ]).map(({ name, label, placeholder }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input {...pwdForm.register(name)} type="password" placeholder={placeholder}
                    autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none transition" />
                  {pwdForm.formState.errors[name] && (
                    <p className="text-red-500 text-xs mt-1">{pwdForm.formState.errors[name]?.message}</p>
                  )}
                </div>
              ))}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  Changing your password will sign you out of all other active sessions.
                </p>
              </div>
              <button type="submit" disabled={pwdMutation.isPending}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {pwdMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Updating…</>
                  : <><Key size={14} /> Update password</>}
              </button>
            </form>
          </div>

          {/* Forgot password link */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Forgot your password?</p>
              <p className="text-xs text-gray-500 mt-0.5">Use the password recovery flow to reset it securely.</p>
            </div>
            <Link href="/forgot-password"
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium transition shrink-0">
              Reset via email <ArrowRight size={13} />
            </Link>
          </div>

          {/* Account/contexts */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Manage workspaces & invitations</p>
              <p className="text-xs text-gray-500 mt-0.5">View your memberships, accept invitations, invite team members.</p>
            </div>
            <Link href="/account/contexts"
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium transition shrink-0">
              My Account <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* ── ORGANIZATION TAB ──────────────────────────────────────────────── */}
      {tab === 'org' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <Building2 size={16} className="text-brand-600" /> Organization Details
          </h2>
          {meLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : me?.organization ? (
            <div className="space-y-0">
              {[
                { label: 'Organization name', value: me.organization.name },
                { label: 'Slug / URL handle', value: me.organization.slug },
                { label: 'Status', value: me.organization.status ?? 'ACTIVE', highlight: true },
                { label: 'Your role', value: user?.role?.replace(/_/g, ' ') ?? '—' },
                { label: 'Your email', value: user?.email ?? '—' },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-500">{label}</span>
                  {highlight ? (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      value === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      value === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-600')}>
                      {value}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-gray-900">{value}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No organization data available.</p>
          )}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <Link href="/settings"
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium transition">
              Manage organization settings <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
