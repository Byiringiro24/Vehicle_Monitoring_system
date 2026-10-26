'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supportApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Clock, Truck, MapPin, DollarSign, Shield, Bell, Wrench,
  FileText, Users, BarChart3, CheckCircle2, Mail, Phone,
  MessageCircle, Instagram, Video, ExternalLink, LogOut,
  Send, ChevronDown, ChevronUp, Globe, Activity, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Contact icon map ─────────────────────────────────────────────────────────
const CONTACT_ICONS: Record<string, React.ReactNode> = {
  whatsapp:  <MessageCircle size={18} className="text-green-500" />,
  phone:     <Phone size={18} className="text-brand-600" />,
  mail:      <Mail size={18} className="text-red-500" />,
  email:     <Mail size={18} className="text-red-500" />,
  instagram: <Instagram size={18} className="text-pink-500" />,
  tiktok:    <Video size={18} className="text-gray-900" />,
  default:   <Globe size={18} className="text-brand-400" />,
};

// ─── Ticket form ──────────────────────────────────────────────────────────────
const ticketSchema = z.object({
  subject:  z.string().min(5, 'Subject must be at least 5 characters'),
  message:  z.string().min(20, 'Please describe your issue in more detail'),
  category: z.string().default('general'),
});
type TicketForm = z.infer<typeof ticketSchema>;

// ─── Feature preview ──────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <MapPin size={18} className="text-brand-600" />,   title: 'Live GPS Tracking',      desc: 'Real-time positions updated every 15 seconds.' },
  { icon: <Lock size={18} className="text-red-600" />,       title: 'Engine Lock/Unlock',      desc: 'Remote relay control with plate confirmation.' },
  { icon: <Users size={18} className="text-purple-600" />,   title: 'Driver Management',       desc: 'Profiles, license tracking, vehicle assignments.' },
  { icon: <Bell size={18} className="text-orange-600" />,    title: 'Smart Alerts',            desc: 'Speeding, geofence breaches, expiry reminders.' },
  { icon: <DollarSign size={18} className="text-teal-600" />, title: 'Financial Management',   desc: 'Agreements, payments, P&L reports.' },
  { icon: <Wrench size={18} className="text-amber-600" />,   title: 'Maintenance Schedules',   desc: 'Service records and cost tracking.' },
  { icon: <FileText size={18} className="text-pink-600" />,  title: 'Document Compliance',     desc: 'Expiry tracking with automatic email reminders.' },
  { icon: <BarChart3 size={18} className="text-indigo-600" />, title: 'Reports & Analytics',   desc: 'Fleet performance and financial statements.' },
];

