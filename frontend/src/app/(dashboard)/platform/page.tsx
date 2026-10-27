'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi, supportApi } from '@/lib/api';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Building2, Users, Truck, Shield, CreditCard, CheckCircle2,
  AlertTriangle, Search, X, ChevronRight, Activity, Globe,
  Clock, XCircle, MessageSquare, Headphones, Plus, Trash2, Save,
  Mail, Phone, MessageCircle, Instagram, Video,
  BarChart3, FileText, Cpu, Database, Wifi, RefreshCw,
  CheckCircle, Circle, Edit2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MetricCard } from '@/components/ui/MetricCard';

type PlatformTab = 'companies' | 'pending' | 'tickets' | 'contacts' | 'plans' | 'audit' | 'health';

const STATUS_COLORS: Record<string, string> = {
  TRIAL:      'bg-blue-100 text-blue-800',
  ACTIVE:     'bg-green-100 text-green-800',
  PAST_DUE:   'bg-amber-100 text-amber-800',
  SUSPENDED:  'bg-orange-100 text-orange-800',
  CANCELLED:  'bg-red-100 text-red-800',
  EXPIRED:    'bg-gray-100 text-gray-700',
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  OPEN:        'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  RESOLVED:    'bg-green-100 text-green-800',
  CLOSED:      'bg-gray-100 text-gray-600',
};

const CONTACT_ICONS: Record<string, React.ReactNode> = {
  whatsapp:  <MessageCircle size={16} className="text-green-500" />,
  phone:     <Phone size={16} className="text-blue-600" />,
  mail:      <Mail size={16} className="text-red-500" />,
  email:     <Mail size={16} className="text-red-500" />,
  instagram: <Instagram size={16} className="text-pink-500" />,
  tiktok:    <Video size={16} className="text-gray-900" />,
  default:   <Globe size={16} className="text-brand-400" />,
};

