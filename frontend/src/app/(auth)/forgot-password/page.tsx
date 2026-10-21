'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { ArrowLeft, Mail, Truck, CheckCircle2, Loader2 } from 'lucide-react';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    await authApi.forgotPassword(data.email);
    setSubmittedEmail(data.email);
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="text-center mb-7">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-3 shadow-xl shadow-brand-600/40">
          <Truck size={26} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-wide">
          ARTIC<span className="text-cyan-400">.</span>VMS
        </h1>
        <p className="text-brand-300 text-xs mt-0.5 tracking-widest uppercase">Vehicle Monitoring System</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
        {!sent ? (
          <>
            <h2 className="text-xl font-bold text-white mb-0.5">Forgot your password?</h2>
            <p className="text-brand-300 text-sm mb-6">
              Enter your email and we'll send you a secure reset link.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-200 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                  <input {...register('email')} type="email" autoComplete="email" placeholder="you@company.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <button type="submit" disabled={isSubmitting}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2">
                {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : 'Send reset link'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500/20 rounded-full mb-4">
              <CheckCircle2 size={30} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
            <p className="text-brand-300 text-sm leading-relaxed">
              If <span className="text-brand-200 font-medium">{submittedEmail}</span> is registered,
              you'll receive a password reset link shortly.
            </p>
            <p className="text-brand-500 text-xs mt-2">
              The link expires in 30 minutes. Check your spam folder if you don't see it.
            </p>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-white/10">
          <Link href="/login" className="flex items-center justify-center gap-2 text-brand-400 hover:text-white text-sm transition">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
