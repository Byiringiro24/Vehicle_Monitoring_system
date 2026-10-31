'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { canAccess, ROLE_HOME, type AppRole } from '@/lib/roles';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { authApi } from '@/lib/api';

const pageVariants = {
  hidden: { opacity: 0, y: 6 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:   { opacity: 0,       transition: { duration: 0.1 } },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, setAuth, accessToken, refreshToken } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Refresh user from server on every app load ─────────────────────────────
  // This keeps org.status fresh so PENDING/REJECTED redirects work correctly
  // even when the status was changed by an admin while the user had a cached session.
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    authApi.me().then((fresh) => {
      if (fresh && accessToken && refreshToken) {
        setAuth(fresh, accessToken, refreshToken);
      }
    }).catch(() => {
      // /me failed (token expired) — the 401 interceptor in api.ts handles refresh
    });
    // Only run once on mount — not on every pathname change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!user) return;

    const roles = [user.role, ...(user.roles ?? [])].filter(Boolean) as AppRole[];
    const status = user.organization?.status;

    if (status === 'PENDING' && pathname !== '/pending-approval') {
      router.replace('/pending-approval');
      return;
    }

    if (status === 'REJECTED' && pathname !== '/rejected') {
      router.replace('/rejected');
      return;
    }

    if (status === 'ACTIVE' && !canAccess(roles, pathname)) {
      const home = ROLE_HOME[(roles[0] ?? user.role) as AppRole] ?? '/dashboard';
      router.replace(home);
    }
  }, [isAuthenticated, user, pathname, router]);

  // Don't render until auth confirmed
  if (!isAuthenticated || !user) return null;

  const roles = [user.role, ...(user.roles ?? [])].filter(Boolean) as AppRole[];
  if (!canAccess(roles, pathname)) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_20%),linear-gradient(180deg,_#f8fafc_0%,_#eef3fb_100%)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-transparent">
          <div className="mx-auto max-w-[1600px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                variants={pageVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="space-y-5"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
