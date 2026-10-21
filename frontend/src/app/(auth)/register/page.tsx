'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, Loader2, Truck, Mail, Lock, User, Building2, Globe,
} from 'lucide-react';

const schema = z.object({
  orgName:    z.string().min(2, 'Company name required'),
  firstName:  z.string().min(1, 'Required'),
  lastName:   z.string().min(1, 'Required'),
  email:      z.string().email('Valid email required'),
  password:   z.string().min(8, 'Min 8 characters'),
  confirm:    z.string().min(8, 'Required'),
  country:    z.string().default('Rwanda'),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type Form = z.infer<typeof schema>;

export default function RegisterPage() {
  const router      = useRouter();
  const { setAuth } = useAuthStore();
  const [showPwd,  setShowPwd]  = useState(false);
  const [showConf, setShowConf] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema), defaultValues: { country: 'Rwanda' } });

  async function onSubmit(data: Form) {
    try {
      const { confirm, ...payload } = data;
      const result = await authApi.register(payload);
      setAuth(result.user, result.accessToken, result.refreshToken);
      toast.success(`Welcome to ARTIC VMS, ${result.user.firstName}!`);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Registration failed. Please try again.');
    }
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
      <div className="w-full max-w-lg bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-7 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-0.5">Create your organization</h2>
        <p className="text-brand-300 text-sm mb-6">Set up ARTIC VMS for your company in under a minute</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Company name */}
          <div>
            <label className="block text-sm font-medium text-brand-200 mb-1.5">Company / Organization name</label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <input {...register('orgName')} placeholder="ACME Transport Ltd"
                className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            {errors.orgName && <p className="text-red-400 text-xs mt-1">{errors.orgName.message}</p>}
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brand-200 mb-1.5">First name</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                <input {...register('firstName')} placeholder="Jean"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
              </div>
              {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-200 mb-1.5">Last name</label>
              <input {...register('lastName')} placeholder="Kagabo"
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
              {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-brand-200 mb-1.5">Work email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <input {...register('email')} type="email" autoComplete="email" placeholder="you@company.com"
                className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-brand-200 mb-1.5">Country</label>
            <div className="relative">
              <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <select {...register('country')}
                className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none">
                {['Rwanda','Uganda','Kenya','Tanzania','Burundi','DRC','Ethiopia','Other'].map(c =>
                  <option key={c} value={c} className="bg-brand-900 text-white">{c}</option>)}
              </select>
            </div>
          </div>

          {/* Password fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brand-200 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                <input {...register('password')} type={showPwd ? 'text' : 'password'} placeholder="Min 8 chars"
                  className="w-full pl-9 pr-9 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-400 hover:text-white">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-200 mb-1.5">Confirm</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                <input {...register('confirm')} type={showConf ? 'text' : 'password'} placeholder="Re-enter"
                  className="w-full pl-9 pr-9 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                <button type="button" onClick={() => setShowConf(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-400 hover:text-white">
                  {showConf ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.confirm && <p className="text-red-400 text-xs mt-1">{errors.confirm.message}</p>}
            </div>
          </div>

          <p className="text-brand-400 text-xs">
            By registering, you agree to ARTIC VMS terms of service. Your account will be set up as the Company Administrator.
          </p>

          <button type="submit" disabled={isSubmitting}
            className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25">
            {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> Creating account…</> : 'Create organization'}
          </button>
        </form>

        <p className="text-center text-sm text-brand-400 mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-300 hover:text-white font-medium transition">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
