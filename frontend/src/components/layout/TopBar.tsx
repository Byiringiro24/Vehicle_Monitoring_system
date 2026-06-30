'use client';
import { Bell, LogOut, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import toast from 'react-hot-toast';
import { useTheme } from 'next-themes';

export function TopBar() {
  const { user, logout, refreshToken } = useAuthStore();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  async function handleLogout() {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    disconnectSocket();
    logout();
    router.replace('/login');
    toast.success('Logged out');
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
      <div>
        <h2 className="text-sm font-medium text-gray-500">
          {user?.organization?.name ?? 'ARTIC VMS'}
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition relative">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </header>
  );
}