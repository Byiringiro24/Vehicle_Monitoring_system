'use client';
import { useQuery } from '@tanstack/react-query';
import { vehicleApi, telemetryApi } from '@/lib/api';
import { getStatusColor, formatDate, formatSpeed, formatFuel, formatTemp } from '@/lib/utils';
import { ArrowLeft, Truck, MapPin, Fuel, Thermometer, Gauge, Battery } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const TelemetryChart = dynamic(() => import('@/components/charts/TelemetryChart'), { ssr: false });

export default function VehicleDetailPage({ params }: { params: { id: string } }) {
  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', params.id],
    queryFn: () => vehicleApi.get(params.id),
  });
  const { data: telemetry } = useQuery({
    queryKey: ['telemetry', params.id],
    queryFn: () => telemetryApi.getHistory(params.id, { limit: 200 }),
    refetchInterval: 15000,
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-64" /><div className="h-64 bg-gray-200 rounded-xl" /></div>;
  if (!vehicle) return <div>Vehicle not found</div>;

  const loc = vehicle.lastLocation;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/vehicles" className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{vehicle.name}</h1>
          <p className="text-gray-500 text-sm">{vehicle.make} {vehicle.model} {vehicle.year} · {vehicle.licensePlate}</p>
        </div>
        <span className={cn('px-3 py-1 rounded-full text-sm font-medium', getStatusColor(vehicle.status))}>
          {vehicle.status}
        </span>
      </div>

      {/* Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Speed', value: formatSpeed(loc?.speed), icon: <Gauge size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Fuel', value: formatFuel(loc?.fuelLevel), icon: <Fuel size={18} />, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Engine Temp', value: formatTemp(loc?.engineTemp), icon: <Thermometer size={18} />, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Engine', value: loc?.engineOn ? 'ON' : 'OFF', icon: <Truck size={18} />, color: loc?.engineOn ? 'text-green-600' : 'text-gray-500', bg: loc?.engineOn ? 'bg-green-50' : 'bg-gray-50' },
          { label: 'Heading', value: loc?.heading ? ${Math.round(loc.heading)}° : 'N/A', icon: <MapPin size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Alerts', value: vehicle._count?.alerts ?? 0, icon: <Battery size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center text-center shadow-sm">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-2', bg, color)}>{icon}</div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Speed Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Speed History (last 200 records)</h3>
        <TelemetryChart data={telemetry?.data ?? []} />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Vehicle Details</h3>
          <dl className="space-y-2 text-sm">
            {[
              ['VIN', vehicle.vin || 'N/A'],
              ['Fuel Capacity', ${vehicle.fuelCapacity} L],
              ['Fleet', vehicle.fleet?.name ?? 'Unassigned'],
              ['Driver', vehicle.driver?.user ? ${vehicle.driver.user.firstName}  : 'Unassigned'],
              ['Device Token', vehicle.deviceToken?.slice(0, 16) + '...'],
              ['Registered', formatDate(vehicle.createdAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-gray-500 font-medium">{k}</dt>
                <dd className="text-gray-900 font-mono text-right truncate max-w-48">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Last Known Location</h3>
          {loc ? (
            <dl className="space-y-2 text-sm">
              {[
                ['Latitude', loc.latitude?.toFixed(6)],
                ['Longitude', loc.longitude?.toFixed(6)],
                ['Updated', formatDate(loc.updatedAt)],
                ['Telemetry Records', vehicle._count?.telemetry ?? 0],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-500 font-medium">{k}</dt>
                  <dd className="text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="text-gray-400 text-sm">No location data yet</p>}
        </div>
      </div>
    </div>
  );
}