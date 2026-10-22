'use client';
import { useAuthStore } from '@/store/authStore';
import dynamic from 'next/dynamic';
import type { AppRole } from '@/lib/roles';

// ── Lazy-load each role dashboard to keep bundle small ────────────────────────
const FleetDashboard   = dynamic(() => import('./_dashboards/FleetDashboard'),   { ssr: false });
const FinanceDashboard = dynamic(() => import('./_dashboards/FinanceDashboard'), { ssr: false });
const DriverDashboard  = dynamic(() => import('./_dashboards/DriverDashboard'),  { ssr: false });
const ViewerDashboard  = dynamic(() => import('./_dashboards/ViewerDashboard'),  { ssr: false });
const AdminDashboard   = dynamic(() => import('./_dashboards/AdminDashboard'),   { ssr: false });

export default function DashboardPage() {
  const { user } = useAuthStore();
  const role = (user?.role ?? 'VIEWER') as AppRole;

  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return <AdminDashboard />;
  if (role === 'FINANCE_MANAGER')                 return <FinanceDashboard />;
  if (role === 'DRIVER')                          return <DriverDashboard />;
  if (role === 'FLEET_MANAGER')                   return <FleetDashboard />;
  return <ViewerDashboard />;
}
