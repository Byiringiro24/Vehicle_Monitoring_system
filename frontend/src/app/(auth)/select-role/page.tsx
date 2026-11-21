'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { ROLE_HOME } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  Truck, Globe, Building2, Navigation, DollarSign,
  Users, Hammer, ShieldCheck, CalendarDays, Tag,
  Eye, UserCheck, BarChart3, Headphones,
} from 'lucide-react';

const ROLE_ICONS: Record<string, React.ReactNode> = {
  SUPER_ADMIN:        <Globe size={22} className="text-red-500" />,
  PLATFORM_SUPPORT:   <Headphones size={22} className="text-pink-500" />,
  ADMIN:              <Building2 size={22} className="text-orange-500" />,
  FLEET_MANAGER:      <Truck size={22} className="text-blue-500" />,
  FINANCE_MANAGER:    <DollarSign size={22} className="text-purple-500" />,
  HR_MANAGER:         <Users size={22} className="text-indigo-500" />,
  MECHANIC:           <Hammer size={22} className="text-yellow-500" />,
  COMPLIANCE_OFFICER: <ShieldCheck size={22} className="text-teal-500" />,
  RENTAL_MANAGER:     <CalendarDays size={22} className="text-cyan-500" />,
  SALES_AGENT:        <Tag size={22} className="text-pink-500" />,
  AUDITOR:            <BarChart3 size={22} className="text-slate-500" />,
  DRIVER:             <UserCheck size={22} className="text-green-500" />,
  VIEWER:             <Eye size={22} className="text-gray-500" />,
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN:        'Full platform control — companies, plans, features',
  PLATFORM_SUPPORT:   'Support tickets and pending approvals',
  ADMIN:              'Company management — users, settings, full access',
  FLEET_MANAGER:      'Vehicles, drivers, dispatch, geofences',
  FINANCE_MANAGER:    'Finance dashboard, invoices, payouts, reports',
  HR_MANAGER:         'Staff attendance and HR management',
  MECHANIC:           'Workshop jobs and maintenance',
  COMPLIANCE_OFFICER: 'Document verification and compliance',
  RENTAL_MANAGER:     'Rental calendar and vehicle handovers',
  SALES_AGENT:        'Vehicle sales and listings',
  AUDITOR:            'Read-only audit log access',
  DRIVER:             'Vehicle operations and rider hub',
  VIEWER:             'Personal account portal',
};

export default function SelectRolePage() {
  const router   = useRouter();
  const { user, activeRole, switchRole, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) router.replace('/login');
  }, [isAuthenticated, user, router]);

  if (!user) return null;

  const allRoles = Array.from(new Set([user.role, ...(user.roles ?? [])])).filter(Boolean);

  // If only one role, skip this screen
  useEffect(() => {
    if (allRoles.length <= 1) {
      router.replace((ROLE_HOME as Record<string, string>)[user.role] ?? '/dashboard');
    }
  }, [allRoles.length]);

  function pick(role: string) {
    switchRole(role);
    router.replace(ROLE_HOME[role as keyof typeof ROLE_HOME] ?? '/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl mb-5 shadow-xl shadow-blue-600/30">
          <Truck size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-wide mb-1">
          ARTIC<span className="text-cyan-400">.</span>VMS
        </h1>
        <p className="text-blue-200 text-sm">
          Welcome, <span className="font-semibold text-white">{user.firstName} {user.lastName}</span>
        </p>
        <p className="text-slate-400 text-sm mt-2">
          You have <span className="text-white font-semibold">{allRoles.length} roles</span>. Choose how you want to work today.
        </p>
      </div>

      {/* Role cards */}
      <div className={cn(
        'grid gap-4 w-full max-w-3xl',
        allRoles.length <= 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-xl' :
        allRoles.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' :
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      )}>
        {allRoles.map(role => (
          <button
            key={role}
            onClick={() => pick(role)}
            className={cn(
              'group text-left p-5 rounded-2xl border transition-all duration-150',
              'hover:scale-[1.02] hover:shadow-xl active:scale-[0.99]',
              activeRole === role
                ? 'border-cyan-400/60 bg-cyan-400/10 shadow-lg shadow-cyan-500/20'
                : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/15 transition">
                {ROLE_ICONS[role] ?? <Truck size={20} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{role.replace(/_/g, ' ')}</p>
                {activeRole === role && (
                  <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">Current</span>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {ROLE_DESCRIPTIONS[role] ?? 'Access your workspace'}
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-300 opacity-0 group-hover:opacity-100 transition">
              Enter as {role.replace(/_/g, ' ')} →
            </div>
          </button>
        ))}
      </div>

      <p className="text-slate-500 text-xs mt-8">
        You can switch roles anytime from the top bar while working.
      </p>
    </div>
  );
}
