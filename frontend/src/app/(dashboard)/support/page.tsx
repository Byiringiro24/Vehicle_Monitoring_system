'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supportApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  HeadphonesIcon, Mail, Phone, MessageCircle, Instagram,
  Video, ExternalLink, Send, CheckCircle2, Globe, Clock,
  AlertCircle, RefreshCw, FileText,
} from 'lucide-react';

const CONTACT_ICONS: Record<string, React.ReactNode> = {
  whatsapp:  <MessageCircle size={20} className="text-green-500" />,
  phone:     <Phone size={20} className="text-blue-600" />,
  mail:      <Mail size={20} className="text-red-500" />,
  email:     <Mail size={20} className="text-red-500" />,
  instagram: <Instagram size={20} className="text-pink-500" />,
  tiktok:    <Video size={20} className="text-gray-900" />,
  default:   <Globe size={20} className="text-brand-400" />,
};

const STATUS_COLORS: Record<string, string> = {
  OPEN:        'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  RESOLVED:    'bg-green-100 text-green-800',
  CLOSED:      'bg-gray-100 text-gray-600',
};

const ticketSchema = z.object({
  subject:  z.string().min(5, 'At least 5 characters'),
  message:  z.string().min(20, 'Please give more detail'),
  category: z.string().default('general'),
});
type TicketForm = z.infer<typeof ticketSchema>;

export default function SupportPage() {
  const { user } = useAuthStore();
  const [sent, setSent] = useState(false);

  const { data: contacts = [] } = useQuery({ queryKey: ['support-contacts'], queryFn: supportApi.contacts });
  const { data: myTickets = [], refetch } = useQuery({ queryKey: ['my-tickets'], queryFn: supportApi.myTickets });

  const ticketMutation = useMutation({
    mutationFn: (d: TicketForm) => supportApi.submitTicket({
      ...d,
      userEmail: user?.email ?? '',
      userName:  `${user?.firstName} ${user?.lastName}`,
    }),
    onSuccess: () => { setSent(true); refetch(); toast.success('Message sent!'); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<TicketForm>({ resolver: zodResolver(ticketSchema), defaultValues: { category: 'general' } });

  function onSubmit(d: TicketForm) {
    ticketMutation.mutate(d);
    reset();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HeadphonesIcon size={24} className="text-brand-600" /> Support
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Contact us directly or submit a support ticket. We respond as quickly as possible.
        </p>
      </div>

      {/* Contact cards */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Contact us directly</h2>
          <p className="text-xs text-gray-500 mt-0.5">Available via multiple channels — choose what works best for you</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contacts.length === 0
            ? <p className="text-sm text-gray-400 col-span-3">Loading…</p>
            : contacts.map((c: any) => (
                <a key={c.id} href={c.url ?? '#'} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition group shadow-sm">
                  <div className="w-11 h-11 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-white border border-gray-100 transition">
                    {CONTACT_ICONS[c.icon?.toLowerCase()] ?? CONTACT_ICONS.default}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{c.platform}</p>
                    <p className="text-xs text-gray-500 truncate">{c.value}</p>
                    {c.label && <p className="text-xs text-brand-600 mt-0.5">{c.label}</p>}
                  </div>
                  <ExternalLink size={13} className="text-gray-300 group-hover:text-brand-500 shrink-0 transition" />
                </a>
              ))
          }
        </div>
      </div>

      {/* Submit ticket */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Send size={15} className="text-brand-600" /> Submit a support ticket
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            We'll respond to your email ({user?.email}) as soon as possible.
          </p>

          {sent ? (
            <div className="text-center py-6">
              <CheckCircle2 size={36} className="text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-900">Message sent!</p>
              <p className="text-sm text-gray-500 mt-1">We'll reply to {user?.email}</p>
              <button onClick={() => setSent(false)} className="mt-4 text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 mx-auto">
                <RefreshCw size={12} /> Send another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select {...register('category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  <option value="general">General enquiry</option>
                  <option value="technical">Technical issue</option>
                  <option value="billing">Billing question</option>
                  <option value="feature">Feature request</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input {...register('subject')} placeholder="Brief description of your issue"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea {...register('message')} rows={5} placeholder="Describe your issue in detail…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
                {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
              </div>
              <button type="submit" disabled={isSubmitting || ticketMutation.isPending}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-60">
                <Send size={14} />
                {ticketMutation.isPending ? 'Sending…' : 'Send ticket'}
              </button>
            </form>
          )}
        </div>

        {/* My tickets history */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText size={15} className="text-brand-600" />
            <h2 className="font-semibold text-gray-900">My tickets</h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full ml-auto font-medium">
              {(myTickets as any[]).length}
            </span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
            {(myTickets as any[]).length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <FileText size={28} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No tickets yet</p>
              </div>
            ) : (myTickets as any[]).map(t => (
              <div key={t.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.createdAt)}</p>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_COLORS[t.status] ?? 'bg-gray-100')}>
                    {t.status.replace('_',' ')}
                  </span>
                </div>
                {t.adminNotes && (
                  <div className="mt-2 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 text-xs text-brand-800">
                    <span className="font-semibold">Reply: </span>{t.adminNotes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
