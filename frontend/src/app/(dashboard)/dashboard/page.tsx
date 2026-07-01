'use client';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { StatsCard } from '@/components/ui/StatsCard';
import { AlertFeed } from '@/components/alerts/AlertFeed';
import { VehicleStatusChart } from '@/components/charts/VehicleStatusChart';
import { Truck, Bell, Activity, Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.stats,
    refetchInterval: 30000,
  });

  if (isLoading) return <DashboardSkeleton />;

  const t = data?.totals ?? {};
  const onlineRate = t.vehicles
    ? `${Math.round((t.activeVehicles / t.vehicles) * 100)}%`
    : '0%';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Fleet overview — updated {formatDate(new Date())}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Total Vehicles"
          value={t.vehicles ?? 0}
          icon={<Truck />}
          color="blue"
          sub={`${t.activeVehicles ?? 0} active`}
        />
        <StatsCard
          title="Active Alerts"
          value={t.activeAlerts ?? 0}
          icon={<Bell />}
          color="red"
          sub={`${t.alerts ?? 0} total`}
        />
        <StatsCard
          title="Total Fleets"
          value={t.fleets ?? 0}
          icon={<Users />}
          color="green"
        />
        <StatsCard
          title="Online Rate"
          value={onlineRate}
          icon={<Activity />}
          color="purple"
          sub="of fleet active"
        />
      </div>

      {/* Charts + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Vehicle Status</h3>
          <VehicleStatusChart data={data?.vehiclesByStatus ?? {}} />
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Alerts</h3>
          <AlertFeed alerts={data?.recentAlerts ?? []} />
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-gray-200 rounded-xl" />)}
      </div>
    </div>
  );
}
