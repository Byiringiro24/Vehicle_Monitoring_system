import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'green' | 'purple' | 'yellow';
  sub?: string;
  trend?: { value: number; label: string };
}

const colorMap = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-500',   text: 'text-blue-600' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-500',    text: 'text-red-600' },
  green:  { bg: 'bg-green-50',  icon: 'bg-green-500',  text: 'text-green-600' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-600' },
  yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-500', text: 'text-yellow-600' },
};

export function StatsCard({ title, value, icon, color, sub }: StatsCardProps) {
  const c = colorMap[color];
  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4')}>
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0', c.icon)}>
        <span className="[&>svg]:w-6 [&>svg]:h-6">{icon}</span>
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className={cn('text-xs mt-0.5', c.text)}>{sub}</p>}
      </div>
    </div>
  );
}