'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Truck, Bell, Map, Users, Settings,
  BarChart3, MapPin, UserCheck, User, X,
  DollarSign, Activity, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/map',       label: 'Live Map',      icon: Map },
  { href: '/vehicles',  label: 'Vehicles',      icon: Truck },
  { href: '/drivers',   label: 'Drivers',       icon: UserCheck },
  { href: '/alerts',    label: 'Alerts',        icon: Bell },
  { href: '/geofences', label: 'Geofences',     icon: MapPin },
  { href: '/telemetry', label: 'Telemetry',     icon: Activity },
  { href: '/finance',   label: 'Finance',       icon: DollarSign },
  { href: '/reports',   label: 'Reports',       icon: BarChart3 },
  { href: '/users',     label: 'Users',         icon: Users },
  { href: '/settings',  label: 'Settings',      icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <aside className="w-64 bg-brand-900 text-white flex flex-col shrink-0 shadow-2xl h-full">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-brand-700/50">
        <div className="bg-brand-500 p-2 rounded-lg shadow-inner">
          <Truck size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight tracking-wide">ARTIC VMS</p>
          <p className="text-xs text-blue-300 leading-tight">Vehicle Monitoring</p>
        </div>
        {/* Mobile close button */}
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 text-blue-300 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                active
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              )}>
              <Icon size={17} className={cn('shrink-0', active ? 'text-white' : 'text-blue-300 group-hover:text-white')} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={13} className="opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="p-3 border-t border-brand-700/50">
        <Link href="/profile" onClick={onClose}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-sm font-bold shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-blue-300 truncate">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
          <User size={14} className="text-blue-300 shrink-0" />
        </Link>
      </div>
    </aside>
  );
}
