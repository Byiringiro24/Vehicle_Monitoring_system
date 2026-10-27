'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { membershipApi, userApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Building2, User, CheckCircle2, Clock, X, Globe,
  Shield, ChevronRight, Plus, RefreshCw, Bell,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:  'bg-green-100 text-green-700',
  INVITED: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  ENDED:   'bg-gray-100 text-gray-500',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  COMPANY_OWNER:   <Building2 size={14} className="text-blue-600" />,
  COMPANY_ADMIN:   <Shield size={14} className="text-brand-600" />,
  FLEET_MANAGER:   <Globe size={14} className="text-green-600" />,
  DRIVER:          <User size={14} className="text-purple-600" />,
  default:         <User size={14} className="text-gray-500" />,
};

export default function AccountContextsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('FLEET_MANAGER');
  const [showInvite, setShowInvite] = useState(false);

  const { data: memberships = [], isLoading, refetch } = useQuery({
    queryKey: ['my-memberships'],
    queryFn: membershipApi.me,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => membershipApi.accept(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-memberships'] });
      toast.success('Invitation accepted! The workspace is now available.');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to accept invitation'),
  });

  const inviteMutation = useMutation({
    mutationFn: () => userApi.invite({ email: inviteEmail, role: inviteRole }),
    onSuccess: (data: any) => {
      toast.success(data.message ?? 'Invitation sent');
      setInviteEmail('');
      setShowInvite(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to send invitation'),
  });

  const mems: any[] = memberships as any[];
  const active  = mems.filter(m => m.status === 'ACTIVE');
  const invited = mems.filter(m => m.status === 'INVITED');

  const ROLES = ['FLEET_MANAGER','FINANCE_MANAGER','DISPATCHER','HR_MANAGER','MECHANIC','COMPLIANCE_OFFICER','RENTAL_MANAGER','DRIVER','VIEWER'];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Contexts</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            All organizations, roles and invitations linked to your account.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition">
            <RefreshCw size={13} /> Refresh
          </button>
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
            <button onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg transition">
              <Plus size={13} /> Invite user
            </button>
          )}
        </div>
      </div>

      {/* Personal account card */}
      <div className="bg-white rounded-xl border border-brand-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-brand-700">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <span className="text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full font-medium">
            {user?.role?.replace(/_/g, ' ')}
          </span>
        </div>
        {user?.organization && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
            <Building2 size={13} className="text-gray-400 shrink-0" />
            <p className="text-sm text-gray-600">{user.organization.name}</p>
            <span className={cn('ml-auto text-xs px-2 py-0.5 rounded-full font-medium',
              user.organization.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
              user.organization.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-600')}>
              {user.organization.status ?? 'ACTIVE'}
            </span>
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {invited.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell size={15} className="text-amber-500" />
            <h2 className="font-semibold text-gray-800 text-sm">Pending Invitations ({invited.length})</h2>
          </div>
          {invited.map((m: any) => (
            <div key={m.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock size={18} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{m.organization?.name ?? 'Unknown organization'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Role: {m.role?.replace(/_/g, ' ')} · Invited {m.createdAt ? formatDate(m.createdAt) : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => acceptMutation.mutate(m.id)}
                  disabled={acceptMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-60">
                  <CheckCircle2 size={12} /> Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active memberships */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">
          Active Memberships ({active.length})
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : active.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Building2 size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No active memberships</p>
            <p className="text-sm text-gray-400 mt-1">
              You'll see your company memberships here once you're part of an organization.
            </p>
          </div>
        ) : (
          active.map((m: any) => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 flex items-center gap-3 hover:border-brand-200 transition">
              <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-brand-700">
                {m.organization?.name?.slice(0, 2).toUpperCase() ?? '??'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{m.organization?.name ?? 'Unknown'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {ROLE_ICONS[m.role] ?? ROLE_ICONS.default}
                  <p className="text-xs text-gray-500">{m.role?.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[m.status] ?? 'bg-gray-100 text-gray-600')}>
                  {m.status}
                </span>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* What you can do */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">About contexts</p>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />
            Your account holds all your roles across organizations. One login, many workspaces.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />
            Accept pending invitations above to activate new workspace access.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />
            Admins can invite new users from the Users page in their organization.
          </li>
        </ul>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Invite a user</h2>
              <button onClick={() => setShowInvite(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowInvite(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={() => inviteMutation.mutate()}
                disabled={!inviteEmail || inviteMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {inviteMutation.isPending ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
