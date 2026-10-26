'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { canAccess, ROLE_HOME, type AppRole } from '@/lib/roles';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!user) return;

    const role   = user.role as AppRole;
    const status = user.organization?.status;

    // PENDING orgs see only the pending-approval screen
    if (status === 'PENDING' && pathname !== '/pending-approval') {
      router.replace('/pending-approval');
      return;
    }

    // REJECTED orgs see only the rejection screen
    if (status === 'REJECTED' && pathname !== '/rejected') {
      router.replace('/rejected');
      return;
    }

    // Role cannot access this page → redirect to role home
    if (status === 'ACTIVE' && !canAccess(role, pathname)) {
      const home = ROLE_HOME[role] ?? '/dashboard';
      router.replace(home);
    }
  }, [isAuthenticated, user, pathname, router]);

  // Don't render until auth confirmed
  if (!isAuthenticated || !user) return null;

  // Prevent flash of forbidden content while redirecting
  if (!canAccess(user.role as AppRole, pathname)) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
