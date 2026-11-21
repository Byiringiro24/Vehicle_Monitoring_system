'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Moon, Sun, X, Menu, ChevronDown, ArrowLeftRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { disconnectSocket, getSocket } from '@/lib/socket';
import toast from 'react-hot-toast';
import { useTheme } from 'next-themes';
import { getSeverityColor, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ROLE_HOME } from '@/lib/roles';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:        'bg-red-100 text-red-700 border-red-200',
  ADMIN:              'bg-orange-100 text-orange-700 border-orange-200',
  FLEET_MANAGER:      'bg-blue-100 text-blue-700 border-blue-200',
  FINANCE_MANAGER:    'bg-purple-100 text-purple-700 border-purple-200',
  HR_MANAGER:         'bg-indigo-100 text-indigo-700 border-indigo-200',
  MECHANIC:           'bg-yellow-100 text-yellow-700 border-yellow-200',
  COMPLIANCE_OFFICER: 'bg-teal-100 text-teal-700 border-teal-200',
  RENTAL_MANAGER:     'bg-cyan-100 text-cyan-700 border-cyan-200',
  SALES_AGENT:        'bg-pink-100 text-pink-700 border-pink-200',
  AUDITOR:            'bg-slate-100 text-slate-700 border-slate-200',
  DRIVER:             'bg-green-100 text-green-700 border-green-200',
  VIEWER:             'bg-gray-100 text-gray-600 border-gray-200',
  PLATFORM_SUPPORT:   'bg-rose-100 text-rose-700 border-rose-200',
};

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout, refreshToken, accessToken, activeRole, switchRole } = useAuthStore();
  const { notifications, unreadCount, addNotification, markAllRead, clearAll } = useNotificationStore();
  const router  = useRouter();
  const { theme, setTheme } = useTheme();

  const [showNotifs,     setShowNotifs]     = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);

  const bellRef    = useRef<HTMLDivElement>(null);
  const roleRef    = useRef<HTMLDivElement>(null);

  const allRoles   = Array.from(new Set([user?.role, ...(user?.roles ?? [])])).filter(Boolean) as string[];
  const currentRole = activeRole ?? user?.role ?? '';
  const hasMultipleRoles = allRoles.length > 1;

  // Listen for real-time alerts
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket.on('alert:new', (alert: { title: string; message: string; severity: string; vehicle?: { name?: string } }) => {
      addNotification({
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        vehicleName: alert.vehicle?.name ?? 'Unknown',
      });
    });
    return () => { socket.off('alert:new'); };
  }, [accessToken, addNotification]);

  // Close panels on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node))  setShowNotifs(false);
      if (roleRef.current && !roleRef.current.contains(e.target as Node))  setShowRolePicker(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogout() {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    disconnectSocket();
    logout();
    router.replace('/login');
    toast.success('Logged out');
  }

  function handleSwitchRole(role: string) {
    switchRole(role);
    setShowRolePicker(false);
    const home = ROLE_HOME[role as keyof typeof ROLE_HOME] ?? '/dashboard';
    router.push(home);
    toast.success(`Switched to ${role.replace(/_/g, ' ')}`);
  }

  return (
    <header className="h-16 bg-white/80 border-b border-slate-200/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shrink-0 shadow-[0_8px_28px_rgba(15,23,42,0.04)] z-10">
      {/* Left — hamburger + org name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
          aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="hidden sm:block">
          <h2 className="text-sm font-bold text-slate-800 leading-tight">{user?.organization?.name ?? 'ARTIC VMS'}</h2>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 leading-tight">Vehicle Monitoring System</p>
        </div>
      </div>

      {/* Right — role switcher + theme + bell + avatar + logout */}
      <div className="flex items-center gap-1.5">

        {/* ── Role switcher ──────────────────────────────────────────────── */}
        {hasMultipleRoles && (
          <div className="relative" ref={roleRef}>
            <button
              onClick={() => setShowRolePicker(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition',
                ROLE_COLORS[currentRole] ?? 'bg-gray-100 text-gray-700 border-gray-200',
                'hover:opacity-80'
              )}
              title="Switch role">
              <ArrowLeftRight size={12} />
              <span className="hidden sm:inline">{currentRole.replace(/_/g, ' ')}</span>
              <ChevronDown size={11} className={cn('transition-transform', showRolePicker && 'rotate-180')} />
            </button>

            {showRolePicker && (
              <div className="absolute right-0 top-11 w-56 bg-white rounded-2xl shadow-[0_25px_50px_rgba(15,23,42,0.18)] border border-slate-200 z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-600">Switch operating role</p>
                </div>
                <div className="py-1.5 max-h-72 overflow-y-auto">
                  {allRoles.map(role => (
                    <button
                      key={role}
                      onClick={() => handleSwitchRole(role)}
                      className={cn(
                        'w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-sm transition',
                        currentRole === role
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      )}>
                      <span className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        currentRole === role ? 'bg-brand-500' : 'bg-slate-200'
                      )} />
                      <div className="flex-1">
                        <p className="font-medium text-xs">{role.replace(/_/g, ' ')}</p>
                      </div>
                      {currentRole === role && (
                        <span className="text-[9px] font-bold text-brand-500 uppercase tracking-wider">Active</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Single role badge — no switcher */}
        {!hasMultipleRoles && (
          <span className={cn(
            'hidden sm:inline-flex items-center px-2.5 py-1 rounded-xl border text-xs font-semibold',
            ROLE_COLORS[currentRole] ?? 'bg-gray-100 text-gray-700 border-gray-200'
          )}>
            {currentRole.replace(/_/g, ' ')}
          </span>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition border border-slate-200/80 bg-white/70"
          aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notification bell */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markAllRead(); }}
            className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition relative border border-slate-200/80 bg-white/70"
            aria-label="Notifications">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center px-1 font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-72 sm:w-80 bg-white rounded-2xl shadow-[0_25px_50px_rgba(15,23,42,0.22)] border border-slate-200 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                <p className="font-semibold text-sm text-slate-800">Notifications</p>
                <button onClick={clearAll} className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length ? notifications.map(n => (
                  <div key={n.id} className={cn('px-4 py-3 text-sm', getSeverityColor(n.severity))}>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-xs opacity-75 truncate">{n.vehicleName} — {n.message}</p>
                    <p className="text-xs opacity-50 mt-0.5">{formatDate(n.timestamp)}</p>
                  </div>
                )) : (
                  <div className="py-8 text-center text-gray-400 text-sm">
                    <Bell size={24} className="mx-auto mb-2 opacity-20" />
                    No notifications
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <a href="/profile"
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition group"
          title={`${user?.firstName} ${user?.lastName} — ${currentRole.replace(/_/g,' ')}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-gray-800 leading-tight">{user?.firstName} {user?.lastName}</p>
            <p className="text-[10px] text-gray-400 leading-tight">{currentRole.replace(/_/g,' ')}</p>
          </div>
        </a>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition border border-slate-200/80 bg-white/70">
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
