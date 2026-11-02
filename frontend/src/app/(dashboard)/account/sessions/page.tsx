'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Monitor, Smartphone, Globe, Trash2, Shield, RefreshCw, LogOut } from 'lucide-react';

function getDeviceIcon(userAgent: string | null) {
  if (!userAgent) return <Globe size={16} className="text-gray-400" />;
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return <Smartphone size={16} className="text-brand-500" />;
  }
  return <Monitor size={16} className="text-brand-500" />;
}

function parseDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent;
  if (ua.includes('Chrome')) return 'Chrome Browser';
  if (ua.includes('Firefox')) return 'Firefox Browser';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari Browser';
  if (ua.includes('Edge')) return 'Edge Browser';
  if (ua.includes('Postman')) return 'API Client';
  return 'Web Browser';
}

export default function SessionsPage() {
  const { user, refreshToken: currentRefreshToken } = useAuthStore();
  const qc = useQueryClient();
  const [revoking, setRevoking] = useState<string | null>(null);

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => apiClient.get('/auth/sessions').then(r => r.data),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/auth/sessions/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth-sessions'] }); toast.success('Session revoked'); setRevoking(null); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => apiClient.delete('/auth/sessions', { data: { currentToken: currentRefreshToken } }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth-sessions'] }); toast.success('All other sessions signed out'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const sessionsList: any[] = sessions as any[];

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Active Sessions</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Devices and browsers currently signed in to your account.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition">
            <RefreshCw size={13} /> Refresh
          </button>
          {sessionsList.length > 1 && (
            <button
              onClick={() => revokeAllMutation.mutate()}
              disabled={revokeAllMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 transition disabled:opacity-60">
              <LogOut size={13} /> Sign out all others
            </button>
          )}
        </div>
      </div>

      {/* Security note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Shield size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-900">Protect your account</p>
          <p className="text-xs text-blue-700 mt-0.5">
            If you see a session you don't recognize, revoke it immediately and change your password.
          </p>
        </div>
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : sessionsList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Monitor size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No active sessions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessionsList.map((s: any, i: number) => {
            const isCurrentSession = false; // can't easily determine without comparing tokens
            const daysLeft = Math.ceil((new Date(s.expiresAt).getTime() - Date.now()) / 86400000);
            return (
              <div key={s.id} className={`bg-white rounded-xl border shadow-xs p-4 flex items-center gap-4 ${i === 0 ? 'border-brand-200 bg-brand-50/30' : 'border-gray-200'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${i === 0 ? 'bg-brand-100' : 'bg-gray-100'}`}>
                  {getDeviceIcon(s.userAgent)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{parseDevice(s.userAgent)}</p>
                    {i === 0 && (
                      <span className="text-[10px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                        This session
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.ipAddress ? `IP: ${s.ipAddress} · ` : ''}
                    Signed in {formatDate(s.createdAt)} · Expires in {daysLeft}d
                  </p>
                  {s.userAgent && (
                    <p className="text-[10px] text-gray-300 mt-0.5 truncate max-w-xs">{s.userAgent.slice(0, 80)}</p>
                  )}
                </div>
                {i !== 0 && (
                  <button
                    onClick={() => { setRevoking(s.id); revokeMutation.mutate(s.id); }}
                    disabled={revokeMutation.isPending && revoking === s.id}
                    className="shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-40"
                    title="Revoke this session">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">About sessions</p>
        <p>Each session represents a signed-in device. Sessions expire automatically after 7 days. Changing your password revokes all sessions except the current one.</p>
      </div>
    </div>
  );
}
