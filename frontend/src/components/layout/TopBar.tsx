'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Moon, Sun, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { disconnectSocket, getSocket } from '@/lib/socket';
import toast from 'react-hot-toast';
import { useTheme } from 'next-themes';
import { getSeverityColor, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function TopBar() {
  const { user, logout, refreshToken, accessToken } = useAuthStore();
  const { notifications, unreadCount, addNotification, markAllRead, clearAll } = useNotificationStore();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [showNotifs, setShowNotifs] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Listen for real-time alerts and add to notification store
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

  // Close notification panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowNotifs(false);
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

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">{user?.organization?.name ?? 'ARTIC VMS'}</h2>
        <p className="text-xs text-gray-400">Vehicle Monitoring System</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
          aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notification bell */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markAllRead(); }}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition relative"
            aria-label="Notifications">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1 font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="font-semibold text-sm text-gray-800">Notifications</p>
                <button
                  onClick={clearAll}
                  title="Clear all"
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
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

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </header>
  );
}
