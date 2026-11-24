'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { getNavItems, type AppRole } from '@/lib/roles';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import {
  LayoutDashboard, Truck, Bell, Map, Users, Settings,
  BarChart3, MapPin, UserCheck, User, X,
  DollarSign, Activity, ChevronRight, ChevronDown, Wrench, Globe, FileText,
  Headphones, Navigation, Hammer, ShieldCheck,
  CalendarDays, Users2, UsersRound, CheckSquare, Car, FolderOpen,
  Bike, ShoppingBag, Tag, Eye, ArrowLeftRight,
} from 'lucide-react';

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, Truck, Bell, Map, Users, Settings,
  BarChart3, MapPin, UserCheck, User, DollarSign, Activity, Wrench, Globe,
  FileText, Headphones, Navigation, Hammer, ShieldCheck, CalendarDays,
  Users2, UsersRound, CheckSquare, Car, FolderOpen, Bike, ShoppingBag, Tag, Eye,
};

// ── Sidebar nav categories ────────────────────────────────────────────────────
const NAV_GROUPS: { label: string; icon: React.ElementType; paths: string[] }[] = [
  {
    label: 'Overview',
    icon:  LayoutDashboard,
    paths: ['/dashboard', '/platform', '/platform/support'],
  },
  {
    label: 'Vehicle Fleet',
    icon:  Truck,
    paths: ['/vehicles', '/vehicle-report', '/vehicle-report/payments', '/vehicle-report/daily-report', '/vehicle-report/garage', '/vehicle-report/fines', '/vehicle-report/reports', '/map', '/telemetry', '/geofences', '/alerts'],
  },
  {
    label: 'Operations',
    icon:  Navigation,
    paths: ['/drivers', '/dispatch', '/maintenance', '/workshop', '/compliance'],
  },
  {
    label: 'Finance',
    icon:  DollarSign,
    paths: ['/finance', '/agreements', '/customers', '/rentals', '/sales', '/payouts', '/approvals', '/reports'],
  },
  {
    label: 'HR & Docs',
    icon:  UsersRound,
    paths: ['/staff', '/documents'],
  },
  {
    label: 'Administration',
    icon:  Settings,
    paths: ['/users', '/settings'],
  },
  {
    label: 'Audit',
    icon:  Eye,
    paths: ['/audit-view'],
  },
  {
    label: 'My Portals',
    icon:  User,
    paths: ['/owner', '/customer', '/rider', '/seller', '/provider'],
  },
  {
    label: 'Support',
    icon:  Headphones,
    paths: ['/support', '/account/contexts'],
  },
];

// Which groups are open by default (by label)
const DEFAULT_OPEN = new Set(['Overview', 'Vehicle Fleet', 'Operations', 'Finance']);

interface SidebarProps { onClose?: () => void; }

export function Sidebar({ onClose }: SidebarProps) {
  const pathname  = usePathname();
  const { user, activeRole } = useAuthStore();
  const role = ((activeRole ?? user?.role ?? 'VIEWER')) as AppRole;

  const allItems  = getNavItems('SUPER_ADMIN' as AppRole);
  const allowed   = new Set(getNavItems(role).map(i => i.href));

  // Which groups are expanded — stored in localStorage
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return DEFAULT_OPEN;
    try {
      const stored = localStorage.getItem('sidebar-groups');
      return stored ? new Set<string>(JSON.parse(stored) as string[]) : DEFAULT_OPEN;
    } catch { return DEFAULT_OPEN; }
  });

  // Auto-expand group containing active route
  useEffect(() => {
    const group = NAV_GROUPS.find(g => g.paths.some(p => pathname === p || pathname.startsWith(p + '/')));
    if (group && !openGroups.has(group.label)) {
      setOpenGroups(prev => {
        const next = new Set<string>([...Array.from(prev), group.label]);
        localStorage.setItem('sidebar-groups', JSON.stringify(Array.from(next)));
        return next;
      });
    }
  }, [pathname]);

  function toggleGroup(label: string) {
    setOpenGroups(prev => {
      const next = new Set<string>(Array.from(prev));
      next.has(label) ? next.delete(label) : next.add(label);
      localStorage.setItem('sidebar-groups', JSON.stringify(Array.from(next)));
      return next;
    });
  }

  // Build a map href→item for fast lookup
  const itemMap = Object.fromEntries(allItems.map(i => [i.href, i]));

  return (
    <aside className="w-64 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.28),_transparent_24%),linear-gradient(180deg,_#0b1220_0%,_#101b35_100%)] text-white flex flex-col shrink-0 shadow-[0_20px_60px_rgba(15,23,42,0.35)] h-full">

      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10 bg-white/3 shrink-0">
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

      {/* ── Role badge (compact) ───────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 animate-pulse" />
          <p className="text-xs font-semibold text-sky-100 flex-1 truncate">{role.replace(/_/g, ' ')}</p>
          <ArrowLeftRight size={11} className="text-sky-300/60 shrink-0" />
        </div>
      </div>

      {/* ── Navigation groups ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {NAV_GROUPS.map(group => {
          // Items that belong to this group and are visible TO THIS ROLE ONLY
          const groupItems = group.paths
            .map(p => itemMap[p])
            .filter(Boolean)
            .filter(item => allowed.has(item.href)); // strict: only items this role can use

          if (!groupItems.length) return null;

          const isOpen = openGroups.has(group.label);
          const GroupIcon = group.icon;

          // Check if any item in this group is active
          const hasActive = groupItems.some(item =>
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
          );

          return (
            <div key={group.label} className="mb-0.5">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-150',
                  hasActive
                    ? 'text-cyan-300 bg-white/8'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )}>
                <GroupIcon size={13} className={cn('shrink-0', hasActive ? 'text-cyan-400' : 'text-slate-500')} />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  size={13}
                  className={cn('shrink-0 transition-transform duration-200', isOpen ? 'rotate-0' : '-rotate-90')}
                />
              </button>

              {/* Items — animated collapse */}
              {isOpen && (
                <div className="ml-2 mt-0.5 space-y-0.5">
                  {groupItems.map(item => {
                    const Icon   = ICONS[item.icon] ?? FileText;
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        title={item.label}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group',
                          active
                            ? 'bg-gradient-to-r from-brand-600/90 to-cyan-500/80 text-white shadow-[0_6px_16px_rgba(37,99,235,0.28)]'
                            : 'text-slate-300 hover:bg-white/8 hover:text-white',
                        )}>
                        <Icon
                          size={16}
                          className={cn(
                            'shrink-0 transition-colors',
                            active ? 'text-white' : 'text-brand-300/80 group-hover:text-white',
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {active && <ChevronRight size={12} className="opacity-50 shrink-0" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Workspace switcher ────────────────────────────────────────── */}
      <div className="px-1 border-t border-brand-700/50 pt-2 shrink-0">
        <WorkspaceSwitcher />
      </div>

      {/* ── User card ─────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-brand-700/50 shrink-0">
        <Link
          href="/profile"
          onClick={onClose}
          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 transition group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-sky-300/70 truncate">{role.replace(/_/g,' ')}</p>
          </div>
          <Settings size={13} className="text-slate-400 group-hover:text-white transition shrink-0" />
        </Link>
      </div>
    </aside>
  );
}
