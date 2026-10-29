'use client';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, Loader2, Truck, Mail, Lock, User, Building2, Globe,
  ArrowRight, ArrowLeft, CheckCircle, Star, ChevronRight,
} from 'lucide-react';

// ── Schemas ───────────────────────────────────────────────────────────────────
const companySchema = z.object({
  orgName:   z.string().min(2, 'Company name must be at least 2 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  email:     z.string().email('Enter a valid email address'),
  country:   z.string().default('Rwanda'),
  password:  z.string().min(8, 'Password must be at least 8 characters'),
  confirm:   z.string().min(8, 'Please confirm your password'),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

const personalSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  email:     z.string().email('Enter a valid email address'),
  phone:     z.string().optional(),
  password:  z.string().min(8, 'Password must be at least 8 characters'),
  confirm:   z.string().min(8, 'Please confirm your password'),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type CompanyForm = z.infer<typeof companySchema>;
type PersonalForm = z.infer<typeof personalSchema>;

const COUNTRIES = ['Rwanda', 'Uganda', 'Kenya', 'Tanzania', 'Burundi', 'DRC', 'Ethiopia', 'Other'];

const PLANS = [
  { id: 'free',       name: 'Free',     price: '$0',  period: '/mo', seats: '3 users',   features: ['GPS tracking', 'Vehicle profiles', '3 users'] },
  { id: 'starter',    name: 'Starter',  price: '$19', period: '/mo', seats: '10 users',  features: ['+ Drivers & alerts', 'Basic reports', 'Email notifications'] },
  { id: 'business',   name: 'Business', price: '$49', period: '/mo', seats: '25 users',  features: ['+ Finance & payroll', 'Maintenance', 'Documents & agreements'], popular: true },
  { id: 'enterprise', name: 'Enterprise', price: '$99', period: '/mo', seats: '100 users', features: ['+ AI assistant', 'Double-entry accounting', 'Custom roles'] },
];

const PERSONAL_ROLES = [
  {
    id: 'owner',
    icon: <Truck size={22} className="text-emerald-600" />,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    title: 'Vehicle Owner',
    desc: 'I own one or more vehicles and want to track income, expenses and get management proposals.',
  },
  {
    id: 'driver',
    icon: <User size={22} className="text-purple-600" />,
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    title: 'Driver / Rider',
    desc: 'I drive for a company or independently and want to see my assigned vehicle, trips and earnings.',
  },
  {
    id: 'customer',
    icon: <Star size={22} className="text-amber-600" />,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    title: 'Customer',
    desc: 'I want to rent, hire-purchase or buy a vehicle, and manage my agreements and payments.',
  },
];

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-200 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Input({ icon: Icon, type = 'text', ...props }: any) {
  return (
    <div className="relative">
      {Icon && <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />}
      <input
        type={type}
        className={`w-full ${Icon ? 'pl-9' : 'pl-4'} pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500`}
        {...props}
      />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { setAuth }  = useAuthStore();

  // Determine initial type from URL param (?type=company or ?type=personal)
  const urlType = searchParams.get('type') as 'company' | 'personal' | null;

  const [accountType, setAccountType] = useState<'company' | 'personal' | null>(urlType);
  const [step, setStep]               = useState<'type' | 'plan' | 'details' | 'role'>(
    urlType === 'company' ? 'plan' : urlType === 'personal' ? 'role' : 'type'
  );
  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [selectedRole, setSelectedRole] = useState<string | null>(
    searchParams.get('role') ?? null
  );
  const [showPwd,  setShowPwd]  = useState(false);
  const [showConf, setShowConf] = useState(false);

  // Company form
  const companyForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: { country: 'Rwanda' },
    mode: 'onTouched',
  });

  // Personal form
  const personalForm = useForm<PersonalForm>({
    resolver: zodResolver(personalSchema),
    mode: 'onTouched',
  });

  // ── Submit company registration ────────────────────────────────────────────
  async function onSubmitCompany(data: CompanyForm) {
    try {
      const { confirm, ...payload } = data;
      const result = await authApi.register({ ...payload, planHint: selectedPlan });
      setAuth(result.user, result.accessToken, result.refreshToken);
      toast.success(`Welcome, ${result.user.firstName}! Check your email — your registration is under review.`);
      router.push('/pending-approval');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Registration failed. Please try again.');
    }
  }

  // ── Submit personal registration ───────────────────────────────────────────
  async function onSubmitPersonal(data: PersonalForm) {
    try {
      const { confirm, ...payload } = data;
      const result = await authApi.registerPersonal({ ...payload, intendedRole: selectedRole });
      // FIX #3: Store intendedRole on the user object so login redirects work on future sessions
      const userWithRole = { ...result.user, intendedRole: selectedRole ?? undefined };
      setAuth(userWithRole, result.accessToken, result.refreshToken);
      toast.success(`Welcome, ${result.user.firstName}! Check your email for a welcome message.`);
      // Redirect based on intended role
      const roleHome: Record<string, string> = {
        owner:    '/owner',
        driver:   '/dashboard',
        customer: '/dashboard',
      };
      router.push(roleHome[selectedRole ?? ''] ?? '/onboarding');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Registration failed. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex flex-col items-center justify-center p-4 py-10">
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

      {/* Progress bar */}
      {accountType && (
        <div className="w-full max-w-lg mb-4 flex items-center gap-2 px-1">
          {(accountType === 'company' ? ['Plan', 'Details'] : ['Role', 'Details']).map((s, i) => {
            const stepMap = accountType === 'company' ? ['plan', 'details'] : ['role', 'details'];
            const current = stepMap.indexOf(step);
            const active  = i <= current;
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all
                  ${active ? 'bg-brand-500 text-white' : 'bg-white/10 text-brand-400'}`}>
                  {i < current ? <CheckCircle size={12} /> : i + 1}
                </div>
                <div className={`h-0.5 flex-1 rounded transition-all ${active && i < current ? 'bg-brand-500' : 'bg-white/10'}`} />
                <span className={`text-xs shrink-0 ${active ? 'text-white' : 'text-brand-400'}`}>{s}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">

          {/* ── STEP: Type selection ────────────────────────────────────────── */}
          {step === 'type' && (
            <motion.div key="type" variants={fadeUp} initial="hidden" animate="show" exit="hidden"
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-7 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-1">Create your account</h2>
              <p className="text-brand-300 text-sm mb-6">What best describes you?</p>

              <div className="space-y-3">
                <button
                  onClick={() => { setAccountType('company'); setStep('plan'); }}
                  className="w-full flex items-center gap-4 p-4 bg-white/10 hover:bg-white/15 border border-white/20 hover:border-brand-400 rounded-xl transition text-left group">
                  <div className="w-11 h-11 bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <Building2 size={22} className="text-blue-300" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white">Register a Company</p>
                    <p className="text-brand-300 text-xs mt-0.5">Fleet company, transport operator — manage multiple vehicles and staff</p>
                  </div>
                  <ChevronRight size={16} className="text-brand-400 group-hover:text-white transition" />
                </button>

                <button
                  onClick={() => { setAccountType('personal'); setStep('role'); }}
                  className="w-full flex items-center gap-4 p-4 bg-white/10 hover:bg-white/15 border border-white/20 hover:border-brand-400 rounded-xl transition text-left group">
                  <div className="w-11 h-11 bg-purple-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <User size={22} className="text-purple-300" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white">Create a Personal Account</p>
                    <p className="text-brand-300 text-xs mt-0.5">Vehicle owner, driver, rider or customer — individual access</p>
                  </div>
                  <ChevronRight size={16} className="text-brand-400 group-hover:text-white transition" />
                </button>
              </div>

              <p className="text-center text-sm text-brand-400 mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-brand-300 hover:text-white font-medium">Sign in</Link>
              </p>
            </motion.div>
          )}

          {/* ── STEP: Plan selection (company) ──────────────────────────────── */}
          {step === 'plan' && (
            <motion.div key="plan" variants={fadeUp} initial="hidden" animate="show" exit="hidden"
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-7 shadow-2xl">
              <button onClick={() => { setAccountType(null); setStep('type'); }}
                className="flex items-center gap-1.5 text-brand-400 hover:text-white text-sm mb-5 transition">
                <ArrowLeft size={14} /> Back
              </button>
              <h2 className="text-xl font-bold text-white mb-1">Choose your plan</h2>
              <p className="text-brand-300 text-sm mb-5">Plans are activated by Super Admin after approval. You can upgrade anytime.</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {PLANS.map(plan => (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                    className={`p-4 rounded-xl border text-left transition relative ${
                      selectedPlan === plan.id
                        ? 'border-brand-400 bg-brand-600/20'
                        : 'border-white/20 bg-white/5 hover:border-white/40'
                    }`}>
                    {plan.popular && (
                      <span className="absolute -top-2 -right-2 bg-brand-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">POPULAR</span>
                    )}
                    <p className="font-bold text-white text-sm">{plan.name}</p>
                    <div className="flex items-end gap-0.5 mt-0.5 mb-2">
                      <span className="text-xl font-extrabold text-brand-300">{plan.price}</span>
                      <span className="text-xs text-brand-400 pb-0.5">{plan.period}</span>
                    </div>
                    <p className="text-xs text-brand-400 mb-2">{plan.seats}</p>
                    <ul className="space-y-1">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-1.5 text-[11px] text-brand-300">
                          <CheckCircle size={10} className="text-brand-400 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    {selectedPlan === plan.id && (
                      <CheckCircle size={14} className="absolute top-3 right-3 text-brand-400" />
                    )}
                  </button>
                ))}
              </div>

              <button onClick={() => setStep('details')}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2.5 rounded-lg text-sm transition shadow-lg shadow-brand-600/25">
                Continue <ArrowRight size={15} />
              </button>
            </motion.div>
          )}

          {/* ── STEP: Role selection (personal) ─────────────────────────────── */}
          {step === 'role' && (
            <motion.div key="role" variants={fadeUp} initial="hidden" animate="show" exit="hidden"
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-7 shadow-2xl">
              <button onClick={() => { setAccountType(null); setStep('type'); }}
                className="flex items-center gap-1.5 text-brand-400 hover:text-white text-sm mb-5 transition">
                <ArrowLeft size={14} /> Back
              </button>
              <h2 className="text-xl font-bold text-white mb-1">What's your role?</h2>
              <p className="text-brand-300 text-sm mb-5">You can add more roles after registration.</p>

              <div className="space-y-3 mb-6">
                {PERSONAL_ROLES.map(r => (
                  <button key={r.id} onClick={() => setSelectedRole(r.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition text-left ${
                      selectedRole === r.id
                        ? 'border-brand-400 bg-brand-600/20'
                        : 'border-white/20 bg-white/5 hover:border-white/40'
                    }`}>
                    <div className={`w-10 h-10 ${r.bg} rounded-xl flex items-center justify-center shrink-0`}>
                      {r.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm">{r.title}</p>
                      <p className="text-brand-300 text-xs mt-0.5">{r.desc}</p>
                    </div>
                    {selectedRole === r.id && (
                      <CheckCircle size={16} className="text-brand-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep('details')}
                disabled={!selectedRole}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg text-sm transition shadow-lg shadow-brand-600/25">
                Continue <ArrowRight size={15} />
              </button>
            </motion.div>
          )}

          {/* ── STEP: Details form ──────────────────────────────────────────── */}
          {step === 'details' && accountType === 'company' && (
            <motion.div key="company-details" variants={fadeUp} initial="hidden" animate="show" exit="hidden"
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-7 shadow-2xl">
              <button onClick={() => setStep('plan')}
                className="flex items-center gap-1.5 text-brand-400 hover:text-white text-sm mb-5 transition">
                <ArrowLeft size={14} /> Back
              </button>
              <h2 className="text-xl font-bold text-white mb-0.5">Company registration</h2>
              <p className="text-brand-300 text-sm mb-6">Set up your organization in under a minute</p>

              <form onSubmit={companyForm.handleSubmit(onSubmitCompany)} className="space-y-4">
                <Field label="Company / Organization name" error={companyForm.formState.errors.orgName?.message}>
                  <Input icon={Building2} {...companyForm.register('orgName')} placeholder="ACME Transport Ltd" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" error={companyForm.formState.errors.firstName?.message}>
                    <Input icon={User} {...companyForm.register('firstName')} placeholder="Jean" />
                  </Field>
                  <Field label="Last name" error={companyForm.formState.errors.lastName?.message}>
                    <Input {...companyForm.register('lastName')} placeholder="Kagabo" />
                  </Field>
                </div>

                <Field label="Work email" error={companyForm.formState.errors.email?.message}>
                  <Input icon={Mail} type="email" {...companyForm.register('email')} placeholder="you@company.com" autoComplete="email" />
                </Field>

                <Field label="Country" error={companyForm.formState.errors.country?.message}>
                  <div className="relative">
                    <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                    <select {...companyForm.register('country')}
                      className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none">
                      {COUNTRIES.map(c => <option key={c} value={c} className="bg-brand-900">{c}</option>)}
                    </select>
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Password" error={companyForm.formState.errors.password?.message}>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                      <input {...companyForm.register('password')} type={showPwd ? 'text' : 'password'} placeholder="Min 8 chars"
                        className="w-full pl-9 pr-9 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-400 hover:text-white">
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm" error={companyForm.formState.errors.confirm?.message}>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                      <input {...companyForm.register('confirm')} type={showConf ? 'text' : 'password'} placeholder="Re-enter"
                        className="w-full pl-9 pr-9 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <button type="button" onClick={() => setShowConf(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-400 hover:text-white">
                        {showConf ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <span className="text-amber-400 text-xs">📋 Selected plan: <strong className="text-amber-300">{PLANS.find(p => p.id === selectedPlan)?.name}</strong> — activated by Super Admin after approval</span>
                </div>

                <button type="submit" disabled={companyForm.formState.isSubmitting}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25">
                  {companyForm.formState.isSubmitting
                    ? <><Loader2 size={15} className="animate-spin" /> Creating organization…</>
                    : <><ArrowRight size={15} /> Create organization</>}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── STEP: Personal details form ─────────────────────────────────── */}
          {step === 'details' && accountType === 'personal' && (
            <motion.div key="personal-details" variants={fadeUp} initial="hidden" animate="show" exit="hidden"
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-7 shadow-2xl">
              <button onClick={() => setStep('role')}
                className="flex items-center gap-1.5 text-brand-400 hover:text-white text-sm mb-5 transition">
                <ArrowLeft size={14} /> Back
              </button>
              <h2 className="text-xl font-bold text-white mb-0.5">
                {PERSONAL_ROLES.find(r => r.id === selectedRole)?.title ?? 'Personal'} account
              </h2>
              <p className="text-brand-300 text-sm mb-6">Your details — takes about 30 seconds</p>

              <form onSubmit={personalForm.handleSubmit(onSubmitPersonal)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" error={personalForm.formState.errors.firstName?.message}>
                    <Input icon={User} {...personalForm.register('firstName')} placeholder="Jean" />
                  </Field>
                  <Field label="Last name" error={personalForm.formState.errors.lastName?.message}>
                    <Input {...personalForm.register('lastName')} placeholder="Kagabo" />
                  </Field>
                </div>

                <Field label="Email address" error={personalForm.formState.errors.email?.message}>
                  <Input icon={Mail} type="email" {...personalForm.register('email')} placeholder="you@email.com" autoComplete="email" />
                </Field>

                <Field label="Phone number (optional)" error={personalForm.formState.errors.phone?.message}>
                  <Input {...personalForm.register('phone')} placeholder="+250 78X XXX XXX" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Password" error={personalForm.formState.errors.password?.message}>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                      <input {...personalForm.register('password')} type={showPwd ? 'text' : 'password'} placeholder="Min 8 chars"
                        className="w-full pl-9 pr-9 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-400 hover:text-white">
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm" error={personalForm.formState.errors.confirm?.message}>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                      <input {...personalForm.register('confirm')} type={showConf ? 'text' : 'password'} placeholder="Re-enter"
                        className="w-full pl-9 pr-9 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-brand-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <button type="button" onClick={() => setShowConf(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-400 hover:text-white">
                        {showConf ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>
                </div>

                <button type="submit" disabled={personalForm.formState.isSubmitting}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25">
                  {personalForm.formState.isSubmitting
                    ? <><Loader2 size={15} className="animate-spin" /> Creating account…</>
                    : <><ArrowRight size={15} /> Create account</>}
                </button>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {step === 'type' || step === 'plan' || step === 'role' ? (
        <p className="text-center text-sm text-brand-400 mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-300 hover:text-white font-medium transition">Sign in</Link>
        </p>
      ) : null}
    </div>
  );
}

// Wrap in Suspense — required by Next.js 14 for useSearchParams() during SSG
export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
