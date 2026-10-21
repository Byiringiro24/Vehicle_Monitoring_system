'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Building2, Users, Truck, Shield, CreditCard, CheckCircle2,
  AlertTriangle, Search, X, ChevronRight, Activity, RefreshCw,
  BarChart3, Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MetricCard } from '@/components/ui/MetricCard';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrgRow {
  id: string; name: string; email?: string; country: string;
  createdAt: string;
  _count: { users: number; vehicles: number };
  subscription?: {
    status: string; seats: number; seatsUsed: number;
    trialEndsAt?: string; currentPeriodEnd?: string;
    plan?: { name: string; tier: string };
  };
}

const STATUS_COLORS: Record<string, string> = {
  TRIAL:      'bg-blue-100 text-blue-800',
  ACTIVE:     'bg-green-100 text-green-800',
  PAST_DUE:   'bg-amber-100 text-amber-800',
  SUSPENDED:  'bg-orange-100 text-orange-800',
  CANCELLED:  'bg-red-100 text-red-800',
  EXPIRED:    'bg-gray-100 text-gray-700',
};

const TIER_COLORS: Record<string, string> = {
  FREE:       'bg-gray-100 text-gray-700',
  STARTER:    'bg-blue-100 text-blue-800',
  BUSINESS:   'bg-purple-100 text-purple-800',
  ENTERPRISE: 'bg-yellow-100 text-yellow-900',
  CUSTOM:     'bg-pink-100 text-pink-800',
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PlatformPage() {
  const { user }  = useAuthStore();
  const router    = useRouter();
  const qc        = useQueryClient();

  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState<OrgRow | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [planId, setPlanId]   = useState('');
  const [seats, setSeats]     = useState('');
  const [trialDays, setTrialDays] = useState('14');

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <Shield size={40} className="text-gray-300" />
        <p className="text-lg font-semibold text-gray-700">Access Restricted</p>
        <p className="text-sm text-gray-500">Only Super Admins can access the platform control panel.</p>
      </div>
    );
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: stats }  = useQuery({ queryKey: ['platform-stats'],  queryFn: platformApi.stats });
  const { data: orgsData, isLoading } = useQuery({
    queryKey: ['platform-orgs', search],
    queryFn:  () => platformApi.organizations({ search, limit: 100 }),
  });
  const { data: plans = [] } = useQuery({ queryKey: ['platform-plans'], queryFn: platformApi.plans });

  const orgs: OrgRow[] = orgsData?.data ?? [];

  // ── Activate subscription mutation ────────────────────────────────────────
  const subMutation = useMutation({
    mutationFn: () => platformApi.activateSub(selected!.id, {
      planId,
      seats: seats ? parseInt(seats) : undefined,
      trialDays: trialDays ? parseInt(trialDays) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-orgs'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success('Subscription activated');
      setShowSubModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Control</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Super Admin dashboard — manage all companies, subscriptions and entitlements
        </p>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Companies"  value={stats.totalOrgs}    icon={Building2} iconBg="bg-blue-50"   iconColor="text-blue-600" />
          <MetricCard title="Active Companies" value={stats.activeOrgs}   icon={Globe}     iconBg="bg-green-50"  iconColor="text-green-600" />
          <MetricCard title="Total Users"      value={stats.totalUsers}   icon={Users}     iconBg="bg-purple-50" iconColor="text-purple-600" />
          <MetricCard title="Total Vehicles"   value={stats.totalVehicles} icon={Truck}    iconBg="bg-amber-50"  iconColor="text-amber-600" />
        </div>
      )}

      {/* Subscription breakdown */}
      {stats?.subscriptionsByStatus?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Subscriptions by status</h2>
          <div className="flex flex-wrap gap-3">
            {stats.subscriptionsByStatus.map((s: any) => (
              <div key={s.status} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold', STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-700')}>
                {s.status} &mdash; {s._count}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organizations table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">All Companies</h2>
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search companies…"
              className="w-full pl-8 pr-7 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={13} /></button>}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Company', 'Country', 'Plan', 'Status', 'Users', 'Vehicles', 'Registered', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4" /></td>)}
                    </tr>
                  ))
                : orgs.map(org => (
                    <tr key={org.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                            <Building2 size={15} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900">{org.name}</p>
                            {org.email && <p className="text-xs text-gray-400">{org.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{org.country}</td>
                      <td className="px-4 py-3">
                        {org.subscription?.plan ? (
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TIER_COLORS[org.subscription.plan.tier] ?? 'bg-gray-100')}>
                            {org.subscription.plan.name}
                          </span>
                        ) : <span className="text-xs text-gray-400">No plan</span>}
                      </td>
                      <td className="px-4 py-3">
                        {org.subscription ? (
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[org.subscription.status] ?? 'bg-gray-100')}>
                            {org.subscription.status}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {org.subscription
                          ? `${org.subscription.seatsUsed} / ${org.subscription.seats}`
                          : org._count.users}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{org._count.vehicles}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(org.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setSelected(org); setPlanId(org.subscription?.plan ? '' : (plans[0]?.id ?? '')); setShowSubModal(true); }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Manage subscription"
                          >
                            <CreditCard size={14} />
                          </button>
                          <button
                            onClick={() => router.push(`/platform/${org.id}`)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                            title="View details"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Modal */}
      {showSubModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Activate Subscription</h2>
              <button onClick={() => setShowSubModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-blue-900">{selected.name}</p>
              {selected.subscription && (
                <p className="text-xs text-blue-600 mt-0.5">Current: {selected.subscription.plan?.name} · {selected.subscription.status}</p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={planId} onChange={e => setPlanId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="">Select plan…</option>
                  {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name} (${p.monthlyPriceUsd}/mo)</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seats</label>
                  <input type="number" value={seats} onChange={e => setSeats(e.target.value)}
                    placeholder="Default from plan"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trial days</label>
                  <input type="number" value={trialDays} onChange={e => setTrialDays(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowSubModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={() => subMutation.mutate()}
                disabled={!planId || subMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60"
              >
                {subMutation.isPending ? 'Activating…' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
