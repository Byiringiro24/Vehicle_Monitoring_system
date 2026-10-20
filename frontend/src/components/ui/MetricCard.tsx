'use client';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title:       string;
  value:       string | number;
  description?: string;
  icon:        LucideIcon;
  trend?:      number;        // positive = up, negative = down
  iconBg?:     string;        // tailwind bg class e.g. 'bg-blue-50'
  iconColor?:  string;        // tailwind text class e.g. 'text-blue-600'
  onClick?:    () => void;
  loading?:    boolean;
}

export function MetricCard({
  title, value, description, icon: Icon,
  trend, iconBg = 'bg-blue-50', iconColor = 'text-blue-600',
  onClick, loading = false,
}: MetricCardProps) {
  const positive = (trend ?? 0) >= 0;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-36 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="w-11 h-11 bg-gray-200 rounded-xl animate-pulse shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-all duration-200',
        onClick && 'cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-blue-100',
      )}
    >
      {/* Subtle corner accent */}
      <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-blue-500/5 transition-transform duration-500 group-hover:scale-150" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {description && <p className="mt-1 text-xs text-slate-400 truncate">{description}</p>}
        </div>

        <div className={cn(
          'rounded-xl p-2.5 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110 shrink-0',
          iconBg,
        )}>
          <Icon size={22} className={iconColor} />
        </div>
      </div>

      {trend !== undefined && (
        <div className={cn(
          'relative mt-3 flex items-center gap-1 text-xs font-semibold',
          positive ? 'text-emerald-600' : 'text-rose-600',
        )}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend)}% vs last period
        </div>
      )}
    </div>
  );
}
