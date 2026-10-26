/**
 * ARTIC VMS — Role-based access configuration
 * Single source of truth for which routes each role can access.
 * Used by: Sidebar (show/hide links), DashboardLayout (redirect guard),
 *          and any page-level access checks.
 */

export type AppRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FLEET_MANAGER'
  | 'FINANCE_MANAGER'
  | 'DRIVER'
  | 'VIEWER';

// ── First page each role lands on after login ─────────────────────────────────
export const ROLE_HOME: Record<AppRole, string> = {
  SUPER_ADMIN:     '/platform',
  ADMIN:           '/dashboard',
  FLEET_MANAGER:   '/dashboard',
  FINANCE_MANAGER: '/finance',
  DRIVER:          '/dashboard',
  VIEWER:          '/dashboard',
};

// ── Nav items per role ────────────────────────────────────────────────────────
// Format: { href, label, icon (name), allowedRoles }
// allowedRoles: undefined = all authenticated users; array = only those roles
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles?: AppRole[];
};

export const NAV_ITEMS: NavItem[] = [
  // ── Platform Admin (SUPER_ADMIN only) ──────────────────────────────────────
  { href: '/platform',    label: 'Platform',      icon: 'Globe',            roles: ['SUPER_ADMIN'] },

  // ── Operations ─────────────────────────────────────────────────────────────
  { href: '/dashboard',   label: 'Dashboard',     icon: 'LayoutDashboard' },
  { href: '/map',         label: 'Live Map',       icon: 'Map',              roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','VIEWER'] },
  { href: '/vehicles',    label: 'Vehicles',       icon: 'Truck',            roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','VIEWER'] },
  { href: '/drivers',     label: 'Drivers',        icon: 'UserCheck',        roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER'] },
  { href: '/alerts',      label: 'Alerts',         icon: 'Bell',             roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','VIEWER'] },
  { href: '/geofences',   label: 'Geofences',      icon: 'MapPin',           roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER'] },
  { href: '/maintenance', label: 'Maintenance',    icon: 'Wrench',           roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER'] },
  { href: '/telemetry',   label: 'Telemetry',      icon: 'Activity',         roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER'] },

  // ── Business / Finance ─────────────────────────────────────────────────────
  { href: '/customers',   label: 'Customers',      icon: 'UserCheck',        roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','FINANCE_MANAGER'] },
  { href: '/agreements',  label: 'Agreements',     icon: 'FileText',         roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','FINANCE_MANAGER'] },
  { href: '/finance',     label: 'Finance',        icon: 'DollarSign',       roles: ['SUPER_ADMIN','ADMIN','FINANCE_MANAGER'] },
  { href: '/reports',     label: 'Reports',        icon: 'BarChart3',        roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','FINANCE_MANAGER'] },

  // ── Compliance ─────────────────────────────────────────────────────────────
  { href: '/documents',   label: 'Documents',      icon: 'FileText',         roles: ['SUPER_ADMIN','ADMIN','FLEET_MANAGER','FINANCE_MANAGER'] },

  // ── Administration ─────────────────────────────────────────────────────────
  { href: '/users',       label: 'Users',          icon: 'Users',            roles: ['SUPER_ADMIN','ADMIN'] },
  { href: '/settings',    label: 'Settings',       icon: 'Settings' },
  { href: '/support',     label: 'Support',        icon: 'Headphones' },
];

// ── Page-level access rules ───────────────────────────────────────────────────
// Pages not listed here are accessible to all authenticated users.
export const PAGE_ROLES: Record<string, AppRole[]> = {
  '/platform':    ['SUPER_ADMIN'],
  '/users':       ['SUPER_ADMIN', 'ADMIN'],
  '/finance':     ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
  '/agreements':  ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER'],
  '/customers':   ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER'],
  '/documents':   ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER'],
  '/maintenance': ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'],
  '/geofences':   ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'],
  '/drivers':     ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER'],
  '/reports':     ['SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE_MANAGER'],
};

/**
 * Returns true if the given role can access the given pathname.
 * Uses prefix matching so /agreements/abc matches /agreements.
 */
export function canAccess(role: AppRole | string, pathname: string): boolean {
  for (const [path, roles] of Object.entries(PAGE_ROLES)) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      return (roles as string[]).includes(role);
    }
  }
  return true; // pages not in PAGE_ROLES are open to all authenticated users
}

/**
 * Returns nav items visible to the given role.
 */
export function getNavItems(role: AppRole | string) {
  return NAV_ITEMS.filter(item =>
    !item.roles || (item.roles as string[]).includes(role)
  );
}
