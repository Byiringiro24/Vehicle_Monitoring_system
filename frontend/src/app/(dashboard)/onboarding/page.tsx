'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import {
  Truck, User, Star, CheckCircle2, ArrowRight, Building2,
  MapPin, DollarSign, FileText, LogOut,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const ROLE_OPTIONS = [
  {
    id:     'owner',
    icon:   <Truck size={22} className="text-emerald-600" />,
    bg:     'bg-emerald-50',
    border: 'border-emerald-300',
    title:  'I own vehicles',
    desc:   'Register your vehicles and track income, expenses and management proposals.',
    action: 'Register a vehicle',
    href:   '/vehicles',
  },
  {
    id:     'driver',
    icon:   <User size={22} className="text-purple-600" />,
    bg:     'bg-purple-50',
    border: 'border-purple-300',
    title:  'I drive for a company',
    desc:   "View your assigned vehicle, trip history, earnings and documents.",
    action: 'Go to my vehicle',
    href:   '/dashboard',
  },
  {
    id:     'customer',
    icon:   <Star size={22} className="text-amber-600" />,
    bg:     'bg-amber-50',
    border: 'border-amber-300',
    title:  'I need transport / rental',
    desc:   'Browse available vehicles, get quotes and manage your agreements and payments.',
    action: 'Browse vehicles',
    href:   '/dashboard',
  },
  {
    id:     'join-company',
    icon:   <Building2 size={22} className="text-blue-600" />,
    bg:     'bg-blue-50',
    border: 'border-blue-300',
    title:  'Join a company',
    desc:   "I've been invited by a company to join their fleet, finance or operations team.",
    action: 'View my invitation',
    href:   '/dashboard',
  },
];

const CHECKLIST = [
  { icon: <MapPin size={16} className="text-brand-600" />, text: 'Complete your profile', done: false },
  { icon: <Truck size={16} className="text-brand-600" />, text: 'Add your first vehicle', done: false },
  { icon: <FileText size={16} className="text-brand-600" />, text: 'Upload vehicle documents', done: false },
  { icon: <DollarSign size={16} className="text-brand-600" />, text: 'Set up payment preferences', done: false },
];

export default function OnboardingPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  function handleContinue() {
    const option = ROLE_OPTIONS.find(r => r.id === selected);
    if (option) router.push(option.href);
  }

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Truck size={16} className="text-white" />
          </div>
          <span className="font-black text-gray-900 text-base tracking-tight">
            ARTIC<span className="text-brand-600">.</span>VMS
          </span>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition">
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="text-center mb-10">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-brand-100">
            <CheckCircle2 size={32} className="text-brand-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            Welcome, {user?.firstName}! 🎉
          </h1>
          <p className="text-gray-500 mt-2 text-sm max-w-sm mx-auto">
            Your account is ready. Tell us how you plan to use ARTIC VMS so we can get you set up.
          </p>
        </motion.div>

        <motion.div
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="space-y-3 mb-8"
        >
          {ROLE_OPTIONS.map(option => (
            <motion.button
              key={option.id}
              variants={fadeUp}
              onClick={() => setSelected(option.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                selected === option.id
                  ? `${option.border} bg-white shadow-md`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className={`w-11 h-11 ${option.bg} rounded-xl flex items-center justify-center shrink-0`}>
                {option.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">{option.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">{option.desc}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                selected === option.id ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
              }`}>
                {selected === option.id && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </motion.button>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition shadow-lg shadow-brand-600/25">
            Continue <ArrowRight size={16} />
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full mt-3 text-center text-sm text-gray-400 hover:text-gray-600 transition py-2">
            Skip for now — take me to the dashboard
          </button>
        </motion.div>

        {/* Quick checklist */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="mt-8 bg-white rounded-xl border border-gray-200 p-5"
        >
          <p className="text-sm font-semibold text-gray-700 mb-3">Getting started checklist</p>
          <ul className="space-y-2.5">
            {CHECKLIST.map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <span className="text-sm text-gray-600">{item.text}</span>
                <span className="ml-auto text-xs text-gray-300">Pending</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
