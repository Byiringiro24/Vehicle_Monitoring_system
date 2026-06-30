'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Truck, Bell, Map, Users, Settings,
  BarChart3, Shield, Fuel, Navigation, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vehicles', label: 'Vehicles', icon: Truck },
  { href: '/telemetry', label: 'Live Map', icon: Map },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <aside className="w-64 bg-brand-900 text-white flex flex-col shrink-0 shadow-2xl">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-brand-700">
        <div className="bg-brand-500 p-2 rounded-lg"><Truck size={20} /></div>
        <div>
          <p className="font-bold text-sm leading-tight">ARTIC VMS</p>
          <p className="text-xs text-blue-300 leading-tight">Fleet Monitor</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                active
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-blue-200 hover:bg-brand-700 hover:text-white',
              )}>
              <Icon size={18} className={cn(active ? 'text-white' : 'text-blue-300 group-hover:text-white')} />
              {label}
              {active && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-brand-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-sm font-bold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-blue-300 truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}