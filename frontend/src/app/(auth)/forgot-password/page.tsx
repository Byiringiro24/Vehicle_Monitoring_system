'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { ArrowLeft, Mail, Truck, CheckCircle2, Loader2 } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: Form) {
    await authApi.forgotPassword(data.email);
    // Always show success regardless of server response (prevents email enumeration)
    setSubmittedEmail(data.email);
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <Truck size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">
            ARTIC<span className="text-cyan-400">.</span>VMS
          </h1>
          <p className="text-blue-300 text-sm mt-1">Vehicle Monitoring System</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          {!sent ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white">Forgot your password?</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Enter your email address and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      {...register('email')}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Sending…</>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500/20 rounded-full mb-4">
                <CheckCircle2 size={32} className="text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                If <span className="text-blue-300 font-medium">{submittedEmail}</span> is
                registered, you'll receive a password reset link shortly.
              </p>
              <p className="text-slate-500 text-xs mt-3">
                The link expires in 30 minutes. Check your spam folder if you don't see it.
              </p>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-white/10">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-slate-400 hover:text-white text-sm transition"
            >
              <ArrowLeft size={15} /> Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
