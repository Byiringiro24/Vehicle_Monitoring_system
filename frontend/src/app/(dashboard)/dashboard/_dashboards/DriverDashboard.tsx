/**
 * DRIVER dashboard
 * Visual identity: purple/violet — personal, task-focused.
 * Shows own vehicle assignment, today's trip, recent alerts for their vehicle,
 * and quick links to their profile and documents.
 * No fleet-wide data, no finance, no other drivers visible.
 */
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Car, MapPin, Gauge, Fuel, Navigation, User, FileText,
  CheckCircle2, Clock, AlertTriangle, Wifi, WifiOff,
} from 'lucide-react';

export default function DriverDashboard() {
  const { user } = useAuthStore();

  // Fetch driver profile (links back to user)
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-me'],
    queryFn: () => apiClient.get('/drivers').then(r => {
      const drivers = r.data;
      return drivers.find((d: any) => d.user?.id === user?.id || d.userId === user?.id) ?? null;
    }),
  });

  const vehicle = driverProfile?.currentVehicle;

  // Fetch last location for their vehicle
  const { data: vehicleDetail } = useQuery({
    queryKey: ['vehicle-driver', vehicle?.id],
    queryFn:  () => apiClient.get(`/vehicles/${vehicle.id}`).then(r => r.data),
    enabled:  !!vehicle?.id,
  });

  const loc = vehicleDetail?.lastLocation;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Violet header */}
      <div className="bg-gradient-to-r from-violet-900 to-purple-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold">Good day, {user?.firstName}!</h1>
            <p className="text-purple-200 text-sm">{formatDate(new Date())}</p>
          </div>
        </div>

        {driverProfile && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div><p className="text-purple-300 text-xs">Status</p><p className="font-semibold">{driverProfile.status ?? 'ACTIVE'}</p></div>
            <div><p className="text-purple-300 text-xs">License</p><p className="font-semibold text-sm font-mono">{driverProfile.licenseNumber?.slice(0, 10) ?? '—'}</p></div>
            <div><p className="text-purple-300 text-xs">Expires</p><p className={cn('font-semibold text-sm', driverProfile.licenseExpiry && new Date(driverProfile.licenseExpiry) < new Date() ? 'text-red-300' : '')}>{driverProfile.licenseExpiry ? formatDate(driverProfile.licenseExpiry) : '—'}</p></div>
          </div>
        )}
      </div>

      {/* Assigned vehicle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Car size={16} className="text-purple-600" /> Assigned Vehicle
        </h2>
        {vehicle ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                <Car size={26} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{vehicle.licensePlate}</p>
                <p className="text-gray-500 text-sm">{vehicle.manufacturer ?? vehicleDetail?.manufacturer} {vehicle.model ?? vehicleDetail?.model} · {vehicleDetail?.year}</p>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 inline-block',
                  vehicleDetail?.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  vehicleDetail?.status === 'IDLE'   ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-600')}>
                  {vehicleDetail?.status ?? 'OFFLINE'}
                </span>
              </div>
            </div>

            {/* Live telemetry */}
            {loc && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Gauge size={16} className="text-purple-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{Math.round(loc.speed ?? 0)}</p>
                  <p className="text-xs text-gray-400">km/h</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Fuel size={16} className="text-purple-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{loc.fuelLevel != null ? `${Math.round(loc.fuelLevel)}%` : '—'}</p>
                  <p className="text-xs text-gray-400">Fuel</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Navigation size={16} className="text-purple-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{loc.distanceTodayKm?.toFixed(1) ?? '0'}</p>
                  <p className="text-xs text-gray-400">km today</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  {loc.engineOn
                    ? <Wifi size={16} className="text-green-500 mx-auto mb-1" />
                    : <WifiOff size={16} className="text-gray-400 mx-auto mb-1" />}
                  <p className="text-sm font-bold text-gray-900">{loc.engineOn ? 'ON' : 'OFF'}</p>
                  <p className="text-xs text-gray-400">Engine</p>
                </div>
              </div>
            )}

            {loc?.latitude && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                <MapPin size={14} className="text-purple-500 shrink-0" />
                <span>{loc.address ?? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`}</span>
                <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">Updated {formatDate(loc.updatedAt)}</span>
              </div>
            )}

            <Link href={`/vehicles/${vehicle.id}`} className="flex items-center justify-center gap-2 w-full py-2 border border-purple-200 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 transition">
              View vehicle details →
            </Link>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Car size={36} className="mx-auto mb-2 opacity-20" />
            <p className="font-medium text-gray-600">No vehicle assigned</p>
            <p className="text-sm mt-1">Contact your fleet manager to get a vehicle assignment.</p>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/profile"
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3 hover:border-purple-300 hover:shadow-md transition">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
            <User size={18} className="text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">My Profile</p>
            <p className="text-xs text-gray-400">Update your info</p>
          </div>
        </Link>
        <Link href="/documents"
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3 hover:border-purple-300 hover:shadow-md transition">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
            <FileText size={18} className="text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">My Documents</p>
            <p className="text-xs text-gray-400">License, ID, certs</p>
          </div>
        </Link>
      </div>

      {/* License expiry warning */}
      {driverProfile?.licenseExpiry && (() => {
        const days = Math.ceil((new Date(driverProfile.licenseExpiry).getTime() - Date.now()) / 86400000);
        if (days > 60) return null;
        return (
          <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3 border text-sm', days < 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800')}>
            <AlertTriangle size={16} className="shrink-0" />
            <div>
              <p className="font-semibold">
                {days < 0 ? 'License expired' : `License expiring in ${days} days`}
              </p>
              <p className="text-xs opacity-75">
                {days < 0 ? 'Your driving license has expired. Contact HR immediately.' : `Expires on ${formatDate(driverProfile.licenseExpiry)}. Please renew soon.`}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
