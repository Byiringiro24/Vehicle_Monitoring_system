/**
 * ARTIC VMS — Feature Catalog
 * 
 * Defines which features are CORE (always available to any active company)
 * vs PREMIUM (plan-gated, require specific plan or Super Admin override).
 * 
 * Core features: engine lock, driver payments, expenses, agreements, GPS tracking,
 * vehicles, drivers, alerts, geofences, maintenance, documents, reports.
 * 
 * Premium features: dispatch, workshop, compliance, HR, rentals, AI assistant,
 * double-entry accounting, custom roles, API access, advanced reports.
 */

export type PlanTier = 'FREE' | 'STARTER' | 'BUSINESS' | 'ENTERPRISE' | 'CUSTOM';

export interface FeatureInfo {
  code: string;
  name: string;
  description: string;
  benefits: string[];
  minPlan: PlanTier;
  icon: string;     // lucide icon name
  color: string;     // tailwind color class for the icon bg
  category: 'GPS' | 'Operations' | 'Finance' | 'Business' | 'Advanced' | 'Marketplace';
}

// ── All features in the system ────────────────────────────────────────────────
export const FEATURE_CATALOG: Record<string, FeatureInfo> = {
  // ── CORE — always available to any ACTIVE company ────────────────────────────
  'core.dashboard': {
    code: 'core.dashboard', name: 'Dashboard', description: 'Real-time fleet overview with live map, KPIs and alerts.',
    benefits: ['Live GPS positions', 'Fleet status at a glance', 'Active alerts feed'], minPlan: 'FREE',
    icon: 'LayoutDashboard', color: 'bg-blue-50', category: 'GPS',
  },
  'core.vehicles': {
    code: 'core.vehicles', name: 'Vehicle Management', description: 'Full vehicle profiles with 70+ fields, status tracking, and GPS history.',
    benefits: ['Complete vehicle records', 'GPS position history', 'Engine lock/unlock control'], minPlan: 'FREE',
    icon: 'Truck', color: 'bg-brand-50', category: 'GPS',
  },
  'gps.live_map': {
    code: 'gps.live_map', name: 'Live GPS Map', description: 'Real-time vehicle positions on an interactive map, updated every 2 seconds.',
    benefits: ['See every vehicle in real time', 'Speed, fuel, engine status', 'Dark and satellite map layers'], minPlan: 'FREE',
    icon: 'Map', color: 'bg-green-50', category: 'GPS',
  },
  'gps.history': {
    code: 'gps.history', name: 'GPS History & Replay', description: 'Route replay with date range, stop markers, and geofence events.',
    benefits: ['Replay any trip', 'Date range queries', 'Stop and geofence markers'], minPlan: 'FREE',
    icon: 'MapPin', color: 'bg-teal-50', category: 'GPS',
  },
  'gps.geofences': {
    code: 'gps.geofences', name: 'Geofencing', description: 'Draw zones on the map and get instant alerts when vehicles enter or exit.',
    benefits: ['Polygon and circle zones', 'Entry/exit alerts', 'Per-vehicle scoping'], minPlan: 'FREE',
    icon: 'Shield', color: 'bg-orange-50', category: 'GPS',
  },
  'core.drivers': {
    code: 'core.drivers', name: 'Driver Management', description: 'Driver profiles, license tracking, vehicle assignments, and 5-step onboarding wizard.',
    benefits: ['Complete driver profiles', 'License expiry tracking', 'Vehicle assignment management'], minPlan: 'FREE',
    icon: 'UserCheck', color: 'bg-purple-50', category: 'Operations',
  },
  'core.alerts': {
    code: 'core.alerts', name: 'Smart Alerts', description: '17 alert types with 5 severities — speeding, geofence, offline, insurance expiry, and more.',
    benefits: ['17 configurable alert types', 'Real-time notifications', 'Acknowledge and resolve workflow'], minPlan: 'FREE',
    icon: 'Bell', color: 'bg-red-50', category: 'GPS',
  },
  'core.maintenance': {
    code: 'core.maintenance', name: 'Maintenance', description: 'Service records, upcoming schedule, and cost tracking per vehicle.',
    benefits: ['Service history per vehicle', 'Upcoming maintenance alerts', 'Cost tracking'], minPlan: 'FREE',
    icon: 'Wrench', color: 'bg-amber-50', category: 'Operations',
  },
  'core.documents': {
    code: 'core.documents', name: 'Document Management', description: 'Upload, verify, and track insurance, licenses, and permits with expiry reminders.',
    benefits: ['Upload and verify documents', 'Automatic expiry reminders', 'Compliance dashboard'], minPlan: 'FREE',
    icon: 'FileText', color: 'bg-pink-50', category: 'Operations',
  },
  'core.agreements': {
    code: 'core.agreements', name: 'Agreements & Contracts', description: 'Configurable business models — rental, hire-purchase, lease, installment sale, daily submission.',
    benefits: ['Multiple contract types', 'Payment schedule generation', 'Overdue escalation'], minPlan: 'FREE',
    icon: 'FileText', color: 'bg-indigo-50', category: 'Finance',
  },
  'core.finance': {
    code: 'core.finance', name: 'Financial Management', description: 'P&L, expenses (20 categories), driver payroll, cash flow tracking.',
    benefits: ['Income and expense tracking', 'Driver payroll management', 'Profit & loss reports'], minPlan: 'FREE',
    icon: 'DollarSign', color: 'bg-teal-50', category: 'Finance',
  },
  'core.customers': {
    code: 'core.customers', name: 'Customer CRM', description: 'Customer profiles with credit scoring and agreement history.',
    benefits: ['Customer database', 'Credit scoring', 'Agreement history per customer'], minPlan: 'FREE',
    icon: 'Users', color: 'bg-blue-50', category: 'Finance',
  },
  'core.reports': {
    code: 'core.reports', name: 'Reports & Analytics', description: 'Fleet performance, vehicle profitability, driver payroll, and financial statements with CSV export.',
    benefits: ['Fleet performance reports', 'Vehicle profitability analysis', 'CSV export'], minPlan: 'FREE',
    icon: 'BarChart3', color: 'bg-indigo-50', category: 'Finance',
  },

  // ── PREMIUM — require specific plan tier ────────────────────────────────────
  'ops.dispatch': {
    code: 'ops.dispatch', name: 'Dispatch Board', description: 'Drag-and-drop trip assignment board with driver availability, conflict detection, and live vehicle tracking.',
    benefits: ['Kanban trip board (Unassigned → Assigned → In Progress → Completed)',
               'Driver availability and license validity checks',
               'Vehicle status and fuel monitoring before assignment',
               'Conflict detection (overlapping trips, expired licenses)'],
    minPlan: 'STARTER', icon: 'Navigation', color: 'bg-blue-50', category: 'Operations',
  },
  'ops.workshop': {
    code: 'ops.workshop', name: 'Workshop Management', description: 'Work order queue for mechanics — assigned jobs, parts logging, status updates, and completion tracking.',
    benefits: ['Work order assignment per mechanic',
               'Parts and hours logging',
               'Before/during/after photo uploads',
               'Status workflow (Scheduled → In Progress → Completed)'],
    minPlan: 'BUSINESS', icon: 'Hammer', color: 'bg-amber-50', category: 'Operations',
  },
  'ops.compliance': {
    code: 'ops.compliance', name: 'Compliance Dashboard', description: 'Document verification queue, license/permit expiry calendar, and non-compliant vehicle flagging that blocks dispatch.',
    benefits: ['Document review queue with verify/reject',
               '30-day expiry calendar with color coding',
               'Flag vehicles as non-compliant (auto-blocks dispatch)',
               'Incident reporting and escalation'],
    minPlan: 'BUSINESS', icon: 'ShieldCheck', color: 'bg-orange-50', category: 'Operations',
  },
  'ops.hr_staff': {
    code: 'ops.hr_staff', name: 'HR & Staff Management', description: 'Employee records, qualifications, attendance, shifts, leave requests, and HR reports.',
    benefits: ['Employee directory with roles and departments',
               'Qualification tracking (feeds dispatch conflict warnings)',
               'Attendance and shift management',
               'Leave request approval workflow'],
    minPlan: 'BUSINESS', icon: 'UsersRound', color: 'bg-purple-50', category: 'Operations',
  },
  'biz.rentals': {
    code: 'biz.rentals', name: 'Rental Management', description: 'Vehicle availability calendar, reservations, handovers with digital checklists, deposits, and damage tracking.',
    benefits: ['14-day availability calendar grid',
               'Reservation creation and management',
               'Handover checklist (fuel, odometer, 6 photos, accessories)',
               'Deposit and damage tracking with PDF storage'],
    minPlan: 'BUSINESS', icon: 'CalendarDays', color: 'bg-teal-50', category: 'Business',
  },
  'finance.invoices': {
    code: 'finance.invoices', name: 'Invoice Management', description: 'Create, send, and track invoices with payment allocation, status workflow, and customer billing.',
    benefits: ['Create invoices with customer and vehicle association',
               'Track payment status (Draft → Sent → Paid → Overdue)',
               'Mark invoices as paid with one click',
               'Outstanding balance tracking'],
    minPlan: 'STARTER', icon: 'FileText', color: 'bg-blue-50', category: 'Finance',
  },
  'finance.owner_statements': {
    code: 'finance.owner_statements', name: 'Owner Statements & Payouts', description: 'Monthly income/expense statements per vehicle owner, with management fee calculation and payout approval workflow.',
    benefits: ['Monthly statements per owner (6-month rolling)',
               'Gross income, expenses, management fee, net calculation',
               'Payout approval workflow (separation of duties)',
               'Automatic statement generation'],
    minPlan: 'BUSINESS', icon: 'DollarSign', color: 'bg-teal-50', category: 'Finance',
  },
  'adv.ai_assistant': {
    code: 'adv.ai_assistant', name: 'AI Assistant', description: 'Natural language fleet queries — ask "Which vehicles need maintenance this week?" and get instant answers from your data.',
    benefits: ['Ask questions in plain English',
               'Fleet insights and recommendations',
               'Predictive maintenance suggestions',
               'Anomaly detection across your fleet'],
    minPlan: 'ENTERPRISE', icon: 'Cpu', color: 'bg-purple-50', category: 'Advanced',
  },
  'finance.accounting': {
    code: 'finance.accounting', name: 'Double-Entry Accounting', description: 'Full general ledger with journal entries, account chart, trial balance, and financial statements.',
    benefits: ['Journal entry posting with debits and credits',
               'Chart of accounts configuration',
               'Trial balance and balance sheet',
               'Reconciliation tools'],
    minPlan: 'ENTERPRISE', icon: 'Calculator', color: 'bg-indigo-50', category: 'Finance',
  },
  'adv.api_access': {
    code: 'adv.api_access', name: 'API Access', description: 'Programmatic access to your fleet data via REST API with API keys, webhooks, and rate limits.',
    benefits: ['Generate API keys with scoped permissions',
               'Webhook notifications for events',
               'Full REST API documentation',
               'Rate limiting and usage analytics'],
    minPlan: 'ENTERPRISE', icon: 'Code', color: 'bg-gray-50', category: 'Advanced',
  },
  'adv.audit_log': {
    code: 'adv.audit_log', name: 'Audit Log', description: 'Immutable record of every sensitive action — who did what, when, and why. Exportable for compliance.',
    benefits: ['Every action logged with actor, timestamp, and reason',
               'Filterable by user, action type, and date range',
               'Export to CSV for compliance audits',
               'Tamper-evident storage'],
    minPlan: 'ENTERPRISE', icon: 'FileText', color: 'bg-gray-50', category: 'Advanced',
  },
};

