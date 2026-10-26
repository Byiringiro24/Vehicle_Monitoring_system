'use client';
import { useQuery } from '@tanstack/react-query';
import { supportApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { XCircle, Truck, Mail, Phone, MessageCircle, Instagram, Video, ExternalLink, LogOut, Globe, RefreshCw } from 'lucide-react';

const CONTACT_ICONS: Record<string, React.ReactNode> = {
  whatsapp:  <MessageCircle size={18} className="text-green-500" />,
  phone:     <Phone size={18} className="text-brand-600" />,
  mail:      <Mail size={18} className="text-red-500" />,
  email:     <Mail size={18} className="text-red-500" />,
  instagram: <Instagram size={18} className="text-pink-500" />,
  tiktok:    <Video size={18} className="text-gray-900" />,
  default:   <Globe size={18} className="text-brand-400" />,
};

export default function RejectedPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const { data: contacts = [] } = useQuery({ queryKey: ['support-contacts'], queryFn: supportApi.contacts });

  // Get rejection reason from org data via /auth/me
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => import('@/lib/api').then(m => m.authApi.me()) });
  const reason = me?.organization?.rejectionReason;

  return (
    <div className="min-h-screen bg-gray-50">
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
        <button onClick={() => { logout(); router.replace('/login'); }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition">
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <XCircle size={24} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-900">Registration not approved</h1>
            <p className="text-red-700 text-sm mt-1 leading-relaxed">
              Hi <strong>{user?.firstName}</strong> — unfortunately your registration for{' '}
              <strong>"{user?.organization?.name}"</strong> was not approved at this time.
            </p>
            {reason && (
              <div className="mt-3 bg-white border border-red-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Reason given:</p>
                <p className="text-sm text-gray-700">{reason}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw size={16} className="text-brand-600" /> What can you do?
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2"><span className="text-brand-600 font-bold mt-0.5">1.</span> Review the rejection reason above and contact us to resolve any issues.</li>
            <li className="flex items-start gap-2"><span className="text-brand-600 font-bold mt-0.5">2.</span> Reach out directly via WhatsApp or email — we're happy to discuss and reconsider.</li>
            <li className="flex items-start gap-2"><span className="text-brand-600 font-bold mt-0.5">3.</span> Once resolved, register again with a new account at <a href="/register" className="text-brand-600 underline">articvms.ddnsgeek.com/register</a>.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Contact us to resolve this</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contacts.map((c: any) => (
              <a key={c.id} href={c.url ?? '#'} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition group">
                <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                  {CONTACT_ICONS[c.icon?.toLowerCase()] ?? CONTACT_ICONS.default}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{c.platform}</p>
                  <p className="text-xs text-gray-500 truncate">{c.value}</p>
                </div>
                <ExternalLink size={12} className="text-gray-300 group-hover:text-brand-500 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
