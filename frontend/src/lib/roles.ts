/**
 * ARTIC VMS — Role-based access configuration
 * 14 roles, zero duplicates.
 *
 * Platform:     SUPER_ADMIN, PLATFORM_SUPPORT
 * Company:       ADMIN, FLEET_MANAGER, FINANCE_MANAGER, DISPATCHER,
 *                HR_MANAGER, MECHANIC, COMPLIANCE_OFFICER, RENTAL_MANAGER, SALES_AGENT
 * Audit:         AUDITOR
 * Operations:    DRIVER (covers rider via /rider portal variant)
 * Personal:      VIEWER (covers owner/customer/seller/provider via intendedRole)
 */

export type AppRole =
  | 'SUPER_ADMIN'
  | 'PLATFORM_SUPPORT'
  | 'ADMIN'
  | 'FLEET_MANAGER'
  | 'FINANCE_MANAGER'
  | 'DISPATCHER'
  | 'HR_MANAGER'
  | 'MECHANIC'
  | 'COMPLIANCE_OFFICER'
  | 'RENTAL_MANAGER'
  | 'SALES_AGENT'
  | 'AUDITOR'
  | 'DRIVER'
  | 'VIEWER';

// ── First page each role lands on after login ─────────────────────────────────
export const ROLE_HOME: Record<AppRole, string> = {
  SUPER_ADMIN:         '/platform',
  PLATFORM_SUPPORT:    '/platform/support',
  ADMIN:               '/dashboard',
  FLEET_MANAGER:       '/dashboard',
  FINANCE_MANAGER:     '/finance',
  DISPATCHER:          '/dispatch',
  HR_MANAGER:          '/staff',
  MECHANIC:            '/workshop',
  COMPLIANCE_OFFICER:  '/compliance',
  RENTAL_MANAGER:      '/rentals',
  SALES_AGENT:         '/sales',
  AUDITOR:             '/audit-view',
  DRIVER:              '/dashboard',
  VIEWER:              '/dashboard',
};

// ── Nav item type ──────────────────────────────────────────────────────────────
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles?: AppRole[];
};

