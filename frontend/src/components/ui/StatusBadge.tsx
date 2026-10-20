'use client';

export type BadgeStatus =
  | 'Online' | 'Moving' | 'Idle' | 'Offline' | 'In Transit'
  | 'Maintenance' | 'Verified' | 'Pending Review' | 'Expired'
  | 'Paid' | 'Unpaid' | 'Overdue' | 'Active' | 'Suspended'
  | 'Critical' | 'High' | 'Medium' | 'Low';

const STYLES: Record<BadgeStatus, string> = {
  Online:         'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Moving:         'bg-blue-50 text-blue-700 ring-blue-600/20',
  Idle:           'bg-amber-50 text-amber-700 ring-amber-600/20',
  Offline:        'bg-slate-100 text-slate-600 ring-slate-500/20',
  'In Transit':   'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  Maintenance:    'bg-orange-50 text-orange-700 ring-orange-600/20',
  Verified:       'bg-green-50 text-green-700 ring-green-600/20',
  'Pending Review': 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
  Expired:        'bg-red-50 text-red-700 ring-red-600/20',
  Paid:           'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Unpaid:         'bg-slate-100 text-slate-700 ring-slate-500/20',
  Overdue:        'bg-rose-50 text-rose-700 ring-rose-600/20',
  Active:         'bg-blue-50 text-blue-700 ring-blue-600/20',
  Suspended:      'bg-red-100 text-red-800 ring-red-600/20',
  Critical:       'bg-red-100 text-red-800 ring-red-600/20',
  High:           'bg-orange-100 text-orange-800 ring-orange-600/20',
  Medium:         'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
  Low:            'bg-blue-100 text-blue-800 ring-blue-600/20',
};

export function StatusBadge({
  status,
  pulse = false,
  className = '',
}: {
  status: BadgeStatus;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5
        text-xs font-semibold ring-1 ring-inset ${STYLES[status] ?? 'bg-gray-100 text-gray-700 ring-gray-500/20'} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {status}
    </span>
  );
}
