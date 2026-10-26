'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { getNavItems, type AppRole } from '@/lib/roles';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import {
  LayoutDashboard, Truck, Bell, Map, Users, Settings,
  BarChart3, MapPin, UserCheck, User, X,
  DollarSign, Activity, ChevronRight, Wrench, Globe, FileText, Handshake,
  Headphones, Lock, Ban,
} from 'lucide-react';

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, Truck, Bell, Map, Users, Settings,
  BarChart3, MapPin, UserCheck, User,
  DollarSign, Activity, Wrench, Globe, FileText, Handshake,
  Headphones,
  // aliases that may appear in roles.ts
  HeadphonesIcon: Headphones,
};

// ── Items that require a specific plan (lock icon) ─────────────────────────
// Key = href, value = plan name displayed in tooltip
const PLAN_LOCKED: Record<string, string> = {
  // Nothing currently locked — all features enabled by default.
  // Add entries here as feature-gating is implemented:
  // '/dispatch': 'Business',
  // '/workshop': 'Enterprise',
};

// ── Items that require a specific role but org has the feature (ban icon) ──
// These are computed dynamically from the user's role, but we define
// which hrefs are "sensitive" so we can show ⛔ for lower roles.
const ROLE_SENSITIVE: Record<string, AppRole[]> = {
  '/platform': ['SUPER_ADMIN'],
  '/users':    ['SUPER_ADMIN', 'ADMIN'],
  '/finance':  ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
};

interface SidebarProps { onClose?: () => void; }

export function Sidebar({ onClose }: SidebarProps) {
  const pathname  = usePathname();
  const { user }  = useAuthStore();
  const role      = (user?.role ?? 'VIEWER') as AppRole;

  // getNavItems returns only items the role can see — but we ALSO want to
  // show locked/blocked items so users know they exist and can request access.
  // Strategy: get ALL nav items and classify each one.
  const allItems = getNavItems('SUPER_ADMIN' as AppRole); // full list
  const allowed  = new Set(getNavItems(role).map(i => i.href));

  return (
    <aside className="w-64 bg-brand-900 text-white flex flex-col shrink-0 shadow-2xl h-full">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-brand-700/50">
        <div className="bg-brand-600 p-2 rounded-lg shadow-inner shrink-0">
          <Truck size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight tracking-wide">ARTIC VMS</p>
          <p className="text-xs text-brand-300 leading-tight">Vehicle Monitoring</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 text-brand-300 hover:text-white" aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-3">
        {allItems.map(({ href, label, icon }) => {
          const Icon    = ICONS[icon] ?? FileText;
          const active  = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          const isAllowed   = allowed.has(href);
          const isPlanLocked = !!PLAN_LOCKED[href];
          // Role-blocked: org has it, but this user's role doesn't include it
          const isRoleBlocked = !isAllowed && !isPlanLocked &&
            ROLE_SENSITIVE[href] !== undefined &&
            !(ROLE_SENSITIVE[href] as string[]).includes(role);

          if (!isAllowed && !isPlanLocked && !isRoleBlocked) {
            // Truly hidden (not relevant to this role context at all)
            return null;
          }

          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={
                isPlanLocked ? `${PLAN_LOCKED[href]} plan required — contact Super Admin` :
                isRoleBlocked ? `Your role cannot access this — request from Company Admin` :
                label
              }
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                active && isAllowed
                  ? 'bg-brand-600 text-white shadow-md'
                  : isAllowed
                  ? 'text-brand-200 hover:bg-white/10 hover:text-white'
                  : 'text-brand-400/60 cursor-pointer hover:bg-white/5',
              )}
            >
              <Icon
                size={17}
                className={cn(
                  'shrink-0',
                  active && isAllowed ? 'text-white' :
                  isAllowed           ? 'text-brand-300 group-hover:text-white' :
                                        'text-brand-500/70',
                )}
              />
              <span className="flex-1">{label}</span>
              {/* Lock icon — plan not enabled */}
              {isPlanLocked && (
                <Lock size={12} className="text-brand-500/80 shrink-0" aria-label="Plan required" />
              )}
              {/* Ban icon — role doesn't permit */}
              {isRoleBlocked && (
                <Ban size={12} className="text-brand-500/80 shrink-0" aria-label="Role required" />
              )}
              {/* Chevron — active & allowed */}
              {active && isAllowed && (
                <ChevronRight size={13} className="opacity-50 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Workspace switcher */}
      <div className="px-1 border-t border-brand-700/50 pt-2">
        <WorkspaceSwitcher />
      </div>

      {/* User card */}
      <div className="p-3 border-t border-brand-700/50">
        <Link
          href="/profile"
          onClick={onClose}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-brand-300 truncate">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
          <User size={14} className="text-brand-300 shrink-0" />
        </Link>
      </div>
    </aside>
  );
}
