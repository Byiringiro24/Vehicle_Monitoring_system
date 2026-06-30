'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertApi } from '@/lib/api';
import { getSeverityColor, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { Bell, CheckCircle, X, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export default function AlertsPage() {
  const qc = useQueryClient();
  const { accessToken } = useAuthStore();
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', status, severity],
    queryFn: () => alertApi.list({ status: status || undefined, severity: severity || undefined }),
    refetchInterval: 30000,
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
    socket.on('alert:new', (alert: any) => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      toast.error(🚨  — );
    });
    return () => { socket.off('alert:new'); };
  }, [accessToken, qc]);

  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="text-gray-500 text-sm">{data?.total ?? 0} total alerts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
          <option value="">All Status</option>
          {['ACTIVE','ACKNOWLEDGED','RESOLVED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
          <option value="">All Severity</option>
          {['CRITICAL','HIGH','MEDIUM','LOW','INFO'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {isLoading ? [...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
        )) : alerts.map((alert: any) => (
          <div key={alert.id} className={cn('bg-white rounded-xl border p-4 flex items-start gap-4 shadow-sm', getSeverityColor(alert.severity))}>
            <Bell size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', getSeverityColor(alert.severity))}>
                  {alert.severity}
                </span>
                <p className="font-semibold text-sm text-gray-900">{alert.title}</p>
              </div>
              <p className="text-sm mt-0.5">{alert.message}</p>
              <p className="text-xs opacity-60 mt-1">
                {alert.vehicle?.name} · {alert.vehicle?.licensePlate} · {formatDate(alert.triggeredAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('text-xs px-2 py-1 rounded-full font-medium',
                alert.status === 'ACTIVE' ? 'bg-red-100 text-red-700' :
                alert.status === 'ACKNOWLEDGED' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700')}>
                {alert.status}
              </span>
              {alert.status === 'ACTIVE' && (
                <button onClick={() => ackMutation.mutate(alert.id)}
                  className="p-1.5 hover:bg-yellow-100 rounded-lg transition" title="Acknowledge">
                  <CheckCircle size={16} className="text-yellow-600" />
                </button>
              )}
              {alert.status !== 'RESOLVED' && (
                <button onClick={() => resolveMutation.mutate(alert.id)}
                  className="p-1.5 hover:bg-green-100 rounded-lg transition" title="Resolve">
                  <X size={16} className="text-green-600" />
                </button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && !alerts.length && (
          <div className="text-center py-16 text-gray-400">
            <Bell size={48} className="mx-auto mb-3 opacity-20" />
            <p>No alerts found</p>
          </div>
        )}
      </div>
    </div>
  );
}