'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { membershipApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Building2, ChevronDown, Check, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Membership {
  id: string;
  role: string;
  status: string;
  organization: { id: string; name: string; slug: string; logoUrl?: string };
}

export function WorkspaceSwitcher() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);

  const { data: memberships = [] } = useQuery<Membership[]>({
    queryKey: ['my-memberships'],
    queryFn:  membershipApi.me,
    enabled:  !!user,
  });

  const active = memberships.find(m => m.organization.id === user?.organization?.id);
  const others = memberships.filter(m => m.organization.id !== user?.organization?.id && m.status === 'ACTIVE');

  if (memberships.length <= 1) {
    // Only one org — show simple org name, no switcher
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-6 h-6 bg-brand-500 rounded-md flex items-center justify-center shrink-0">
          <Building2 size={12} className="text-white" />
        </div>
        <span className="text-xs font-medium text-blue-200 truncate max-w-[130px]">
          {user?.organization?.name ?? 'My Organization'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition"
      >
        <div className="w-6 h-6 bg-brand-500 rounded-md flex items-center justify-center shrink-0">
          <Building2 size={12} className="text-white" />
        </div>
        <span className="text-xs font-medium text-blue-200 truncate flex-1 text-left max-w-[110px]">
          {active?.organization.name ?? user?.organization?.name ?? 'My Organization'}
        </span>
        <ChevronDown size={13} className={cn('text-blue-300 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute left-0 bottom-full mb-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Switch Workspace</p>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>

            <div className="py-1 max-h-60 overflow-y-auto">
              {/* Current workspace */}
              {active && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-50">
                  <OrgAvatar name={active.organization.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{active.organization.name}</p>
                    <p className="text-xs text-gray-400">{active.role.replace(/_/g, ' ')}</p>
                  </div>
                  <Check size={14} className="text-blue-600 shrink-0" />
                </div>
              )}

              {others.length > 0 && (
                <>
                  <div className="px-3 py-1.5 border-t border-gray-100">
                    <p className="text-xs text-gray-400">Other workspaces</p>
                  </div>
                  {others.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        // Full page reload to switch context — the server re-validates JWT
                        // TODO: proper context switching via API call + token update
                        setOpen(false);
                        window.location.href = `/dashboard?org=${m.organization.id}`;
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition text-left"
                    >
                      <OrgAvatar name={m.organization.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.organization.name}</p>
                        <p className="text-xs text-gray-400">{m.role.replace(/_/g, ' ')}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Pending invitations */}
              {memberships.filter(m => m.status === 'INVITED').map(m => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 bg-amber-50 border-t border-amber-100">
                  <OrgAvatar name={m.organization.name} color="bg-amber-100" textColor="text-amber-800" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.organization.name}</p>
                    <p className="text-xs text-amber-600 font-medium">Pending invitation</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OrgAvatar({ name, color = 'bg-brand-100', textColor = 'text-brand-700' }: { name: string; color?: string; textColor?: string }) {
  return (
    <div className={cn('w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0', color, textColor)}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
