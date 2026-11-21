'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader2, Truck, Mail, Lock, Phone, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_HOME } from '@/lib/roles';

// Role → first page after login (kept locally for performance)
const ROLE_HOME_MAP: Record<string, string> = {
  SUPER_ADMIN:        '/platform',
  ADMIN:              '/dashboard',
  FLEET_MANAGER:      '/dispatch',
  FINANCE_MANAGER:    '/finance',
  DRIVER:             '/dashboard',
  VIEWER:             '/dashboard',
  HR_MANAGER:         '/staff',
  MECHANIC:           '/workshop',
  COMPLIANCE_OFFICER: '/compliance',
  RENTAL_MANAGER:     '/rentals',
  SALES_AGENT:        '/sales',
  AUDITOR:            '/audit-view',
};

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { setAuth }  = useAuthStore();

  const [mode,     setMode]     = useState<'email' | 'phone'>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  const activated = searchParams.get('activated') === '1';

  function validate() {
    const e: Record<string, string> = {};
    if (!identifier.trim()) e.identifier = mode === 'email' ? 'Email is required' : 'Phone number is required';
    if (mode === 'email' && identifier && !identifier.includes('@')) e.identifier = 'Enter a valid email address';
    if (!password)          e.password   = 'Password is required';
    if (password && password.length < 6) e.password = 'At least 6 characters';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = mode === 'email'
        ? { email: identifier.trim(), password }
        : { phone: identifier.trim(), password };
      const result = await authApi.login(payload as any);
      setAuth(result.user, result.accessToken, result.refreshToken);
      toast.success(`Welcome back, ${result.user.firstName}!`);

      const allRoles = Array.from(new Set([result.user.role, ...(result.user.roles ?? [])])).filter(Boolean) as string[];
      const intendedRole = (result.user as any).intendedRole as string | undefined;

      if (allRoles.length > 1 && !intendedRole) {
        router.push('/select-role');
        return;
      }

      const PERSONAL: Record<string, string> = { owner: '/owner', driver: '/dashboard', customer: '/dashboard' };
      const personalHome = intendedRole ? PERSONAL[intendedRole] : undefined;
      const primaryRole  = allRoles[0] ?? result.user.role;
      router.push(personalHome ?? ROLE_HOME_MAP[primaryRole] ?? '/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl mb-4 shadow-xl shadow-blue-600/30">
          <Truck size={30} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-wide">
          ARTIC<span className="text-cyan-400">.</span>VMS
        </h1>
        <p className="text-blue-300 text-sm mt-1 tracking-widest uppercase">Vehicle Monitoring System</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-1">Sign in</h2>
        <p className="text-slate-400 text-sm mb-5">Enter your credentials to access your workspace</p>

        {activated && (
          <div className="flex items-center gap-2.5 bg-green-500/15 border border-green-500/30 rounded-xl px-4 py-3 mb-5">
            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            <p className="text-green-300 text-sm">Your account is activated. Sign in with your new password.</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">

          {/* Email / Phone toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-300">
                {mode === 'email' ? 'Email address' : 'Phone number'}
              </label>
              <button type="button"
                onClick={() => { setMode(m => m === 'email' ? 'phone' : 'email'); setIdentifier(''); setErrors({}); }}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition">
                {mode === 'email'
                  ? <><Phone size={12} /> Use phone instead</>
                  : <><Mail size={12} /> Use email instead</>}
              </button>
            </div>
            <div className="relative">
              {mode === 'email'
                ? <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                : <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
              <input
                type={mode === 'email' ? 'email' : 'tel'}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                autoComplete={mode === 'email' ? 'email' : 'tel'}
                placeholder={mode === 'email' ? 'you@company.com' : '+250 788 000 000'}
                className={cn(
                  'w-full pl-9 pr-4 py-2.5 bg-white/10 border rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition',
                  errors.identifier ? 'border-red-500/60' : 'border-white/20'
                )}
              />
            </div>
            {errors.identifier && <p className="text-red-400 text-xs mt-1">{errors.identifier}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className={cn(
                  'w-full pl-9 pr-10 py-2.5 bg-white/10 border rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition',
                  errors.password ? 'border-red-500/60' : 'border-white/20'
                )}
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
          </div>

          {/* Forgot */}
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition">
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          New company?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition">
            Register your organization
          </Link>
        </p>
      </div>

      <p className="text-slate-600 text-xs mt-8 text-center">
        ARTIC VMS &copy; {new Date().getFullYear()} · Secure fleet management
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
        <Loader2 size={24} className="text-blue-400 animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
