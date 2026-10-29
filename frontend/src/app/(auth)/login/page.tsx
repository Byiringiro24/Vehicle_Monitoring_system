'use client';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader2, Truck, Mail, Lock, CheckCircle2 } from 'lucide-react';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
});
type Form = z.infer<typeof schema>;

// Role → first page after login
const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN:        '/platform',
  ADMIN:              '/dashboard',
  FLEET_MANAGER:      '/dashboard',
  FINANCE_MANAGER:    '/finance',
  DRIVER:             '/dashboard',
  VIEWER:             '/dashboard',
  DISPATCHER:         '/dispatch',
  HR_MANAGER:         '/staff',
  MECHANIC:           '/workshop',
  COMPLIANCE_OFFICER: '/compliance',
  RENTAL_MANAGER:     '/rentals',
};

function LoginForm() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [show, setShow] = useState(false);

  // Show success banner when redirected here after account activation (invite flow)
  const activated = searchParams.get('activated') === '1';

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema), mode: 'onTouched' });

  async function onSubmit(data: Form) {
    try {
      const result = await authApi.login(data.email, data.password);
      setAuth(result.user, result.accessToken, result.refreshToken);
      toast.success(`Welcome back, ${result.user.firstName}!`);

      // FIX #8: For personal accounts (VIEWER/DRIVER), check stored intendedRole
      // to route them to the correct portal instead of always /dashboard
      const PERSONAL_ROLE_HOME: Record<string, string> = {
        owner:    '/owner',
        driver:   '/dashboard',
        customer: '/dashboard',
      };
      const intendedRole = (result.user as any).intendedRole as string | undefined;
      const personalHome = intendedRole ? PERSONAL_ROLE_HOME[intendedRole] : undefined;
      const home = personalHome ?? ROLE_HOME[result.user.role] ?? '/dashboard';
      router.push(home);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Login failed. Check your credentials.');
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
        <p className="text-slate-400 text-sm mb-6">Enter your credentials to access your workspace</p>

        {/* Account activated banner — shown after invite setup */}
        {activated && (
          <div className="flex items-center gap-2.5 bg-green-500/15 border border-green-500/30 rounded-xl px-4 py-3 mb-5">
            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            <p className="text-green-300 text-sm">Your account is activated. Sign in with your new password.</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                {...register('password')}
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {/* Forgot */}
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition">
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
          >
            {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        {/* Register link */}
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
