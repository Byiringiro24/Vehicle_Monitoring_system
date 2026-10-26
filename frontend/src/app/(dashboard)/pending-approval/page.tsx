'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supportApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Clock, Truck, MapPin, DollarSign, Shield, Bell, Wrench,
  FileText, Users, BarChart3, CheckCircle2, Mail, Phone,
  MessageCircle, Instagram, Video, ExternalLink, LogOut,
  Send, ChevronDown, ChevronUp, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Support contact icon map ─────────────────────────────────────────────────
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
  subject:   z.string().min(5, 'Subject must be at least 5 characters'),
  message:   z.string().min(20, 'Please describe your issue in more detail'),
  category:  z.string().default('general'),
});
type TicketForm = z.infer<typeof ticketSchema>;

// ─── Feature preview cards ────────────────────────────────────────────────────
const FEATURES = [
  { icon: <MapPin size={20} className="text-brand-600" />, title: 'Live GPS Tracking', desc: 'Real-time vehicle positions on an interactive map, updated every 15 seconds.' },
  { icon: <Truck size={20} className="text-brand-600" />, title: 'Fleet Management', desc: 'Full vehicle profiles, engine lock/unlock, GPS history and trip replay.' },
  { icon: <Users size={20} className="text-brand-600" />, title: 'Driver Management', desc: 'Driver profiles, license tracking, vehicle assignments and performance.' },
  { icon: <Bell size={20} className="text-brand-600" />, title: 'Smart Alerts', desc: 'Speeding, geofence breaches, offline devices, insurance expiry and more.' },
  { icon: <DollarSign size={20} className="text-brand-600" />, title: 'Financial Management', desc: 'Agreements, payments, rental income, expenses and full P&L reports.' },
  { icon: <Wrench size={20} className="text-brand-600" />, title: 'Maintenance', desc: 'Service records, upcoming maintenance schedule, cost tracking.' },
  { icon: <FileText size={20} className="text-brand-600" />, title: 'Document Management', desc: 'Upload and verify vehicle documents, licenses, insurance with expiry alerts.' },
  { icon: <BarChart3 size={20} className="text-brand-600" />, title: 'Reports & Analytics', desc: 'Vehicle profitability, driver payroll, fleet activity and financial statements.' },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PendingApprovalPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);

  // Fetch support contacts (public endpoint)
  const { data: contacts = [] } = useQuery({
    queryKey: ['support-contacts'],
    queryFn:  supportApi.contacts,
  });

  // Submit support ticket
  const ticketMutation = useMutation({
    mutationFn: (d: TicketForm) => supportApi.submitTicket({
      ...d,
      userEmail: user?.email ?? '',
      userName:  `${user?.firstName} ${user?.lastName}`,
    }),
    onSuccess: () => { setTicketSent(true); setShowTicketForm(false); toast.success('Your message has been sent!'); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? 'Failed to send. Try again.'),
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<TicketForm>({ resolver: zodResolver(ticketSchema), defaultValues: { category: 'general' } });

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <Truck size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">ARTIC VMS</p>
            <p className="text-xs text-gray-400">Vehicle Monitoring System</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition">
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Status banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={24} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-amber-900">
              Your registration is pending approval
            </h1>
            <p className="text-amber-700 text-sm mt-1 leading-relaxed">
              Hi <strong>{user?.firstName}</strong> — your organization{' '}
              <strong>"{user?.organization?.name}"</strong> has been registered and is
              awaiting review by our team. We'll activate your account as soon as possible.
              You'll receive an email confirmation when approved.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-xs text-amber-600 font-medium">
                Registration submitted · Under review
              </span>
            </div>
          </div>
        </div>

        {/* What you'll get */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Here's what you'll have access to once approved:
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center mb-3">
                  {f.icon}
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">{f.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Support contacts */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Need help? Contact us directly</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              We're available to answer any questions about your registration.
            </p>
          </div>
          <div className="p-6">
            {contacts.length === 0 ? (
              <p className="text-sm text-gray-400">Loading contact information…</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contacts.map((c: any) => (
                  <a key={c.id}
                    href={c.url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition group">
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-white transition">
                      {CONTACT_ICONS[c.icon?.toLowerCase()] ?? CONTACT_ICONS.default}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.platform}</p>
                      <p className="text-xs text-gray-500 truncate">{c.value}</p>
                      {c.label && <p className="text-xs text-brand-600">{c.label}</p>}
                    </div>
                    <ExternalLink size={13} className="text-gray-300 group-hover:text-brand-500 shrink-0 transition" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit a ticket / issue */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowTicketForm(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <Send size={18} className="text-brand-600" />
              <div className="text-left">
                <p className="text-base font-bold text-gray-900">Leave us a message</p>
                <p className="text-xs text-gray-500">Having trouble? Tell us and we'll sort it out.</p>
              </div>
            </div>
            {showTicketForm ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {ticketSent && (
            <div className="px-6 py-4 bg-green-50 border-t border-green-100 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-green-600 shrink-0" />
              <p className="text-sm text-green-800 font-medium">
                Message sent! We'll get back to you at <strong>{user?.email}</strong>.
              </p>
            </div>
          )}

          {showTicketForm && !ticketSent && (
            <form onSubmit={handleSubmit(d => ticketMutation.mutate(d))} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select {...register('category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  <option value="general">General enquiry</option>
                  <option value="billing">Billing / plan question</option>
                  <option value="technical">Technical issue</option>
                  <option value="feature">Feature request</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input {...register('subject')} placeholder="e.g. Question about pricing"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea {...register('message')} rows={4}
                  placeholder="Describe your question or issue in detail…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
                {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowTicketForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || ticketMutation.isPending}
                  className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                  <Send size={14} />
                  {ticketMutation.isPending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
