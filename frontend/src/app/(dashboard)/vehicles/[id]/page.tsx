'use client';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleApi, telemetryApi } from '@/lib/api';
import { apiClient } from '@/lib/api';
import { getStatusColor, formatDate, formatSpeed, formatFuel, formatTemp } from '@/lib/utils';
import { ArrowLeft, Truck, MapPin, Fuel, Thermometer, Gauge, Battery,
  Lock, Unlock, History, BarChart2, Info, Route, Calendar, Copy, Check,
  Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

const TelemetryChart = dynamic(() => import('@/components/charts/TelemetryChart'), { ssr: false });
const GpsHistoryMap  = dynamic(() => import('@/components/maps/GpsHistoryMap'),   {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full bg-gray-100 rounded-xl text-gray-400">Loading map…</div>,
});

type Tab = 'overview' | 'history' | 'trips' | 'telemetry';

// ─── Copy-to-clipboard button ─────────────────────────────────────────────────
function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Device token copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 transition"
      title="Copy to clipboard"
    >
      {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

export default function VehicleDetailPage({ params }: { params: { id: string } }) {
  const qc = useQueryClient();
  const { accessToken } = useAuthStore();
  const [tab, setTab]   = useState<Tab>('overview');
  const [from, setFrom] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [to, setTo]     = useState(format(new Date(), 'yyyy-MM-dd'));

  // Live telemetry overlay (updated via Socket.IO)
  const [liveLoc, setLiveLoc]       = useState<any>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [engineLocked, setEngineLocked] = useState<boolean | null>(null);
  const [wsConnected, setWsConnected]   = useState(false);

  // ── Fetch vehicle ──────────────────────────────────────────────────────────
  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', params.id],
    queryFn:  () => vehicleApi.get(params.id),
  });

  // Sync lock state from DB on load
  useEffect(() => {
    if (vehicle) setEngineLocked(vehicle.engineLocked);
  }, [vehicle]);

  // ── Socket.IO — live telemetry + lock state ────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);

    socket.on('connect', () => {
      setWsConnected(true);
      socket.emit('subscribe:vehicle', params.id);
    });
    socket.on('disconnect', () => setWsConnected(false));

    // Live GPS/telemetry from ESP32
    socket.on('telemetry:update', (payload: any) => {
      if (payload.vehicleId !== params.id) return;
      const d = payload.data;
      setLiveLoc({
        latitude:        d.latitude,
        longitude:       d.longitude,
        speed:           d.speed,
        heading:         d.heading,
        engineOn:        d.engineOn,
        fuelLevel:       d.fuelLevel,
        engineTemp:      d.engineTemp,
        distanceTodayKm: vehicle?.lastLocation?.distanceTodayKm ?? 0,
        updatedAt:       payload.timestamp,
      });
      setLiveStatus(d.engineOn
        ? (d.speed > 2 ? 'ACTIVE' : 'IDLE')
        : 'OFFLINE');
    });

    // Lock/unlock confirmation from backend
    socket.on('vehicle:lock', (payload: any) => {
      if (payload.vehicleId !== params.id) return;
      setEngineLocked(payload.locked);
      // Invalidate so DB state is refreshed
      qc.invalidateQueries({ queryKey: ['vehicle', params.id] });
    });

    return () => {
      socket.off('telemetry:update');
      socket.off('vehicle:lock');
      socket.emit('unsubscribe:vehicle', params.id);
    };
  }, [accessToken, params.id, vehicle, qc]);

  // ── Telemetry history ──────────────────────────────────────────────────────
  const { data: telemetry } = useQuery({
    queryKey: ['telemetry', params.id],
    queryFn:  () => telemetryApi.getHistory(params.id, { limit: 200 }),
    refetchInterval: 15000,
    enabled: tab === 'telemetry',
  });

  const { data: gpsHistory, isLoading: gpsLoading } = useQuery({
    queryKey: ['gps-history', params.id, from, to],
    queryFn:  () => apiClient.get(`/vehicles/${params.id}/gps-history`, {
      params: { from: new Date(from).toISOString(), to: new Date(to + 'T23:59:59').toISOString(), limit: 3000 }
    }).then(r => r.data),
    enabled: tab === 'history',
  });

  const { data: trips } = useQuery({
    queryKey: ['trips', params.id, from, to],
    queryFn:  () => apiClient.get(`/vehicles/${params.id}/trips`, {
      params: { from: new Date(from).toISOString(), to: new Date(to + 'T23:59:59').toISOString() }
    }).then(r => r.data),
    enabled: tab === 'trips',
  });

  // ── Lock / Unlock ──────────────────────────────────────────────────────────
  const lockMutation = useMutation({
    mutationFn: (locked: boolean) => vehicleApi.lock(params.id, locked),
    onMutate: (locked) => {
      // Optimistic UI — flip immediately so user sees instant feedback
      setEngineLocked(locked);
    },
    onSuccess: (_, locked) => {
      qc.invalidateQueries({ queryKey: ['vehicle', params.id] });
      toast.success(locked ? '🔒 Lock command sent to vehicle' : '🔓 Unlock command sent to vehicle');
    },
    onError: (_, locked) => {
      // Revert optimistic update on error
      setEngineLocked(!locked);
      toast.error('Command failed — check server connection');
    },
  });

  // ── Loading / not found ────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-64" />
      <div className="h-64 bg-gray-200 rounded-xl" />
    </div>
  );
  if (!vehicle) return <div className="text-center py-16 text-gray-400">Vehicle not found</div>;

  // Use live data if available, otherwise fall back to DB last location
  const loc    = liveLoc ?? vehicle.lastLocation;
  const locked = engineLocked ?? vehicle.engineLocked;
  const status = liveStatus  ?? vehicle.status;

  const TABS = [
    { id: 'overview'  as Tab, label: 'Overview',    icon: <Info size={14} /> },
    { id: 'history'   as Tab, label: 'GPS History', icon: <Route size={14} /> },
    { id: 'trips'     as Tab, label: 'Trips',       icon: <History size={14} /> },
    { id: 'telemetry' as Tab, label: 'Telemetry',   icon: <BarChart2 size={14} /> },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/vehicles" className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500">
          <ArrowLeft size={20} />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{vehicle.licensePlate}</h1>
            <span className={cn('px-3 py-1 rounded-full text-sm font-medium', getStatusColor(status))}>
              {status}
            </span>
            {/* WebSocket connection indicator */}
            <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
              wsConnected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
              {wsConnected
                ? <><Wifi size={10} /> Live</>
                : <><WifiOff size={10} /> Offline</>}
            </span>
            {liveLoc && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full animate-pulse">
                ● GPS active
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm truncate">
            {vehicle.name} — {vehicle.manufacturer} {vehicle.model} {vehicle.year}
          </p>
        </div>

        {/* Lock / Unlock button */}
        <button
          onClick={() => lockMutation.mutate(!locked)}
          disabled={lockMutation.isPending}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition shadow-sm',
            locked
              ? 'bg-red-50 border-red-400 text-red-700 hover:bg-red-100 active:scale-95'
              : 'bg-green-50 border-green-400 text-green-700 hover:bg-green-100 active:scale-95',
            lockMutation.isPending && 'opacity-60 cursor-not-allowed'
          )}>
          {lockMutation.isPending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Sending…
            </span>
          ) : locked ? (
            <><Lock size={16} /> ENGINE LOCKED</>
          ) : (
            <><Unlock size={16} /> ENGINE UNLOCKED</>
          )}
        </button>
      </div>

      {/* ── Live telemetry cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Speed',       value: formatSpeed(loc?.speed),    icon: <Gauge size={18} />,       color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Fuel',        value: formatFuel(loc?.fuelLevel),  icon: <Fuel size={18} />,        color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Engine Temp', value: formatTemp(loc?.engineTemp), icon: <Thermometer size={18} />, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Engine',      value: loc?.engineOn ? 'ON' : 'OFF',
            icon: <Truck size={18} />,
            color: loc?.engineOn ? 'text-green-600' : 'text-gray-500',
            bg:    loc?.engineOn ? 'bg-green-50' : 'bg-gray-50' },
          { label: 'Today km',    value: `${(loc?.distanceTodayKm ?? 0).toFixed(1)} km`,
            icon: <Route size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Relay',       value: locked ? 'LOCKED' : 'OPEN',
            icon: locked ? <Lock size={18} /> : <Unlock size={18} />,
            color: locked ? 'text-red-600' : 'text-green-600',
            bg:    locked ? 'bg-red-50'    : 'bg-green-50' },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center text-center shadow-sm">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-2', bg, color)}>{icon}</div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition',
              tab === t.id ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Date range picker ── */}
      {(tab === 'history' || tab === 'trips') && (
        <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-3 shadow-sm w-fit flex-wrap">
          <Calendar size={16} className="text-gray-400" />
          {[['From', from, setFrom], ['To', to, setTo]].map(([label, val, setter]: any) => (
            <div key={label} className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">{label}</label>
              <input type="date" value={val} onChange={e => setter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          ))}
        </div>
      )}

      {/* ── OVERVIEW tab ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Vehicle Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Vehicle Details</h3>
            <dl className="space-y-2 text-sm">
              {[
                ['Plate',         vehicle.licensePlate],
                ['VIN',           vehicle.vin ?? 'N/A'],
                ['Class',         vehicle.vehicleClass?.replace(/_/g,' ')],
                ['Energy',        vehicle.energyType],
                ['Fuel Capacity', vehicle.fuelCapacity ? `${vehicle.fuelCapacity} L` : 'N/A'],
                ['Battery kWh',   vehicle.batteryCapacityKwh ?? 'N/A'],
                ['Fleet',         vehicle.fleet?.name ?? 'Unassigned'],
                ['Driver',        vehicle.currentDriver?.user
                  ? `${vehicle.currentDriver.user.firstName} ${vehicle.currentDriver.user.lastName}`
                  : 'Unassigned'],
                ['Registered',    vehicle.createdAt ? formatDate(vehicle.createdAt) : 'N/A'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-gray-500 font-medium shrink-0">{k}</dt>
                  <dd className="text-gray-900 font-mono text-right truncate max-w-48">{v}</dd>
                </div>
              ))}

              {/* Device Token — full value with copy button */}
              <div className="flex justify-between gap-4 items-start pt-1 border-t border-gray-100 mt-1">
                <dt className="text-gray-500 font-medium shrink-0">Device Token</dt>
                <dd className="flex items-center gap-1 min-w-0">
                  <span className="text-gray-900 font-mono text-xs truncate max-w-40 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded" title={vehicle.deviceToken}>
                    {vehicle.deviceToken}
                  </span>
                  <CopyButton text={vehicle.deviceToken} />
                </dd>
              </div>
            </dl>
          </div>

          {/* Compliance & Location */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Compliance & Location</h3>
            <dl className="space-y-2 text-sm">
              {[
                ['Insurance Expiry',    vehicle.insuranceExpiry  ? formatDate(vehicle.insuranceExpiry)  : 'Not set'],
                ['Road Tax Expiry',     vehicle.roadTaxExpiry    ? formatDate(vehicle.roadTaxExpiry)    : 'Not set'],
                ['Inspection Expiry',   vehicle.inspectionExpiry ? formatDate(vehicle.inspectionExpiry) : 'Not set'],
                ['Distance Today',      `${(loc?.distanceTodayKm ?? 0).toFixed(1)} km`],
                ['Distance This Month', `${(loc?.distanceMonthKm ?? 0).toFixed(1)} km`],
                ['Total Distance',      `${(loc?.totalDistanceKm ?? 0).toFixed(0)} km`],
                ['Latitude',            loc?.latitude  != null ? loc.latitude.toFixed(6)  : 'No GPS'],
                ['Longitude',           loc?.longitude != null ? loc.longitude.toFixed(6) : 'No GPS'],
                ['Speed',               loc?.speed     != null ? `${loc.speed.toFixed(1)} km/h` : '—'],
                ['Engine',              loc?.engineOn  ? 'ON' : 'OFF'],
                ['Last Updated',        loc?.updatedAt ? formatDate(loc.updatedAt) : 'Never'],
                ['Telemetry Records',   vehicle._count?.telemetry ?? 0],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-gray-500 font-medium shrink-0">{k}</dt>
                  <dd className="text-gray-900 text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* ── GPS HISTORY tab ── */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" style={{ height: '520px' }}>
          {gpsLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <MapPin size={32} className="mx-auto mb-2 animate-pulse" />
                <p>Loading GPS history…</p>
              </div>
            </div>
          ) : (gpsHistory?.points?.length ?? 0) === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <MapPin size={32} className="mx-auto mb-2" />
                <p className="font-medium">No GPS data for this period</p>
                <p className="text-sm mt-1">GPS points appear once the ESP32 starts sending telemetry</p>
              </div>
            </div>
          ) : (
            <GpsHistoryMap
              points={gpsHistory.points}
              vehiclePlate={vehicle.licensePlate}
              vehicleName={vehicle.name}
            />
          )}
        </div>
      )}

      {/* ── TRIPS tab ── */}
      {tab === 'trips' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>{['Start','End','From','To','Distance','Max Speed','Engine Hrs'].map(h =>
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(trips?.data ?? []).map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs">{formatDate(t.startTime)}</td>
                  <td className="px-4 py-2 text-xs">{t.endTime ? formatDate(t.endTime) : '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-32 truncate">
                    {t.startAddress ?? `${t.startLat?.toFixed(4)}, ${t.startLon?.toFixed(4)}`}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-32 truncate">
                    {t.endAddress ?? `${t.endLat?.toFixed(4)}, ${t.endLon?.toFixed(4)}`}
                  </td>
                  <td className="px-4 py-2 text-sm font-bold">{t.distanceKm.toFixed(1)} km</td>
                  <td className="px-4 py-2 text-sm text-red-600">{t.maxSpeedKph.toFixed(0)} km/h</td>
                  <td className="px-4 py-2 text-sm">{t.engineHours.toFixed(2)} h</td>
                </tr>
              ))}
              {!(trips?.data?.length) && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    No trips recorded for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TELEMETRY chart tab ── */}
      {tab === 'telemetry' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Speed / Fuel / Temperature (last 200 records)</h3>
          <TelemetryChart data={telemetry?.data ?? []} />
        </div>
      )}

    </div>
  );
}
