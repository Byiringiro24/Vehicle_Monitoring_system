'use client';
import { useAuthStore } from '@/store/authStore';
import dynamic from 'next/dynamic';
import type { AppRole } from '@/lib/roles';

// ── Lazy-load each role dashboard to keep bundle small ────────────────────────
const FleetDashboard       = dynamic(() => import('./_dashboards/FleetDashboard'),       { ssr: false });
const FinanceDashboard     = dynamic(() => import('./_dashboards/FinanceDashboard'),     { ssr: false });
const DriverDashboard      = dynamic(() => import('./_dashboards/DriverDashboard'),      { ssr: false });
const ViewerDashboard      = dynamic(() => import('./_dashboards/ViewerDashboard'),      { ssr: false });
const AdminDashboard       = dynamic(() => import('./_dashboards/AdminDashboard'),       { ssr: false });
const DispatcherDashboard  = dynamic(() => import('./_dashboards/DispatcherDashboard'),  { ssr: false });
const HRDashboard          = dynamic(() => import('./_dashboards/HRDashboard'),          { ssr: false });
const MechanicDashboard    = dynamic(() => import('./_dashboards/MechanicDashboard'),    { ssr: false });
const ComplianceDashboard  = dynamic(() => import('./_dashboards/ComplianceDashboard'),  { ssr: false });
const RentalDashboard      = dynamic(() => import('./_dashboards/RentalDashboard'),      { ssr: false });
const SalesDashboard       = dynamic(() => import('./_dashboards/SalesDashboard'),       { ssr: false });
const AuditorDashboard     = dynamic(() => import('./_dashboards/AuditorDashboard'),     { ssr: false });

export default function DashboardPage() {
  const { user } = useAuthStore();
  const role = (user?.role ?? 'VIEWER') as AppRole;

  if (role === 'SUPER_ADMIN' || role === 'ADMIN')        return <AdminDashboard />;
  if (role === 'FINANCE_MANAGER')                        return <FinanceDashboard />;
  if (role === 'DRIVER')                                 return <DriverDashboard />;
  if (role === 'FLEET_MANAGER')                          return <FleetDashboard />;
  if (role === 'DISPATCHER')                             return <DispatcherDashboard />;
  if (role === 'HR_MANAGER')                             return <HRDashboard />;
  if (role === 'MECHANIC')                               return <MechanicDashboard />;
  if (role === 'COMPLIANCE_OFFICER')                     return <ComplianceDashboard />;
  if (role === 'RENTAL_MANAGER')                         return <RentalDashboard />;
  if (role === 'SALES_AGENT')                            return <SalesDashboard />;
  if (role === 'AUDITOR')                                return <AuditorDashboard />;
  if (role === 'PLATFORM_SUPPORT')                       return <AdminDashboard />; // fallback — they land on /platform/support
  return <ViewerDashboard />;
}
