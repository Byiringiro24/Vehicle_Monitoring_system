import { getSeverityColor, formatDate } from '@/lib/utils';
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  triggeredAt: string;
  vehicle: { name: string; licensePlate: string };
}

export function AlertFeed({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return (
    <div className="text-center py-8 text-gray-400">
      <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
      <p>No recent alerts</p>
    </div>
  );
  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id} className={cn('flex items-start gap-3 p-3 rounded-lg border', getSeverityColor(alert.severity))}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{alert.title}</p>
            <p className="text-xs opacity-75 truncate">{alert.vehicle.name} · {alert.vehicle.licensePlate}</p>
            <p className="text-xs opacity-60 flex items-center gap-1 mt-0.5">
              <Clock size={10} /> {formatDate(alert.triggeredAt)}
            </p>
          </div>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border capitalize',
            alert.status === 'ACTIVE' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200')}>
            {alert.status.toLowerCase()}
          </span>
        </div>
      ))}
    </div>
  );
}