// ─── Timeline steps ───────────────────────────────────────────────────────────
const TIMELINE = [
  { label: 'Registered',   desc: 'Your organization has been created',             status: 'done' },
  { label: 'Under Review', desc: 'Our team is reviewing your registration details', status: 'active' },
  { label: 'Approved',     desc: "You'll receive a welcome email to get started",   status: 'pending' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function PendingApprovalPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ['support-contacts'],
    queryFn:  supportApi.contacts,
  });

  const ticketMutation = useMutation({
    mutationFn: (d: TicketForm) => supportApi.submitTicket({
      ...d,
      userEmail: user?.email ?? '',
      userName:  `${user?.firstName} ${user?.lastName}`,
    }),
    onSuccess: () => { setTicketSent(true); setShowTicketForm(false); toast.success('Message sent!'); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? 'Failed to send. Try again.'),
  });

  const { register, handleSubmit, formState: { errors } } =
    useForm<TicketForm>({ resolver: zodResolver(ticketSchema), defaultValues: { category: 'general' } });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Truck size={16} className="text-white" />
          </div>
          <span className="font-black text-gray-900 text-sm tracking-tight">
            ARTIC<span className="text-brand-600">.</span>VMS
          </span>
        </div>
        <button onClick={() => { logout(); router.replace('/login'); }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition">
          <LogOut size={13} /> Sign out
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ── Status banner ───────────────────────────────────────────────── */}
        <motion.div initial="hidden" animate="show" variants={fadeUp}
          className="bg-white border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock size={24} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-amber-900">Pending Approval</h1>
                <p className="text-amber-700 text-sm mt-1 leading-relaxed">
                  Hi <strong>{user?.firstName}</strong> — <strong>"{user?.organization?.name}"</strong> has been registered
                  and is awaiting Super Admin review. You'll receive an email when approved.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-xs text-amber-600 font-medium">Usually approved within 24 hours</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Registration status</p>
            <div className="flex items-start gap-0">
              {TIMELINE.map((step, i) => (
                <div key={step.label} className="flex-1 flex flex-col items-center">
                  {/* Connector line + dot */}
                  <div className="flex items-center w-full">
                    {/* Left line */}
                    <div className={cn(
                      'flex-1 h-0.5',
                      i === 0 ? 'bg-transparent' : step.status === 'pending' ? 'bg-gray-200' : 'bg-brand-400'
                    )} />
                    {/* Dot */}
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all',
                      step.status === 'done'    ? 'bg-green-500 shadow-sm' :
                      step.status === 'active'  ? 'bg-amber-500 shadow-md shadow-amber-500/30 ring-4 ring-amber-100' :
                                                  'bg-gray-200'
                    )}>
                      {step.status === 'done'
                        ? <CheckCircle2 size={16} className="text-white" />
                        : step.status === 'active'
                        ? <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                        : <div className="w-3 h-3 bg-gray-300 rounded-full" />}
                    </div>
                    {/* Right line */}
                    <div className={cn(
                      'flex-1 h-0.5',
                      i === TIMELINE.length - 1 ? 'bg-transparent' :
                      TIMELINE[i + 1]?.status === 'pending' ? 'bg-gray-200' : 'bg-brand-400'
                    )} />
                  </div>
                  {/* Label */}
                  <div className="mt-2 text-center px-1">
                    <p className={cn(
                      'text-xs font-semibold',
                      step.status === 'done' ? 'text-green-600' :
                      step.status === 'active' ? 'text-amber-600' : 'text-gray-400'
                    )}>{step.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 hidden sm:block">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Feature preview ──────────────────────────────────────────────── */}
        <motion.div initial="hidden" animate="show" variants={{ ...fadeUp, show: { ...fadeUp.show, transition: { delay: 0.1, duration: 0.4 } } }}>
          <h2 className="text-base font-bold text-gray-800 mb-3">
            Here's what you'll unlock once approved:
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center mb-2">
                  {f.icon}
                </div>
                <p className="text-xs font-semibold text-gray-900">{f.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Support contacts ─────────────────────────────────────────────── */}
        <motion.div
          initial="hidden" animate="show"
          variants={{ ...fadeUp, show: { ...fadeUp.show, transition: { delay: 0.2, duration: 0.4 } } }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Have questions? Contact us directly</h2>
            <p className="text-xs text-gray-400 mt-0.5">Available to help with your registration.</p>
          </div>
          <div className="p-5">
            {(contacts as any[]).length === 0 ? (
              <p className="text-sm text-gray-400">Loading contacts…</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(contacts as any[]).map((c: any) => (
                  <a key={c.id} href={c.url ?? '#'} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50/50 transition group">
                    <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                      {CONTACT_ICONS[c.icon?.toLowerCase()] ?? CONTACT_ICONS.default}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.platform}</p>
                      <p className="text-xs text-gray-400 truncate">{c.value}</p>
                    </div>
                    <ExternalLink size={13} className="text-gray-300 group-hover:text-brand-500 transition" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Support ticket ───────────────────────────────────────────────── */}
        <motion.div
          initial="hidden" animate="show"
          variants={{ ...fadeUp, show: { ...fadeUp.show, transition: { delay: 0.3, duration: 0.4 } } }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <button onClick={() => setShowTicketForm(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <Send size={17} className="text-brand-600" />
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">Send us a message</p>
                <p className="text-xs text-gray-400">Questions, issues or anything else — we'll reply fast.</p>
              </div>
            </div>
            {showTicketForm ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
          </button>

          {ticketSent && (
            <div className="px-5 py-3.5 bg-green-50 border-t border-green-100 flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <p className="text-sm text-green-800">Message sent! We'll reply to <strong>{user?.email}</strong>.</p>
            </div>
          )}

          {showTicketForm && !ticketSent && (
            <form onSubmit={handleSubmit(d => ticketMutation.mutate(d))} className="border-t border-gray-100 p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select {...register('category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  <option value="general">General enquiry</option>
                  <option value="billing">Billing / plan question</option>
                  <option value="technical">Technical issue</option>
                  <option value="approval">About my approval</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input {...register('subject')} placeholder="e.g. Question about my registration"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea {...register('message')} rows={4}
                  placeholder="Tell us more about your question or issue…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
                {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowTicketForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={ticketMutation.isPending}
                  className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                  <Send size={13} />
                  {ticketMutation.isPending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
