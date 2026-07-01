'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { authApi, apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Key, Shield, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});
const pwdSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

type ProfileForm = z.infer<typeof profileSchema>;
type PwdForm = z.infer<typeof pwdSchema>;

export default function ProfilePage() {
  const { user, setAuth, accessToken, refreshToken: rt } = useAuthStore();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me });

  const { register: rp, handleSubmit: hp, formState: { errors: ep, isSubmitting: sp } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: me?.firstName ?? user?.firstName, lastName: me?.lastName ?? user?.lastName, phone: me?.phone ?? '' },
  });

  const { register: rpwd, handleSubmit: hpwd, reset: resetPwd, formState: { errors: epwd, isSubmitting: spwd } } = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
  });

  const profileMutation = useMutation({
    mutationFn: (d: ProfileForm) => apiClient.put(`/users/${user?.id}`, d).then(r => r.data),
    onSuccess: () => toast.success('Profile updated'),
    onError: () => toast.error('Update failed'),
  });

  const pwdMutation = useMutation({
    mutationFn: (d: PwdForm) => apiClient.post('/auth/change-password', d).then(r => r.data),
    onSuccess: () => { toast.success('Password changed'); resetPwd(); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm">Manage your account settings</p>
      </div>

      {/* Profile info card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-white text-2xl font-bold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <p className="text-xl font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
            <p className="text-gray-500">{user?.email}</p>
            <p className="text-xs mt-1 bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full inline-block font-medium">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>

        <form onSubmit={hp(d => profileMutation.mutate(d))} className="space-y-4">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2"><User size={16} /> Personal Information</h3>
          <div className="grid grid-cols-2 gap-4">
            {(['firstName', 'lastName'] as const).map(f => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f === 'firstName' ? 'First Name' : 'Last Name'}</label>
                <input {...rp(f)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                {ep[f] && <p className="text-red-500 text-xs mt-1">{ep[f]?.message}</p>}
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input {...rp('phone')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="+254 700 000000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input value={user?.email ?? ''} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact admin.</p>
          </div>
          <button type="submit" disabled={sp}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
            {sp ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Change password card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={hpwd(d => pwdMutation.mutate(d))} className="space-y-4">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2"><Key size={16} /> Change Password</h3>
          {[
            { name: 'currentPassword' as const, label: 'Current Password' },
            { name: 'newPassword' as const, label: 'New Password' },
            { name: 'confirmPassword' as const, label: 'Confirm New Password' },
          ].map(({ name, label }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input {...rpwd(name)} type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              {epwd[name] && <p className="text-red-500 text-xs mt-1">{epwd[name]?.message}</p>}
            </div>
          ))}
          <button type="submit" disabled={spwd}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
            {spwd ? <><Loader2 size={16} className="animate-spin" /> Updating...</> : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Organization info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-4"><Shield size={16} /> Organization</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {me?.organization && [
            ['Name', me.organization.name],
            ['Slug', me.organization.slug],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-gray-500 mb-0.5">{k}</dt><dd className="font-medium text-gray-900">{v}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}