'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { getNavItems, type AppRole } from '@/lib/roles';
import { getRouteFeature, FEATURE_CATALOG, isFeatureAvailable } from '@/lib/featureCatalog';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import {
  LayoutDashboard, Truck, Bell, Map, Users, Settings,
  BarChart3, MapPin, UserCheck, User, X,
  DollarSign, Activity, ChevronRight, Wrench, Globe, FileText, Handshake,
  Headphones, Lock as LockIcon, Ban, Navigation, Hammer, ShieldCheck,
  CalendarDays, Users2, UsersRound, CheckSquare, Car, FolderOpen,
  Bike, ShoppingBag, Tag,
} from 'lucide-react';

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, Truck, Bell, Map, Users, Settings,
  BarChart3, MapPin, UserCheck, User,
  DollarSign, Activity, Wrench, Globe, FileText, Handshake,
  Headphones, Navigation, Hammer, ShieldCheck,
  CalendarDays, Users2, UsersRound, CheckSquare, Car, FolderOpen,
  Bike, ShoppingBag, Tag,
  HeadphonesIcon: Headphones,
};

// ── Items that require a specific plan (lock icon) ─────────────────────────
// Now driven by featureCatalog.ts — routes with a premium feature code
// show 🔒 if the org's plan doesn't include that feature.
// Core features (vehicles, GPS, alerts, finance, maintenance, etc.) are
// NEVER locked — they're available on every plan.
// Premium features (dispatch, workshop, compliance, HR, rentals) show the lock.

// ── Items that require a specific role but org has the feature (ban icon) ──
const ROLE_SENSITIVE: Record<string, AppRole[]> = {
  '/platform': ['SUPER_ADMIN'],
  '/users':    ['SUPER_ADMIN', 'ADMIN'],
  '/finance':  ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
};

interface SidebarProps { onClose?: () => void; }

export function Sidebar({ onClose }: SidebarProps) {
  const pathname  = usePathname();
  const { user }  = useAuthStore();
  const roles = [user?.role ?? 'VIEWER', ...(user?.roles ?? [])].filter(Boolean) as AppRole[];

  const allItems = getNavItems('SUPER_ADMIN' as AppRole);
  const allowed  = new Set(getNavItems(roles).map(i => i.href));

  return (
    <aside className="w-64 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.28),_transparent_24%),linear-gradient(180deg,_#0b1220_0%,_#101b35_100%)] text-white flex flex-col shrink-0 shadow-[0_20px_60px_rgba(15,23,42,0.35)] h-full">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10 bg-white/3">
        <div className="bg-gradient-to-br from-brand-500 to-cyan-400 p-2.5 rounded-xl shadow-[0_8px_18px_rgba(37,99,235,0.4)] shrink-0">
          <Truck size={19} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm leading-tight tracking-[0.12em] uppercase">ARTIC VMS</p>
          <p className="text-[11px] text-sky-200/80 leading-tight">Vehicle Monitoring</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 text-sky-200/80 hover:text-white" aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
        {allItems.map(({ href, label, icon }) => {
          const Icon    = ICONS[icon] ?? FileText;
          const active  = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          const isAllowed   = allowed.has(href);

          // ── Check if this route is a premium feature ────────────────────────
          // Core features (GPS, vehicles, drivers, alerts, finance, maintenance)
          // are NEVER locked — they work on every plan.
          // Premium features (dispatch, workshop, compliance, HR, rentals) show 🔒
          // For now, all features are ENABLED (no plan check backend yet).
          // The 🔒 icon shows on premium features so users know they CAN be locked,
          // but we fail-open (allow access) until the backend entitlement system is built.
          const featureCode = getRouteFeature(href);
          const isPremiumFeature = !!featureCode;
          // TODO: when backend entitlement system is live, check isFeatureAvailable(featureCode, orgPlan)
          // For now: premium features are available to ALL active companies
          const isPlanLocked = false; // ← change to !isFeatureAvailable(...) when backend is ready

          // Role-blocked: org has it, but this user's role doesn't include it
          const isRoleBlocked = !isAllowed && !isPlanLocked &&
            ROLE_SENSITIVE[href] !== undefined &&
            !(ROLE_SENSITIVE[href] as string[]).some(role => roles.includes(role as AppRole));

          if (!isAllowed && !isPremiumFeature && !isRoleBlocked) {
            // Truly hidden (not relevant to this role context at all)
            return null;
          }

          // Feature info for upsell tooltip
          const featureInfo = featureCode ? FEATURE_CATALOG[featureCode] : null;

          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={
                isPlanLocked && featureInfo ? `${featureInfo.name} — available on ${featureInfo.minPlan} plan. Contact Super Admin to upgrade.` :
                isRoleBlocked ? `Your role cannot access this — request from Company Admin` :
                featureInfo ? featureInfo.description :
                label
              }
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                active && isAllowed
                  ? 'bg-gradient-to-r from-brand-600 to-cyan-500 text-white shadow-[0_12px_24px_rgba(37,99,235,0.32)]'
                  : isAllowed
                  ? 'text-slate-200 hover:bg-white/8 hover:text-white'
                  : 'text-slate-400/75 cursor-pointer hover:bg-white/4',
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
              {/* Lock icon — plan not enabled (future: when entitlement system is live) */}
              {isPlanLocked && (
                <LockIcon size={12} className="text-brand-500/80 shrink-0" aria-label="Plan required" />
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
