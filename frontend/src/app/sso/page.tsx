'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api';
import { Truck, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN:        '/platform',
  PLATFORM_SUPPORT:   '/platform/support',
  ADMIN:              '/dashboard',
  FLEET_MANAGER:      '/dashboard',
  FINANCE_MANAGER:    '/finance',
  DISPATCHER:         '/dispatch',
  HR_MANAGER:         '/staff',
  MECHANIC:           '/workshop',
  COMPLIANCE_OFFICER: '/compliance',
  RENTAL_MANAGER:     '/rentals',
  SALES_AGENT:        '/sales',
  AUDITOR:            '/audit-view',
  DRIVER:             '/dashboard',
  VIEWER:              '/dashboard',
};

function SsoHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No SSO token provided in the URL.');
      return;
    }

    // Exchange the one-time SSO token for real auth tokens
    apiClient
      .post('/auth/sso/exchange', { token })
      .then(({ data }) => {
        // Store the auth tokens in the Zustand store
        setAuth(data.user, data.accessToken, data.refreshToken);

        // Determine where to redirect based on role
        const role = data.user.role as string;
        const home = ROLE_HOME[role] ?? '/dashboard';

        setStatus('success');

        // Redirect after a brief delay so the user sees the success state
        setTimeout(() => {
          router.push(home);
        }, 800);
      })
      .catch((err: any) => {
        setStatus('error');
        setErrorMsg(err.response?.data?.error ?? 'SSO token expired or invalid.');
      });
  }, [token, router, setAuth]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4 shadow-xl shadow-brand-600/40">
          <Truck size={30} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-wide">
          ARTIC<span className="text-cyan-400">.</span>VMS
        </h1>
        <p className="text-brand-300 text-sm mt-1 tracking-widest uppercase">Vehicle Monitoring System</p>
      </div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
        {status === 'loading' && (
          <>
            <Loader2 size={32} className="text-brand-400 animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-1">Signing you in…</h2>
            <p className="text-brand-300 text-sm">Exchanging your secure token.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500/20 rounded-full mb-4">
              <CheckCircle2 size={28} className="text-green-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Welcome to ARTIC VMS!</h2>
            <p className="text-brand-300 text-sm">Redirecting to your dashboard…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 bg-red-500/20 rounded-full mb-4">
              <XCircle size={28} className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Sign-in failed</h2>
            <p className="text-red-300 text-sm mb-4">{errorMsg}</p>
            <Link href="/login"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">
              Go to login page
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function SsoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex items-center justify-center">
        <Loader2 size={24} className="text-brand-400 animate-spin" />
      </div>
    }>
      <SsoHandler />
    </Suspense>
  );
}
