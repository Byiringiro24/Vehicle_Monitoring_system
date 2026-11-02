'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { membershipApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Truck, CheckCircle2, Building2, Loader2, ArrowRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

function AcceptForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const invitationId = searchParams.get('id');
  const [accepted, setAccepted] = useState(false);

  // Fetch invitation details
  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ['my-memberships'],
    queryFn:  membershipApi.me,
    enabled:  isAuthenticated,
  });

  const invitation = (memberships as any[]).find(
    (m: any) => m.id === invitationId || m.status === 'INVITED'
  );

  const acceptMutation = useMutation({
    mutationFn: (id: string) => membershipApi.accept(id),
    onSuccess: () => {
      setAccepted(true);
      toast.success('Invitation accepted! Welcome to your new workspace.');
      setTimeout(() => router.push('/dashboard'), 2000);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to accept invitation'),
  });

  if (!isAuthenticated) {
    return (
      <div className="text-center py-4">
        <ShieldAlert size={32} className="text-amber-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white mb-2">Sign in first</h2>
        <p className="text-brand-300 text-sm mb-4">
          You need to be signed in to accept an invitation.
        </p>
        <Link href={`/login?redirect=/invitations/accept${invitationId ? `?id=${invitationId}` : ''}`}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">
          Sign in <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500/20 rounded-full mb-4">
          <CheckCircle2 size={30} className="text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Invitation accepted!</h2>
        <p className="text-brand-300 text-sm">Redirecting to your dashboard…</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-bold text-white mb-1">Accept invitation</h2>
      <p className="text-brand-300 text-sm mb-6">
        You have a pending invitation to join an organization.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="text-brand-400 animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {/* Pending invitations */}
          {(memberships as any[]).filter((m: any) => m.status === 'INVITED').map((m: any) => (
            <div key={m.id} className="bg-white/10 border border-white/20 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 bg-brand-600 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm">
                  {m.organization?.name?.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-white">{m.organization?.name ?? 'Unknown organization'}</p>
                  <p className="text-sm text-brand-300 mt-0.5">
                    Role: <strong className="text-white">{m.role?.replace(/_/g,' ')}</strong>
                  </p>
                  <p className="text-xs text-brand-400 mt-0.5">
                    Invited as: {user?.email}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => acceptMutation.mutate(m.id)}
                  disabled={acceptMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-60">
                  {acceptMutation.isPending
                    ? <><Loader2 size={14} className="animate-spin" /> Accepting…</>
                    : <><CheckCircle2 size={14} /> Accept invitation</>}
                </button>
                <Link href="/dashboard"
                  className="px-4 py-2.5 border border-white/20 text-white text-sm rounded-xl hover:bg-white/10 transition">
                  Decline
                </Link>
              </div>
            </div>
          ))}

          {(memberships as any[]).filter((m: any) => m.status === 'INVITED').length === 0 && (
            <div className="text-center py-6">
              <Building2 size={28} className="text-brand-400 mx-auto mb-2" />
              <p className="text-brand-300 text-sm">No pending invitations found.</p>
              <p className="text-brand-400 text-xs mt-1">
                The invitation may have already been accepted or expired.
              </p>
              <Link href="/dashboard"
                className="inline-flex items-center gap-1.5 mt-4 text-sm text-brand-300 hover:text-white transition">
                Go to dashboard <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function InvitationAcceptPage() {
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
      <div className="w-full max-w-md bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-7 shadow-2xl">
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 size={24} className="text-brand-400 animate-spin" /></div>}>
          <AcceptForm />
        </Suspense>
      </div>
      <p className="text-center text-sm text-brand-400 mt-5">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-300 hover:text-white font-medium transition">Sign in</Link>
      </p>
    </div>
  );
}
