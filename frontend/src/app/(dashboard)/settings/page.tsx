'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Settings,
  Plus,
  Trash2,
  AlertTriangle,
  Building2,
  Loader2,
  Mail,
  UserPlus,
  CreditCard,
  Users,
  CheckCircle2,
  Clock,
  Shield,
} from 'lucide-react';

import { apiClient, alertApi, membershipApi, userApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const ALERT_TYPES = ['SPEEDING', 'LOW_FUEL', 'ENGINE_OVERHEAT', 'BATTERY_LOW', 'IDLE_TOO_LONG', 'OFFLINE'];
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-700',
  STARTER: 'bg-blue-100 text-blue-800',
  BUSINESS: 'bg-purple-100 text-purple-800',
  ENTERPRISE: 'bg-amber-100 text-amber-900',
  CUSTOM: 'bg-pink-100 text-pink-800',
};

const SUB_STATUS_COLORS: Record<string, string> = {
  TRIAL: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAST_DUE: 'bg-amber-100 text-amber-800',
  SUSPENDED: 'bg-orange-100 text-orange-800',
  EXPIRED: 'bg-red-100 text-red-800',
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [tab, setTab] = useState<'org' | 'subscription' | 'alerts' | 'members' | 'invite'>('org');
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', type: 'SPEEDING', severity: 'HIGH', threshold: '' });

  const { data: rules = [] } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: alertApi.listRules,
  });

  const { data: org } = useQuery({
    queryKey: ['org'],
    queryFn: () => apiClient.get('/organizations/me').then((r) => r.data),
  });

  const [orgForm, setOrgForm] = useState<any>({
    name: '', description: '', email: '', phone: '', address: '', website: '', country: 'Rwanda', currency: 'RWF', taxId: '',
  });

  const orgMutation = useMutation({
    mutationFn: (payload: any) => apiClient.put('/organizations/me', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org'] });
      toast.success('Organization details updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to update organization details'),
  });

  useEffect(() => {
    if (org) {
      setOrgForm({
        name: org.name ?? '',
        description: org.description ?? '',
        email: org.email ?? '',
        phone: org.phone ?? '',
        address: org.address ?? '',
        website: org.website ?? '',
        country: org.country ?? 'Rwanda',
        currency: org.currency ?? 'RWF',
        taxId: org.taxId ?? '',
      });
    }
  }, [org]);

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: membershipApi.list,
    enabled: isAdmin,
  });

  const sub = (org as any)?.subscription;
  const entitlements: string[] = (org as any)?.entitlements?.map((e: any) => e.featureKey) ?? [];

  const deleteRule = useMutation({
    mutationFn: alertApi.deleteRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-rules'] });
      toast.success('Rule deleted');
    },
  });

  const createRule = useMutation({
    mutationFn: () => {
      const condKey: Record<string, string> = {
        SPEEDING: 'maxSpeed',
        LOW_FUEL: 'minFuel',
        ENGINE_OVERHEAT: 'maxTemp',
        BATTERY_LOW: 'minVoltage',
      };

      return alertApi.createRule({
        name: ruleForm.name,
        type: ruleForm.type,
        severity: ruleForm.severity,
        conditions: {
          [condKey[ruleForm.type] ?? 'value']: Number(ruleForm.threshold),
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-rules'] });
      setShowRuleForm(false);
      toast.success('Rule created');
    },
  });

  const sevColors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-800',
    HIGH: 'bg-orange-100 text-orange-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW: 'bg-blue-100 text-blue-800',
  };

  const tabs = [
    { id: 'org', label: 'Organization', icon: Building2 },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'alerts', label: 'Alert Rules', icon: AlertTriangle },
    ...(isAdmin
      ? [
          { id: 'members', label: 'Members', icon: Users },
          { id: 'invite', label: 'Invite', icon: Shield },
        ]
      : []),
  ] as const;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-100 p-2.5 text-brand-700">
          <Settings size={18} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Organization settings and configuration</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'org' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-800">
            <Building2 size={16} className="text-brand-600" />
            Organization Details
          </h2>

          <div className="mb-4 flex justify-end">
            {isAdmin && (
              <button
                onClick={() => orgMutation.mutate(orgForm)}
                disabled={orgMutation.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {orgMutation.isPending ? 'Saving...' : 'Save changes'}
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-gray-700">
              <span>Name</span>
              <input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              <span>Email</span>
              <input value={orgForm.email} onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              <span>Phone</span>
              <input value={orgForm.phone} onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              <span>Website</span>
              <input value={orgForm.website} onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 sm:col-span-2">
              <span>Address</span>
              <textarea value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              <span>Country</span>
              <input value={orgForm.country} onChange={(e) => setOrgForm({ ...orgForm, country: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              <span>Currency</span>
              <input value={orgForm.currency} onChange={(e) => setOrgForm({ ...orgForm, currency: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              <span>Tax ID</span>
              <input value={orgForm.taxId} onChange={(e) => setOrgForm({ ...orgForm, taxId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 sm:col-span-2">
              <span>Description</span>
              <textarea value={orgForm.description} onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
          </div>
        </div>
      )}

      {tab === 'subscription' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-800">
              <CreditCard size={16} className="text-brand-600" />
              Current Plan
            </h2>

            {sub ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="mb-1 text-xs text-gray-400">Plan</p>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-sm font-semibold',
                        PLAN_COLORS[sub.plan?.tier ?? 'STARTER'] ?? 'bg-gray-100 text-gray-700',
                      )}
                    >
                      {sub.plan?.name ?? 'Unknown'}
                    </span>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-gray-400">Status</p>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-sm font-semibold',
                        SUB_STATUS_COLORS[sub.status] ?? 'bg-gray-100 text-gray-700',
                      )}
                    >
                      {sub.status}
                    </span>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-gray-400">Seats</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {sub.seatsUsed} / {sub.seats} used
                    </p>
                  </div>
                </div>

                {sub.status === 'TRIAL' && sub.trialEndsAt && (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
                    <Clock size={14} className="shrink-0" />
                    Trial ends {formatDate(sub.trialEndsAt)}
                  </div>
                )}

                {sub.currentPeriodEnd && (
                  <p className="text-xs text-gray-400">
                    Current period: {formatDate(sub.currentPeriodStart)} → {formatDate(sub.currentPeriodEnd)}
                  </p>
                )}

                <div>
                  <p className="mb-2 text-xs font-medium text-gray-500">Seat usage</p>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${Math.min(100, (sub.seatsUsed / sub.seats) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{sub.seats - sub.seatsUsed} seats available</p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400">
                <CreditCard size={36} className="mx-auto mb-3 opacity-20" />
                <p className="font-medium text-gray-600">No active subscription</p>
                <p className="mt-1 text-sm">Contact your system administrator to activate a plan.</p>
              </div>
            )}
          </div>

          {entitlements.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-800">
                <Shield size={16} className="text-brand-600" />
                Enabled Features
              </h3>

              <div className="flex flex-wrap gap-2">
                {entitlements.map((feature) => (
                  <span
                    key={feature}
                    className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800"
                  >
                    <CheckCircle2 size={11} />
                    {feature.replace(/\./g, ' › ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800">
              <AlertTriangle size={16} className="text-brand-600" />
              Alert Rules
            </h2>

            {isAdmin && (
              <button
                onClick={() => setShowRuleForm((current) => !current)}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                <Plus size={14} />
                Add Rule
              </button>
            )}
          </div>

          {showRuleForm && (
            <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Rule Name</label>
                  <input
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. Speed Limit 100km/h"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
                  <select
                    value={ruleForm.type}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {ALERT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Severity</label>
                  <select
                    value={ruleForm.severity}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, severity: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {SEVERITIES.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Threshold Value</label>
                  <input
                    value={ruleForm.threshold}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, threshold: e.target.value }))}
                    type="number"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. 100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRuleForm(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createRule.mutate()}
                  disabled={createRule.isPending || !ruleForm.name}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {createRule.isPending ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {(rules as any[]).map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{rule.name}</p>
                  <p className="text-xs text-gray-400">
                    {rule.type.replace(/_/g, ' ')} · threshold: {JSON.stringify(rule.conditions)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', sevColors[rule.severity])}>
                    {rule.severity}
                  </span>

                  {isAdmin && (
                    <button
                      onClick={() => deleteRule.mutate(rule.id)}
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!(rules as any[]).length && (
              <p className="py-6 text-center text-sm text-gray-400">No alert rules configured yet</p>
            )}
          </div>
        </div>
      )}

      {tab === 'members' && isAdmin && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800">
              <Users size={16} className="text-brand-600" />
              Team Members
            </h2>
            <a href="/users" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Manage users →
            </a>
          </div>

          <div className="divide-y divide-gray-100">
            {(members as any[]).length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No membership records yet</div>
            ) : (
              (members as any[]).map((member: any) => (
                <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {member.user?.firstName?.[0]}
                    {member.user?.lastName?.[0]}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {member.user?.firstName} {member.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{member.user?.email}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {member.role?.replace(/_/g, ' ')}
                    </span>
                    <p className={cn('mt-0.5 text-xs', member.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-400')}>
                      {member.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'invite' && isAdmin && <InviteTab />}
    </div>
  );
}

function InviteTab() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('FLEET_MANAGER');
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const ROLES = [
    'FLEET_MANAGER',
    'FINANCE_MANAGER',
    'DISPATCHER',
    'HR_MANAGER',
    'MECHANIC',
    'COMPLIANCE_OFFICER',
    'RENTAL_MANAGER',
    'DRIVER',
    'VIEWER',
  ];

  const inviteMutation = useMutation({
    mutationFn: () =>
      userApi.invite({
        email: email.trim(),
        role,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      }),
    onSuccess: (data: any) => {
      setSent(data.message ?? `Invitation sent to ${email}`);
      setEmail('');
      setFirst('');
      setLast('');
      toast.success(data.message ?? 'Invitation sent');
    },
    onError: (error: any) => toast.error(error.response?.data?.error ?? 'Failed to send invitation'),
  });

  return (
    <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-gray-800">
          <UserPlus size={16} className="text-brand-600" />
          Invite a team member
        </h2>
        <p className="text-sm text-gray-500">
          Enter their email address and select a role. If they do not have an account yet, they will receive
          a setup link. If they already have an account, their role will be updated.
        </p>
      </div>

      {sent && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 size={16} className="shrink-0 text-green-600" />
          <p className="text-sm text-green-800">{sent}</p>
          <button onClick={() => setSent(null)} className="ml-auto text-xs text-green-600 hover:text-green-700">
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email address *</label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">First name (optional)</label>
            <input
              value={firstName}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="Jean"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Last name (optional)</label>
            <input
              value={lastName}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Kagabo"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Role *</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            {ROLES.map((entry) => (
              <option key={entry} value={entry}>
                {entry.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <p className="mt-1 text-xs text-gray-400">
            The invited person will only have access to features allowed by this role.
          </p>
        </div>
      </div>

      <button
        onClick={() => inviteMutation.mutate()}
        disabled={!email.trim() || inviteMutation.isPending}
        className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {inviteMutation.isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail size={14} />
            Send invitation
          </>
        )}
      </button>

      <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-700">How invitations work:</p>
        <p>
          • <strong>New user</strong> — they receive an email with a link to set their password and activate
          their account. The link expires in 72 hours.
        </p>
        <p>
          • <strong>Existing user</strong> — their role in your organization is updated and they receive a
          notification email.
        </p>
        <p>
          • <strong>Different organization</strong> — if the email belongs to a user in another organization,
          the invitation cannot be processed automatically. They need to contact support.
        </p>
      </div>
    </div>
  );
}
