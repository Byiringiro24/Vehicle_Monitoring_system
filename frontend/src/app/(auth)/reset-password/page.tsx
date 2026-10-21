'use client';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Truck, CheckCircle2, Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';

const schema = z.object({
  newPassword:     z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string().min(8, 'Required'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});
type Form = z.infer<typeof schema>;

function ResetForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get('token') ?? '';
  const [done, setDone]         = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [showConf, setShowConf] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  if (!token) return (
    <div className="text-center py-4">
      <ShieldAlert size={36} className="text-red-400 mx-auto mb-3" />
      <h2 className="text-xl font-bold text-white mb-2">Invalid reset link</h2>
      <p className="text-brand-300 text-sm">This link is missing or malformed. Request a new one.</p>
      <Link href="/forgot-password" className="inline-block mt-4 text-brand-300 hover:text-white text-sm underline">
        Request new link
      </Link>
    </div>
  );

  if (done) return (
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500/20 rounded-full mb-4">
        <CheckCircle2 size={30} className="text-green-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Password reset!</h2>
      <p className="text-brand-300 text-sm">Your password has been changed. Redirecting to login…</p>
    </div>
  );

  async function onSubmit(data: Form) {
    try {
      await authApi.resetPassword(token, data.newPassword);
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Reset failed. The link may have expired.');
    }
  }

  return (
    <>
      <h2 className="text-xl font-bold text-white mb-0.5">Set new password</h2>
      <p className="text-brand-300 text-sm mb-6">Choose a strong password of at least 8 characters.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-brand-200 mb-1.5">New password</label>
          <div className="relative">
            <input {...register('newPassword')} type={showPwd ? 'text' : 'password'} placeholder="Min 8 characters"
              className="w-full pl-4 pr-10 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 hover:text-white">
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.newPassword && <p className="text-red-400 text-xs mt-1">{errors.newPassword.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-200 mb-1.5">Confirm password</label>
          <div className="relative">
            <input {...register('confirmPassword')} type={showConf ? 'text' : 'password'} placeholder="Re-enter password"
              className="w-full pl-4 pr-10 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            <button type="button" onClick={() => setShowConf(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 hover:text-white">
              {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting}
          className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2">
          {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> Resetting…</> : 'Reset password'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-7">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-3 shadow-xl shadow-brand-600/40">
          <Truck size={26} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-wide">
          ARTIC<span className="text-cyan-400">.</span>VMS
        </h1>
      </div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
        <Suspense fallback={<div className="text-brand-400 text-sm text-center py-4">Loading…</div>}>
          <ResetForm />
        </Suspense>
        <div className="mt-6 pt-5 border-t border-white/10">
          <Link href="/login" className="flex items-center justify-center gap-2 text-brand-400 hover:text-white text-sm transition">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
