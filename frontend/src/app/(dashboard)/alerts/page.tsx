'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertApi } from '@/lib/api';
import { getSeverityColor, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { Bell, CheckCircle, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 30;

export default function AlertsPage() {
  const qc = useQueryClient();
  const { accessToken } = useAuthStore();
  const [status,   setStatus]   = useState('');
  const [severity, setSeverity] = useState('');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [status, severity, search]);

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', status, severity, page],
    queryFn:  () => alertApi.list({
      status:   status   || undefined,
      severity: severity || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    refetchInterval: 30_000,
  });

  const ackMutation = useMutation({
    mutationFn: alertApi.acknowledge,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); toast.success('Alert acknowledged'); },
  });

  const resolveMutation = useMutation({
    mutationFn: alertApi.resolve,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); toast.success('Alert resolved'); },
  });

  // Real-time new alerts
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket.on('alert:new', (alert: { title: string; vehicle?: { name?: string } }) => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      toast.error(`🚨 ${alert.title} — ${alert.vehicle?.name ?? 'Unknown'}`);
    });
    return () => { socket.off('alert:new'); };
  }, [accessToken, qc]);

  // Client-side search filter (title, message, plate)
  const allAlerts = data?.alerts ?? [];
  const alerts = search.trim()
    ? allAlerts.filter((a: any) => {
        const q = search.toLowerCase();
        return (
          a.title?.toLowerCase().includes(q) ||
          a.message?.toLowerCase().includes(q) ||
          a.vehicle?.licensePlate?.toLowerCase().includes(q) ||
          a.vehicle?.name?.toLowerCase().includes(q)
        );
      })
    : allAlerts;

  const total = data?.total ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  // Status summary badges
  const ACTIVE       = allAlerts.filter((a: any) => a.status === 'ACTIVE').length;
  const ACKNOWLEDGED = allAlerts.filter((a: any) => a.status === 'ACKNOWLEDGED').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-gray-500 text-sm">{total} total</p>
            {ACTIVE > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {ACTIVE} active
              </span>
            )}
            {ACKNOWLEDGED > 0 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                {ACKNOWLEDGED} acknowledged
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Text search */}
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, message, plate…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
          <option value="">All Status</option>
          {['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Severity filter */}
        <select value={severity} onChange={e => setSeverity(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
          <option value="">All Severity</option>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Alert list */}
      <div className="space-y-2.5">
        {isLoading
          ? [...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))
          : alerts.length > 0
            ? alerts.map((alert: any) => (
                <div key={alert.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4 shadow-sm hover:shadow-md transition">
                  <div className={cn('w-1 self-stretch rounded-full shrink-0',
                    alert.severity === 'CRITICAL' ? 'bg-red-500' :
                    alert.severity === 'HIGH'     ? 'bg-orange-500' :
                    alert.severity === 'MEDIUM'   ? 'bg-yellow-400' :
                    alert.severity === 'LOW'      ? 'bg-blue-400' : 'bg-gray-300'
                  )} />
                  <Bell size={17} className="mt-0.5 shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                        getSeverityColor(alert.severity))}>
                        {alert.severity}
                      </span>
                      <p className="font-semibold text-sm text-gray-900">{alert.title}</p>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 leading-snug">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                      <span className="font-mono">{alert.vehicle?.licensePlate}</span>
                      {alert.vehicle?.name && <><span>·</span><span>{alert.vehicle.name}</span></>}
                      <span>·</span>
                      <span>{formatDate(alert.triggeredAt)}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={cn('text-xs px-2 py-1 rounded-full font-medium',
                      alert.status === 'ACTIVE'       ? 'bg-red-100 text-red-700' :
                      alert.status === 'ACKNOWLEDGED' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-green-100 text-green-700')}>
                      {alert.status}
                    </span>
                    <div className="flex items-center gap-1">
                      {alert.status === 'ACTIVE' && (
                        <button onClick={() => ackMutation.mutate(alert.id)}
                          disabled={ackMutation.isPending}
                          className="p-1.5 hover:bg-yellow-100 rounded-lg transition" title="Acknowledge">
                          <CheckCircle size={15} className="text-yellow-600" />
                        </button>
                      )}
                      {alert.status !== 'RESOLVED' && (
                        <button onClick={() => resolveMutation.mutate(alert.id)}
                          disabled={resolveMutation.isPending}
                          className="p-1.5 hover:bg-green-100 rounded-lg transition" title="Resolve">
                          <X size={15} className="text-green-600" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            : (
              <div className="text-center py-16 text-gray-400">
                <Bell size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-medium text-gray-500">
                  {search ? 'No alerts match your search' : 'No alerts found'}
                </p>
              </div>
            )
        }
      </div>

      {/* Pagination — only shown when not doing a local search */}
      {!search && pages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-500">
            Page {page} of {pages} · {total} alerts
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
              const p = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : Math.min(page + i - 3, pages - 6 + i);
              if (p < 1 || p > pages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={cn('px-3 py-1 text-xs rounded-lg transition',
                    p === page ? 'bg-brand-600 text-white font-semibold' : 'border border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