export const NAV_ITEMS: NavItem[] = [
  // ── Platform Admin ──────────────────────────────────────────────────────────
  { href: '/platform',         label: 'Platform',      icon: 'Globe',            roles: ['SUPER_ADMIN'] },
  { href: '/platform/support', label: 'Support Queue',  icon: 'Headphones',       roles: ['PLATFORM_SUPPORT'] },

  // ── Core operations ───────────────────────────────────────────────────────
  { href: '/dashboard',   label: 'Dashboard',     icon: 'LayoutDashboard' },
  { href: '/moto',         label: 'Moto Fleet',    icon: 'Bike',            roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','FINANCE_MANAGER','DISPATCHER'] },
  { href: '/map',         label: 'Live Map',       icon: 'Map',             roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','DISPATCHER','VIEWER','AUDITOR'] },
  { href: '/vehicles',    label: 'Vehicles',       icon: 'Truck',           roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','DISPATCHER','RENTAL_MANAGER','SALES_AGENT','VIEWER','AUDITOR'] },
  { href: '/drivers',     label: 'Drivers',        icon: 'UserCheck',       roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','DISPATCHER'] },
  { href: '/dispatch',    label: 'Dispatch',       icon: 'Navigation',      roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','DISPATCHER'] },
  { href: '/alerts',      label: 'Alerts',         icon: 'Bell',            roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','DISPATCHER','COMPLIANCE_OFFICER','VIEWER','AUDITOR'] },
  { href: '/geofences',   label: 'Geofences',      icon: 'MapPin',          roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER'] },
  { href: '/maintenance', label: 'Maintenance',    icon: 'Wrench',          roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER'] },
  { href: '/workshop',    label: 'Workshop',       icon: 'Hammer',          roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','MECHANIC'] },
  { href: '/compliance',  label: 'Compliance',     icon: 'ShieldCheck',     roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','COMPLIANCE_OFFICER'] },
  { href: '/telemetry',   label: 'Telemetry',      icon: 'Activity',        roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER'] },

  // ── Business / Finance ────────────────────────────────────────────────────
  { href: '/rentals',     label: 'Rentals',        icon: 'CalendarDays',    roles: ['SUPER_ADMIN','ADMIN','RENTAL_MANAGER'] },
  { href: '/sales',       label: 'Sales',          icon: 'Tag',            roles: ['SUPER_ADMIN','ADMIN','SALES_AGENT'] },
  { href: '/customers',   label: 'Customers',      icon: 'Users2',          roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','FINANCE_MANAGER','RENTAL_MANAGER','SALES_AGENT'] },
  { href: '/agreements',  label: 'Agreements',     icon: 'FileText',        roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','FINANCE_MANAGER','RENTAL_MANAGER','SALES_AGENT'] },
  { href: '/finance',     label: 'Finance',        icon: 'DollarSign',      roles: ['SUPER_ADMIN','ADMIN','FINANCE_MANAGER'] },
  { href: '/payouts',     label: 'Payouts',        icon: 'DollarSign',      roles: ['SUPER_ADMIN','ADMIN','FINANCE_MANAGER'] },
  { href: '/approvals',   label: 'Approvals',      icon: 'CheckSquare',     roles: ['SUPER_ADMIN','ADMIN','FINANCE_MANAGER'] },
  { href: '/reports',     label: 'Reports',        icon: 'BarChart3',       roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','FINANCE_MANAGER','AUDITOR'] },

  // ── HR & Compliance ───────────────────────────────────────────────────────
  { href: '/staff',       label: 'Staff / HR',     icon: 'UsersRound',      roles: ['SUPER_ADMIN','ADMIN','HR_MANAGER'] },
  { href: '/documents',   label: 'Documents',      icon: 'FolderOpen',      roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','FINANCE_MANAGER','COMPLIANCE_OFFICER','AUDITOR'] },

  // ── Audit (read-only) ──────────────────────────────────────────────────────
  { href: '/audit-view',  label: 'Audit View',    icon: 'Eye',             roles: ['AUDITOR'] },

  // ── Personal portals ──────────────────────────────────────────────────────
  { href: '/owner',       label: 'My Vehicles',   icon: 'Car',             roles: ['SUPER_ADMIN','ADMIN','VIEWER','DRIVER'] },
  { href: '/customer',    label: 'My Bookings',   icon: 'ShoppingBag',     roles: ['VIEWER'] },
  { href: '/rider',       label: 'Rider Hub',     icon: 'Bike',            roles: ['DRIVER'] },
  { href: '/seller',      label: 'My Listings',   icon: 'Tag',             roles: ['VIEWER','SALES_AGENT'] },
  { href: '/provider',    label: 'My Services',   icon: 'Wrench',          roles: ['VIEWER'] },

  // ── Administration ────────────────────────────────────────────────────────
  { href: '/users',       label: 'Users',          icon: 'Users',           roles: ['SUPER_ADMIN','ADMIN'] },
  { href: '/settings',    label: 'Settings',       icon: 'Settings' },
  { href: '/account/contexts', label: 'My Account', icon: 'User' },
  { href: '/support',     label: 'Support',        icon: 'Headphones' },
];

// ── Page-level access rules ───────────────────────────────────────────────────
export const PAGE_ROLES: Record<string, AppRole[]> = {
  '/platform':         ['SUPER_ADMIN'],
  '/platform/support': ['SUPER_ADMIN', 'PLATFORM_SUPPORT'],
  '/users':            ['SUPER_ADMIN', 'ADMIN'],
  '/finance':          ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
  '/payouts':          ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
  '/approvals':        ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
  '/agreements':       ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER', 'RENTAL_MANAGER', 'SALES_AGENT'],
  '/customers':        ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER', 'RENTAL_MANAGER', 'SALES_AGENT'],
  '/documents':        ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER', 'COMPLIANCE_OFFICER', 'AUDITOR'],
  '/maintenance':      ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'],
  '/workshop':         ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'MECHANIC'],
  '/compliance':       ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'COMPLIANCE_OFFICER'],
  '/geofences':        ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'],
  '/drivers':          ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'DISPATCHER'],
  '/dispatch':         ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'DISPATCHER'],
  '/rentals':          ['SUPER_ADMIN', 'ADMIN', 'RENTAL_MANAGER'],
  '/sales':            ['SUPER_ADMIN', 'ADMIN', 'SALES_AGENT'],
  '/staff':            ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'],
  '/reports':          ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER', 'AUDITOR'],
  '/audit-view':       ['AUDITOR'],
};

export function canAccess(role: AppRole | string, pathname: string): boolean {
  for (const [path, roles] of Object.entries(PAGE_ROLES)) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      return (roles as string[]).includes(role);
    }
  }
  return true;
}

export function getNavItems(role: AppRole | string) {
  return NAV_ITEMS.filter(item =>
    !item.roles || (item.roles as string[]).includes(role)
  );
}
