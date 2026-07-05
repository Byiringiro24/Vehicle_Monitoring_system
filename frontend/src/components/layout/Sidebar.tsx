'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Truck, Bell, Map, Users, Settings,
  BarChart3, MapPin, UserCheck, User,
  DollarSign, FileText, Fuel, Wrench, Activity,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/map',       label: 'Live Tracking', icon: Map },
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

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <aside className="w-60 bg-gray-900 border-r border-gray-800 text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-gray-800">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <Truck size={16} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-white leading-tight">ARTIC VMS</p>
          <p className="text-[10px] text-gray-500 leading-tight">Fleet Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                active
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}>
              <Icon size={16} className="shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t border-gray-800 p-3">
        <Link href="/profile"
          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-800 transition">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0 text-white">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
          <User size={12} className="text-gray-500 shrink-0" />
        </Link>
      </div>
    </aside>
  );
}
