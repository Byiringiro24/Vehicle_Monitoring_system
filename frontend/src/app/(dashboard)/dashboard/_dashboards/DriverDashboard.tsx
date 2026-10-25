/**
 * DRIVER dashboard
 * Content: Assigned vehicle with live telemetry, license status,
 * quick links to profile and documents.
 * No other vehicles, no finance, no fleet-wide data.
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
  CheckCircle2, AlertTriangle, Wifi, WifiOff, Thermometer, Phone,
} from 'lucide-react';

export default function DriverDashboard() {
  const { user } = useAuthStore();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers-all'],
    queryFn:  () => apiClient.get('/drivers').then(r => r.data),
  });

  const profile = (drivers as any[]).find(
    (d: any) => d.user?.id === user?.id || d.userId === user?.id
  );

  const vehicle = profile?.currentVehicle;

  const { data: vehicleDetail } = useQuery({
    queryKey: ['vehicle-driver-detail', vehicle?.id],
    queryFn:  () => apiClient.get(`/vehicles/${vehicle.id}`).then(r => r.data),
    enabled:  !!vehicle?.id,
  });

  const loc = vehicleDetail?.lastLocation;

  const licenseExpiry = profile?.licenseExpiry;
  const licenseDaysLeft = licenseExpiry
    ? Math.ceil((new Date(licenseExpiry).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="space-y-5 max-w-xl mx-auto lg:mx-0 lg:max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.firstName}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())}</p>
      </div>

      {/* License status banner */}
      {licenseDaysLeft !== null && licenseDaysLeft <= 60 && (
        <div className={cn('flex items-start gap-3 rounded-xl px-4 py-3 border',
          licenseDaysLeft < 0
            ? 'bg-red-50 border-red-200'
            : licenseDaysLeft <= 14
              ? 'bg-amber-50 border-amber-200'
              : 'bg-yellow-50 border-yellow-200')}>
          <AlertTriangle size={16} className={cn('shrink-0 mt-0.5',
            licenseDaysLeft < 0 ? 'text-red-600' : 'text-amber-600')} />
          <div>
            <p className={cn('font-semibold text-sm',
              licenseDaysLeft < 0 ? 'text-red-800' : 'text-amber-800')}>
              {licenseDaysLeft < 0
                ? '⚠ Driving license expired'
                : `License expiring in ${licenseDaysLeft} day${licenseDaysLeft !== 1 ? 's' : ''}`}
            </p>
            <p className={cn('text-xs mt-0.5', licenseDaysLeft < 0 ? 'text-red-600' : 'text-amber-700')}>
              {licenseExpiry ? `Expires: ${formatDate(licenseExpiry)}` : ''}
              {' '}— Contact HR to renew.
            </p>
          </div>
        </div>
      )}

      {/* Assigned vehicle card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <Car size={14} className="text-brand-600" />
          <span className="text-sm font-semibold text-gray-800">Assigned Vehicle</span>
        </div>

        {isLoading ? (
          <div className="animate-pulse p-5 space-y-3">
            <div className="h-12 bg-gray-100 rounded-xl" />
            <div className="grid grid-cols-4 gap-3"><div className="h-16 bg-gray-100 rounded-lg col-span-4" /></div>
          </div>
        ) : vehicle ? (
          <div className="p-5 space-y-4">
            {/* Vehicle identity */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-brand-50 rounded-xl border border-brand-100 flex items-center justify-center shrink-0">
                <Car size={28} className="text-brand-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-gray-900 tracking-wide">{vehicle.licensePlate}</p>
                <p className="text-gray-500 text-sm">{vehicleDetail?.manufacturer ?? ''} {vehicleDetail?.model ?? ''} {vehicleDetail?.year ? `· ${vehicleDetail.year}` : ''}</p>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block',
                  vehicleDetail?.status === 'ACTIVE'       ? 'bg-green-100 text-green-800' :
                  vehicleDetail?.status === 'IDLE'         ? 'bg-yellow-100 text-yellow-800' :
                  vehicleDetail?.status === 'MAINTENANCE'  ? 'bg-orange-100 text-orange-800' :
                                                              'bg-gray-100 text-gray-600')}>
                  {vehicleDetail?.status ?? 'OFFLINE'}
                </span>
              </div>
            </div>

            {/* Live telemetry */}
            {loc ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <Gauge size={16} className="text-brand-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-gray-900">{Math.round(loc.speed ?? 0)}</p>
                  <p className="text-xs text-gray-400">km/h</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <Fuel size={16} className="text-brand-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-gray-900">{loc.fuelLevel != null ? `${Math.round(loc.fuelLevel)}%` : '—'}</p>
                  <p className="text-xs text-gray-400">Fuel</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <Navigation size={16} className="text-brand-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-gray-900">{(loc.distanceTodayKm ?? 0).toFixed(1)}</p>
                  <p className="text-xs text-gray-400">km today</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  {loc.engineOn
                    ? <Wifi size={16} className="text-green-500 mx-auto mb-1" />
                    : <WifiOff size={16} className="text-gray-400 mx-auto mb-1" />}
                  <p className="text-sm font-bold text-gray-900">{loc.engineOn ? 'ON' : 'OFF'}</p>
                  <p className="text-xs text-gray-400">Engine</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm border border-gray-100">
                <WifiOff size={20} className="mx-auto mb-1 opacity-40" />
                No GPS data yet
              </div>
            )}

            {/* Location */}
            {loc?.latitude && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <MapPin size={14} className="text-brand-500 shrink-0" />
                <span className="truncate">{loc.address ?? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`}</span>
                <span className="text-xs text-gray-400 ml-auto whitespace-nowrap shrink-0">
                  {formatDate(loc.updatedAt)}
                </span>
              </div>
            )}

            <Link href={`/vehicles/${vehicle.id}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 border border-brand-200 text-brand-700 rounded-xl text-sm font-medium hover:bg-brand-50 transition">
              View vehicle details →
            </Link>
          </div>
        ) : (
          <div className="p-10 text-center text-gray-400">
            <Car size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-gray-600">No vehicle assigned</p>
            <p className="text-sm mt-1">Contact your fleet manager to get a vehicle assignment.</p>
          </div>
        )}
      </div>

      {/* Driver details */}
      {profile && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><User size={14} className="text-brand-600" /> My Details</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { l: 'License #',  v: profile.licenseNumber },
              { l: 'Class',      v: profile.licenseClass ? `Class ${profile.licenseClass}` : '—' },
              { l: 'Status',     v: profile.status },
              { l: 'Phone',      v: profile.user?.phone ?? user?.phone ?? '—' },
            ].map(({ l, v }) => v && (
              <div key={l} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-400 mb-0.5">{l}</p>
                <p className="font-semibold text-gray-900 text-sm">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/profile"
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3 hover:border-brand-300 hover:shadow-md transition group">
          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0 text-brand-600 group-hover:bg-brand-100 transition">
            <User size={18} />
          </div>
          <div><p className="text-sm font-semibold text-gray-900">My Profile</p><p className="text-xs text-gray-400">Update contact info</p></div>
        </Link>
        <Link href="/documents"
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3 hover:border-brand-300 hover:shadow-md transition group">
          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0 text-brand-600 group-hover:bg-brand-100 transition">
            <FileText size={18} />
          </div>
          <div><p className="text-sm font-semibold text-gray-900">My Documents</p><p className="text-xs text-gray-400">License, ID, certs</p></div>
        </Link>
      </div>
    </div>
  );
}
