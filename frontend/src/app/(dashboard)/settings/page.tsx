'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, alertApi, membershipApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Settings, Plus, Trash2, AlertTriangle, Building2,
  CreditCard, Users, CheckCircle2, Clock, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

const ALERT_TYPES = ['SPEEDING','LOW_FUEL','ENGINE_OVERHEAT','BATTERY_LOW','IDLE_TOO_LONG','OFFLINE'];
const SEVERITIES  = ['CRITICAL','HIGH','MEDIUM','LOW'];

const PLAN_COLORS: Record<string, string> = {
  FREE:       'bg-gray-100 text-gray-700',
  STARTER:    'bg-blue-100 text-blue-800',
  BUSINESS:   'bg-purple-100 text-purple-800',
  ENTERPRISE: 'bg-amber-100 text-amber-900',
  CUSTOM:     'bg-pink-100 text-pink-800',
};

const SUB_STATUS_COLORS: Record<string, string> = {
  TRIAL:     'bg-blue-100 text-blue-800',
  ACTIVE:    'bg-green-100 text-green-800',
  PAST_DUE:  'bg-amber-100 text-amber-800',
  SUSPENDED: 'bg-orange-100 text-orange-800',
  EXPIRED:   'bg-red-100 text-red-800',
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [tab, setTab] = useState<'org' | 'subscription' | 'alerts' | 'members'>('org');
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', type: 'SPEEDING', severity: 'HIGH', threshold: '' });

  const { data: rules = [] } = useQuery({ queryKey: ['alert-rules'], queryFn: alertApi.listRules });
  const { data: org } = useQuery({ queryKey: ['org'], queryFn: () => apiClient.get('/organizations/me').then(r => r.data) });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: membershipApi.list, enabled: isAdmin });

  // Subscription data — from org detail if available
  const sub = (org as any)?.subscription;
  const entitlements: string[] = (org as any)?.entitlements?.map((e: any) => e.featureKey) ?? [];

  const deleteRule = useMutation({
    mutationFn: alertApi.deleteRule,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); toast.success('Rule deleted'); },
  });

  const createRule = useMutation({
    mutationFn: () => {
      const condKey: Record<string, string> = { SPEEDING: 'maxSpeed', LOW_FUEL: 'minFuel', ENGINE_OVERHEAT: 'maxTemp', BATTERY_LOW: 'minVoltage' };
      return alertApi.createRule({
        name: ruleForm.name, type: ruleForm.type, severity: ruleForm.severity,
        conditions: { [condKey[ruleForm.type] ?? 'value']: parseFloat(ruleForm.threshold) },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); setShowRuleForm(false); toast.success('Rule created'); },
  });

  const sevColors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-800', HIGH: 'bg-orange-100 text-orange-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800', LOW: 'bg-blue-100 text-blue-800',
  };

  const tabs = [
    { id: 'org',          label: 'Organization',  icon: Building2 },
    { id: 'subscription', label: 'Subscription',  icon: CreditCard },
    { id: 'alerts',       label: 'Alert Rules',   icon: AlertTriangle },
    ...(isAdmin ? [{ id: 'members', label: 'Members', icon: Users }] : []),
  ] as const;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Organization settings and configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition',
              tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── ORGANIZATION TAB ─────────────────────────────────────────────── */}
      {tab === 'org' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-brand-600" /> Organization Details
          </h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {org && [
              ['Name',     org.name],
              ['Email',    org.email],
              ['Phone',    org.phone],
              ['Country',  org.country],
              ['Currency', org.currency],
              ['Slug',     org.slug],
              ['Website',  org.website],
              ['Tax ID',   org.taxId],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <dt className="text-xs text-gray-400 font-medium mb-0.5">{k}</dt>
                <dd className="font-semibold text-gray-900 truncate">{v ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* ── SUBSCRIPTION TAB ─────────────────────────────────────────────── */}
      {tab === 'subscription' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-brand-600" /> Current Plan
            </h2>
            {sub ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Plan</p>
                    <span className={cn('text-sm px-3 py-1 rounded-full font-semibold', PLAN_COLORS[sub.plan?.tier ?? 'STARTER'] ?? 'bg-gray-100')}>
                      {sub.plan?.name ?? 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Status</p>
                    <span className={cn('text-sm px-3 py-1 rounded-full font-semibold', SUB_STATUS_COLORS[sub.status] ?? 'bg-gray-100')}>
                      {sub.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Seats</p>
                    <p className="text-sm font-semibold text-gray-900">{sub.seatsUsed} / {sub.seats} used</p>
                  </div>
                </div>

                {sub.status === 'TRIAL' && sub.trialEndsAt && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-sm text-blue-800">
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
                  <p className="text-xs text-gray-500 font-medium mb-2">Seat usage</p>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (sub.seatsUsed / sub.seats) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{sub.seats - sub.seatsUsed} seats available</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <CreditCard size={36} className="mx-auto mb-3 opacity-20" />
                <p className="font-medium text-gray-600">No active subscription</p>
                <p className="text-sm mt-1">Contact your system administrator to activate a plan.</p>
              </div>
            )}
          </div>

          {/* Enabled features */}
          {entitlements.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Shield size={16} className="text-brand-600" /> Enabled Features
              </h3>
              <div className="flex flex-wrap gap-2">
                {entitlements.map(f => (
                  <span key={f} className="flex items-center gap-1.5 text-xs bg-green-50 text-green-800 border border-green-200 px-2.5 py-1 rounded-full font-medium">
                    <CheckCircle2 size={11} /> {f.replace(/\./g, ' › ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ALERT RULES TAB ──────────────────────────────────────────────── */}
      {tab === 'alerts' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle size={16} className="text-brand-600" /> Alert Rules
            </h2>
            {isAdmin && (
              <button onClick={() => setShowRuleForm(!showRuleForm)}
                className="flex items-center gap-1.5 text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition">
                <Plus size={14} /> Add Rule
              </button>
            )}
          </div>

          {showRuleForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rule Name</label>
                  <input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. Speed Limit 100km/h" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={ruleForm.type} onChange={e => setRuleForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    {ALERT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
                  <select value={ruleForm.severity} onChange={e => setRuleForm(p => ({ ...p, severity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Threshold Value</label>
                  <input value={ruleForm.threshold} onChange={e => setRuleForm(p => ({ ...p, threshold: e.target.value }))}
                    type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. 100" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowRuleForm(false)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition">Cancel</button>
                <button onClick={() => createRule.mutate()} disabled={createRule.isPending || !ruleForm.name}
                  className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition disabled:opacity-60">
                  {createRule.isPending ? 'Saving…' : 'Save Rule'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {(rules as any[]).map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{rule.name}</p>
                  <p className="text-xs text-gray-400">{rule.type.replace(/_/g, ' ')} · threshold: {JSON.stringify(rule.conditions)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sevColors[rule.severity])}>{rule.severity}</span>
                  {isAdmin && (
                    <button onClick={() => deleteRule.mutate(rule.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!(rules as any[]).length && (
              <p className="text-sm text-gray-400 text-center py-6">No alert rules configured yet</p>
            )}
          </div>
        </div>
      )}

      {/* ── MEMBERS TAB (ADMIN only) ─────────────────────────────────────── */}
      {tab === 'members' && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Users size={16} className="text-brand-600" /> Team Members</h2>
            <a href="/users" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Manage users →</a>
          </div>
          <div className="divide-y divide-gray-100">
            {(members as any[]).length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No membership records yet</div>
            ) : (members as any[]).map(m => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">
                  {m.user?.firstName?.[0]}{m.user?.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.user?.firstName} {m.user?.lastName}</p>
                  <p className="text-xs text-gray-400">{m.user?.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                    {m.role?.replace(/_/g, ' ')}
                  </span>
                  <p className={cn('text-xs mt-0.5', m.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-400')}>{m.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