// ── Map: route href → feature code ────────────────────────────────────────────
// Used by the Sidebar to check if a nav item is plan-locked.
// Routes NOT in this map are CORE (always available).
export const ROUTE_FEATURE_MAP: Record<string, string> = {
  '/dispatch':       'ops.dispatch',
  '/workshop':        'ops.workshop',
  '/compliance':      'ops.compliance',
  '/staff':           'ops.hr_staff',
  '/rentals':         'biz.rentals',
};

// ── Check if a feature is available for a given plan tier ─────────────────────
const PLAN_HIERARCHY: PlanTier[] = ['FREE', 'STARTER', 'BUSINESS', 'ENTERPRISE', 'CUSTOM'];

export function isFeatureAvailable(featureCode: string, currentPlan: PlanTier | string): boolean {
  const feature = FEATURE_CATALOG[featureCode];
  if (!feature) return true; // unknown feature = allow (fail open)
  const currentIndex = PLAN_HIERARCHY.indexOf(currentPlan as PlanTier);
  const requiredIndex = PLAN_HIERARCHY.indexOf(feature.minPlan);
  if (currentIndex === -1 || requiredIndex === -1) return true; // unknown plan = allow
  return currentIndex >= requiredIndex;
}

// ── Get the feature code for a route (or null if it's a core route) ───────────
export function getRouteFeature(href: string): string | null {
  return ROUTE_FEATURE_MAP[href] ?? null;
}
