'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Headphones, ShieldAlert, AlertTriangle, CheckCircle2, Clock3, MessageSquareText, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { supportApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 border border-blue-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 border border-amber-200',
  RESOLVED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  CLOSED: 'bg-slate-200 text-slate-700 border border-slate-300',
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-red-100 text-red-800',
  CRITICAL: 'bg-red-200 text-red-900',
};

export default function PlatformSupportPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');

  const isAllowed = user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_SUPPORT';

  const { data: tickets = [] } = useQuery({
    queryKey: ['support-tickets-queue'],
    queryFn: () => supportApi.allTickets(),
    enabled: isAllowed,
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => supportApi.updateTicket(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-tickets-queue'] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Ticket updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Unable to update ticket'),
  });

  const filteredTickets = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return tickets as any[];
    return (tickets as any[]).filter((ticket: any) => {
      const haystack = `${ticket.subject ?? ''} ${ticket.userEmail ?? ''} ${ticket.userName ?? ''} ${ticket.category ?? ''}`.toLowerCase();
      return haystack.includes(text);
    });
  }, [query, tickets]);

  if (!isAllowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-red-700 shadow-sm">
          <ShieldAlert className="mx-auto mb-3" />
          <p className="text-lg font-semibold">Support access required</p>
          <p className="text-sm mt-1">Only the platform support team can view this queue.</p>
        </div>
      </div>
    );
  }

  const openCount = (tickets as any[]).filter((ticket: any) => ticket.status === 'OPEN').length;
  const myQueueCount = (tickets as any[]).filter((ticket: any) => ticket.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Restricted access</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Headphones className="text-brand-600" size={24} /> Support Queue
          </h1>
        </div>
        <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
          Access logged
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm">
            <span>Open</span>
            <AlertTriangle size={16} className="text-blue-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm">
            <span>In progress</span>
            <Clock3 size={16} className="text-amber-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{myQueueCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm">
            <span>Resolved</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{(tickets as any[]).filter((ticket: any) => ticket.status === 'RESOLVED').length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <MessageSquareText size={18} className="text-brand-600" />
            Ticket queue
          </div>
          <label className="relative block w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer, subject, email…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none ring-0 transition focus:border-brand-400 focus:bg-white"
            />
          </label>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredTickets.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">No tickets match this filter.</div>
          ) : filteredTickets.map((ticket: any) => (
            <div key={ticket.id} className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">#{ticket.id.slice(0, 8)}</span>
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLES[ticket.status] ?? 'bg-slate-100 text-slate-700')}>
                      {ticket.status?.replace('_', ' ') ?? 'OPEN'}
                    </span>
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', PRIORITY_STYLES[ticket.priority] ?? 'bg-slate-100 text-slate-700')}>
                      {ticket.priority ?? 'MEDIUM'}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-semibold text-slate-900">{ticket.subject}</h3>
                  <p className="mt-1 text-sm text-slate-600">{ticket.message}</p>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>{ticket.userName ?? 'Unknown user'}</span>
                    <span>{ticket.userEmail ?? 'No email'}</span>
                    <span>{ticket.category ?? 'general'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:items-end">
                  <button
                    type="button"
                    onClick={() => updateTicketMutation.mutate({ id: ticket.id, status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : 'RESOLVED' })}
                    className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
                    disabled={updateTicketMutation.isPending}
                  >
                    {ticket.status === 'OPEN' ? 'Take ticket' : 'Mark resolved'}
                  </button>
                  {ticket.adminNotes && (
                    <div className="max-w-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {ticket.adminNotes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