export default function PlatformPage() {
  const { user }  = useAuthStore();
  const router    = useRouter();
  const qc        = useQueryClient();

  const [tab, setTab]           = useState<PlatformTab>('companies');
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [planId, setPlanId]     = useState('');
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [ticketNotes, setTicketNotes] = useState<Record<string, string>>({});

  // Contacts editor state
  const [editingContacts, setEditingContacts] = useState<any[]>([]);
  const [contactsEdited, setContactsEdited] = useState(false);

  // Plans editor state
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <Shield size={40} className="text-gray-300" />
        <p className="text-lg font-semibold text-gray-700">Super Admin only</p>
      </div>
    );
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: stats }         = useQuery({ queryKey: ['platform-stats'], queryFn: platformApi.stats });
  const { data: orgsData, isLoading } = useQuery({ queryKey: ['platform-orgs', search], queryFn: () => platformApi.organizations({ search, limit: 100 }) });
  const { data: plans = [] }    = useQuery({ queryKey: ['platform-plans'], queryFn: platformApi.plans });
  const { data: pendingOrgs = [] } = useQuery({ queryKey: ['pending-orgs'], queryFn: supportApi.pendingOrgs });
  const { data: tickets = [] }  = useQuery({ queryKey: ['support-tickets'], queryFn: () => supportApi.allTickets() });
  const { data: contacts = [] } = useQuery({
    queryKey: ['support-contacts-admin'],
    queryFn:  supportApi.contacts,
    onSuccess: (d: any[]) => { if (!contactsEdited) setEditingContacts(d.map(c => ({ ...c }))); },
  } as any);

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['platform-audit'],
    queryFn:  () => platformApi.auditLogs({ limit: 100 }),
    enabled:  tab === 'audit',
  });

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['platform-health'],
    queryFn:  () => apiClient.get('/health/detailed').then(r => r.data).catch(() => null),
    enabled:  tab === 'health',
    refetchInterval: tab === 'health' ? 15000 : false,
  });

  const orgs = orgsData?.data ?? [];
  const openTickets = (tickets as any[]).filter((t: any) => t.status === 'OPEN').length;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const subMutation = useMutation({
    mutationFn: () => platformApi.activateSub(selected!.id, { planId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-orgs'] }); qc.invalidateQueries({ queryKey: ['platform-stats'] }); toast.success('Plan activated'); setShowSubModal(false); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, planId: pid }: { id: string; planId?: string }) => supportApi.approveOrg(id, pid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-orgs'] }); qc.invalidateQueries({ queryKey: ['platform-orgs'] }); qc.invalidateQueries({ queryKey: ['platform-stats'] }); toast.success('Organization approved!'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => supportApi.rejectOrg(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-orgs'] }); toast.success('Organization rejected'); setRejectModal(null); setRejectReason(''); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const ticketMutation = useMutation({
    mutationFn: ({ id, status, adminNotes }: any) => supportApi.updateTicket(id, { status, adminNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-tickets'] }); toast.success('Ticket updated'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const contactsMutation = useMutation({
    mutationFn: () => supportApi.updateContacts(editingContacts),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-contacts'] }); qc.invalidateQueries({ queryKey: ['support-contacts-admin'] }); toast.success('Contacts saved'); setContactsEdited(false); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const planMutation = useMutation({
    mutationFn: (data: any) => data.id
      ? platformApi.updatePlan(data.id, data)
      : platformApi.createPlan(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-plans'] });
      toast.success('Plan saved');
      setShowPlanModal(false);
      setEditingPlan(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const TABS: { id: PlatformTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'companies', label: 'Companies',   icon: <Building2 size={14} /> },
    { id: 'pending',   label: 'Pending',     icon: <Clock size={14} />,         badge: (pendingOrgs as any[]).length },
    { id: 'tickets',   label: 'Support',     icon: <MessageSquare size={14} />, badge: openTickets },
    { id: 'contacts',  label: 'Contacts',    icon: <Headphones size={14} /> },
    { id: 'plans',     label: 'Plans',       icon: <CreditCard size={14} /> },
    { id: 'audit',     label: 'Audit Log',   icon: <FileText size={14} /> },
    { id: 'health',    label: 'Health',      icon: <Activity size={14} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Control</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage all companies, approvals, support and contacts</p>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Companies"      value={stats.totalOrgs}     icon={Building2}  iconBg="bg-blue-50"   iconColor="text-blue-600" />
          <MetricCard title="Pending Approval"     value={(pendingOrgs as any[]).length} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600" />
          <MetricCard title="Total Users"          value={stats.totalUsers}    icon={Users}      iconBg="bg-purple-50" iconColor="text-purple-600" />
          <MetricCard title="Open Support Tickets" value={openTickets}         icon={MessageSquare} iconBg="bg-red-50" iconColor="text-red-600" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition relative',
              tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t.icon} {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center px-1">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── COMPANIES TAB ─────────────────────────────────────────────────────── */}
      {tab === 'companies' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Active Companies</h2>
            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                className="w-full pl-8 pr-7 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={13} /></button>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b">
                <tr>{['Company','Country','Plan','Status','Users','Vehicles','Registered',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? [...Array(4)].map((_,i) => <tr key={i} className="animate-pulse">{[...Array(8)].map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4" /></td>)}</tr>)
                  : orgs.map((org: any) => (
                    <tr key={org.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0"><Building2 size={15} className="text-blue-600" /></div>
                          <div><p className="font-medium text-sm text-gray-900">{org.name}</p>{org.email && <p className="text-xs text-gray-400">{org.email}</p>}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{org.country}</td>
                      <td className="px-4 py-3 text-xs">{org.subscription?.plan?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        {org.subscription ? <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[org.subscription.status] ?? 'bg-gray-100')}>{org.subscription.status}</span> : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{org._count?.users ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{org._count?.vehicles ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(org.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setSelected(org); setPlanId(plans[0]?.id ?? ''); setShowSubModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><CreditCard size={14} /></button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PENDING TAB ───────────────────────────────────────────────────────── */}
      {tab === 'pending' && (
        <div className="space-y-4">
          {(pendingOrgs as any[]).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <CheckCircle2 size={36} className="text-green-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No pending registrations</p>
              <p className="text-gray-400 text-sm mt-1">All registrations have been reviewed.</p>
            </div>
          ) : (pendingOrgs as any[]).map((org: any) => (
            <div key={org.id} className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center shrink-0"><Clock size={20} className="text-amber-600" /></div>
                  <div>
                    <p className="font-bold text-gray-900">{org.name}</p>
                    <p className="text-sm text-gray-500">{org.email} · {org.country}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Registered: {formatDate(org.createdAt)} · {org._count?.users ?? 0} user(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none"
                    value={planId} onChange={e => setPlanId(e.target.value)}>
                    <option value="">No plan (manual later)</option>
                    {(plans as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name} — ${p.monthlyPriceUsd}/mo</option>)}
                  </select>
                  <button
                    onClick={() => approveMutation.mutate({ id: org.id, planId: planId || undefined })}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-60">
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button
                    onClick={() => { setRejectModal(org); setRejectReason(''); }}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TICKETS TAB ───────────────────────────────────────────────────────── */}
      {tab === 'tickets' && (
        <div className="space-y-3">
          {(tickets as any[]).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <MessageSquare size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No support tickets yet</p>
            </div>
          ) : (tickets as any[]).map((t: any) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TICKET_STATUS_COLORS[t.status] ?? 'bg-gray-100')}>{t.status.replace('_',' ')}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.category}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.priority}</span>
                  </div>
                  <p className="font-semibold text-gray-900 mt-1">{t.subject}</p>
                  <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{t.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{t.userName} · {t.userEmail} · {formatDate(t.createdAt)}</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0 min-w-[180px]">
                  <select
                    defaultValue={t.status}
                    onChange={e => ticketMutation.mutate({ id: t.id, status: e.target.value, adminNotes: ticketNotes[t.id] ?? t.adminNotes })}
                    className="px-2 py-1 border border-gray-300 rounded-lg text-xs outline-none">
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Admin reply (visible to user):</label>
                <div className="flex gap-2">
                  <input
                    defaultValue={t.adminNotes ?? ''}
                    onChange={e => setTicketNotes(prev => ({ ...prev, [t.id]: e.target.value }))}
                    placeholder="Type a reply…"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  <button
                    onClick={() => ticketMutation.mutate({ id: t.id, status: t.status, adminNotes: ticketNotes[t.id] ?? t.adminNotes })}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded-lg font-medium transition">
                    Save
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CONTACTS TAB ──────────────────────────────────────────────────────── */}
      {tab === 'contacts' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Support Contact Links</h2>
              <p className="text-xs text-gray-500 mt-0.5">These appear on the support page and pending-approval page for all users.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingContacts(prev => [...prev, { id: `new-${Date.now()}`, platform: '', value: '', label: '', icon: '', url: '', sortOrder: prev.length, isActive: true }]);
                  setContactsEdited(true);
                }}
                className="flex items-center gap-1.5 text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
                <Plus size={14} /> Add
              </button>
              <button
                onClick={() => contactsMutation.mutate()}
                disabled={!contactsEdited || contactsMutation.isPending}
                className="flex items-center gap-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-40">
                <Save size={14} /> {contactsMutation.isPending ? 'Saving…' : 'Save all'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {editingContacts.map((c: any, i: number) => (
              <div key={c.id ?? i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <label className="text-xs text-gray-400 block mb-0.5">Platform</label>
                  <input value={c.platform} onChange={e => { const n=[...editingContacts]; n[i]={...n[i],platform:e.target.value}; setEditingContacts(n); setContactsEdited(true); }}
                    placeholder="e.g. WhatsApp"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-0.5">Value</label>
                  <input value={c.value} onChange={e => { const n=[...editingContacts]; n[i]={...n[i],value:e.target.value}; setEditingContacts(n); setContactsEdited(true); }}
                    placeholder="+250787585826"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-0.5">URL</label>
                  <input value={c.url ?? ''} onChange={e => { const n=[...editingContacts]; n[i]={...n[i],url:e.target.value}; setEditingContacts(n); setContactsEdited(true); }}
                    placeholder="https://wa.me/..."
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-0.5">Icon key</label>
                  <input value={c.icon ?? ''} onChange={e => { const n=[...editingContacts]; n[i]={...n[i],icon:e.target.value}; setEditingContacts(n); setContactsEdited(true); }}
                    placeholder="whatsapp / mail / phone"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="flex items-end justify-end gap-1">
                  <div className="w-8 h-8 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                    {CONTACT_ICONS[(c.icon ?? '').toLowerCase()] ?? CONTACT_ICONS.default}
                  </div>
                  <button onClick={() => { setEditingContacts(prev => prev.filter((_,j)=>j!==i)); setContactsEdited(true); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PLANS TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Subscription Plans</h2>
            <button onClick={() => { setEditingPlan({ name:'', description:'', tier:'STARTER', monthlyPriceUsd:0, yearlyPriceUsd:0, maxSeats:10, maxVehicles:50, features:[] }); setShowPlanModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg transition">
              <Plus size={13} /> New plan
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(plans as any[]).map((p: any) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 relative">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.tier}</p>
                  </div>
                  <button onClick={() => { setEditingPlan(p); setShowPlanModal(true); }}
                    className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition">
                    <Edit2 size={13} />
                  </button>
                </div>
                <div className="flex items-end gap-0.5 mb-2">
                  <span className="text-2xl font-extrabold text-gray-900 tabular">${p.monthlyPriceUsd}</span>
                  <span className="text-xs text-gray-400 pb-0.5">/mo</span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>{p.maxSeats} seats · {p.maxVehicles ?? '∞'} vehicles</p>
                  {p.description && <p className="text-gray-400 line-clamp-2">{p.description}</p>}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                  {((p.features ?? []) as string[]).slice(0,3).map((f: string) => (
                    <span key={f} className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{f}</span>
                  ))}
                  {(p.features ?? []).length > 3 && <span className="text-[10px] text-gray-400">+{(p.features ?? []).length - 3}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AUDIT LOG TAB ─────────────────────────────────────────────────────── */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Audit Log</h2>
            <span className="text-xs text-gray-400">Last 100 events</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {(auditLogs as any[]).length === 0 ? (
              <div className="p-12 text-center">
                <FileText size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No audit events recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Time','Actor','Action','Target','Details'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(auditLogs as any[]).map((log: any) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{log.actorEmail ?? log.actorId?.slice(0,8)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{log.action}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{log.targetType}{log.targetId ? ` #${log.targetId.slice(0,8)}` : ''}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">{log.details ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HEALTH TAB ───────────────────────────────────────────────────────── */}
      {tab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">System Health</h2>
            <button onClick={() => refetchHealth()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          {healthLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : !health ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-500 shrink-0" />
              <div>
                <p className="font-semibold text-red-800">Health endpoint unreachable</p>
                <p className="text-sm text-red-600 mt-0.5">The backend health check returned no data. Check if the backend is running.</p>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'API Server',    status: health.status === 'ok', icon: <Cpu size={20} />,      detail: `v${health.version ?? '1.0.0'}` },
                { label: 'PostgreSQL',    status: health.db,              icon: <Database size={20} />, detail: health.dbLatency ? `${health.dbLatency}ms` : 'connected' },
                { label: 'Redis',         status: health.redis,           icon: <Activity size={20} />, detail: health.redisLatency ? `${health.redisLatency}ms` : 'connected' },
                { label: 'MQTT Broker',   status: health.mqtt,            icon: <Wifi size={20} />,     detail: health.mqttClients ? `${health.mqttClients} clients` : 'running' },
                { label: 'SMTP',          status: health.smtp,            icon: <Mail size={20} />,     detail: health.smtpHost ?? 'smtp.gmail.com' },
                { label: 'File Storage',  status: true,                   icon: <FileText size={20} />, detail: 'Local filesystem' },
              ].map(({ label, status, icon, detail }) => (
                <div key={label} className={`bg-white rounded-xl border shadow-xs p-5 flex items-center gap-4 ${status ? 'border-green-200' : 'border-red-200'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${status ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{label}</p>
                      {status
                        ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                        : <XCircle size={14} className="text-red-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {health && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
              Last checked: {formatDate(health.timestamp ?? new Date())} · Auto-refreshes every 15s
            </div>
          )}
        </div>
      )}

      {/* ── PLAN EDIT MODAL ──────────────────────────────────────────────────── */}
      {showPlanModal && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editingPlan.id ? 'Edit Plan' : 'New Plan'}</h2>
              <button onClick={() => setShowPlanModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Plan name', key: 'name', type: 'text', placeholder: 'e.g. Starter' },
                { label: 'Description', key: 'description', type: 'text', placeholder: 'Short description' },
                { label: 'Monthly price (USD)', key: 'monthlyPriceUsd', type: 'number', placeholder: '49' },
                { label: 'Yearly price (USD)', key: 'yearlyPriceUsd', type: 'number', placeholder: '470' },
                { label: 'Max seats', key: 'maxSeats', type: 'number', placeholder: '25' },
                { label: 'Max vehicles', key: 'maxVehicles', type: 'number', placeholder: '200' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={editingPlan[key] ?? ''} placeholder={placeholder}
                    onChange={e => setEditingPlan((p: any) => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                <select value={editingPlan.tier} onChange={e => setEditingPlan((p: any) => ({ ...p, tier: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  {['FREE','STARTER','BUSINESS','ENTERPRISE','CUSTOM'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPlanModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => planMutation.mutate(editingPlan)} disabled={!editingPlan.name || planMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {planMutation.isPending ? 'Saving…' : 'Save plan'}
              </button>
            </div>
          </div>
        </div>
      )}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-1">Reject Registration</h2>
            <p className="text-sm text-gray-500 mb-4">{rejectModal.name}</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder="Reason for rejection (shown to the user)…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activate plan modal */}
      {showSubModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Activate Plan</h2>
              <button onClick={() => setShowSubModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-blue-900">{selected.name}</p>
            </div>
            <select value={planId} onChange={e => setPlanId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none mb-4">
              <option value="">Select plan…</option>
              {(plans as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name} (${p.monthlyPriceUsd}/mo)</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowSubModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => subMutation.mutate()} disabled={!planId || subMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {subMutation.isPending ? 'Activating…' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
