'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { telemetryApi, vehicleApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { formatDate, formatSpeed } from '@/lib/utils';
import { Search, Truck, Lock, Unlock, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import type { LocationData } from '@/components/maps/LiveMap';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading map…</p>
      </div>
    </div>
  ),
});

// Active = telemetry within last 2 minutes
function isActive(updatedAt?: string) {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < 2 * 60 * 1000;
}

function statusColor(loc: LocationData) {
  if (!isActive(loc.updatedAt)) return 'bg-gray-400';
  return loc.engineOn ? 'bg-green-500' : 'bg-yellow-400';
}

function statusLabel(loc: LocationData) {
  if (!isActive(loc.updatedAt)) return 'OFFLINE';
  return loc.engineOn ? 'ACTIVE' : 'IDLE';
}

// ─── Plate confirmation modal ─────────────────────────────────────────────────
function LockModal({ plate, action, onConfirm, onCancel }:
  { plate: string; action: 'lock'|'unlock'; onConfirm:()=>void; onCancel:()=>void }) {
  const [input, setInput] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const isLock = action === 'lock';
  const match  = input.trim().toUpperCase() === plate.toUpperCase();
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', isLock ? 'bg-red-100' : 'bg-green-100')}>
            {isLock ? <Lock size={20} className="text-red-600" /> : <Unlock size={20} className="text-green-600" />}
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{isLock ? 'Lock Engine' : 'Unlock Engine'}</h2>
            <p className="text-xs text-gray-500">{plate}</p>
          </div>
        </div>
        <div className={cn('flex items-start gap-2 p-3 rounded-xl text-xs', isLock ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{isLock ? 'Engine will be cut immediately. Only lock a stationary vehicle.' : 'Relay will be released. Confirm it is safe.'}</span>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Type <span className="font-mono font-bold">{plate}</span> to confirm</label>
          <input ref={ref} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && match) onConfirm(); }}
            placeholder={plate}
            className={cn('w-full px-3 py-2 border-2 rounded-lg font-mono text-sm uppercase tracking-widest outline-none transition',
              input.length === 0 ? 'border-gray-300' : match ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50')} />
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} disabled={!match}
            className={cn('flex-1 py-2 rounded-lg text-sm font-bold text-white',
              isLock ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-200' : 'bg-green-600 hover:bg-green-700 disabled:bg-green-200',
              'disabled:cursor-not-allowed')}>
            {isLock ? '🔒 Lock' : '🔓 Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main live map page ───────────────────────────────────────────────────────
export default function LiveMapPage() {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [wsConnected, setWsConnected] = useState(false);

  // Lock modal state
  const [lockTarget, setLockTarget] = useState<{id: string; plate: string; action: 'lock'|'unlock'} | null>(null);

  // locations map: vehicleId → LocationData (live, updated via socket)
  const [locations, setLocations] = useState<Record<string, LocationData>>({});

  // Initial load from REST API
  const { data: initialLocations } = useQuery({
    queryKey: ['fleet-locations'],
    queryFn:  telemetryApi.getLocations,
    refetchInterval: 60000,  // fallback refresh every 60s
  });

  // Seed locations from initial API response
  useEffect(() => {
    if (!initialLocations) return;
    const map: Record<string, LocationData> = {};
    for (const loc of initialLocations) {
      if (!loc.vehicleId) continue;
      map[loc.vehicleId] = {
        vehicleId:  loc.vehicleId,
        latitude:   loc.latitude,
        longitude:  loc.longitude,
        speed:      loc.speed ?? 0,
        heading:    loc.heading ?? 0,
        fuelLevel:  loc.fuelLevel,
        engineTemp: loc.engineTemp,
        engineOn:   loc.engineOn ?? false,
        updatedAt:  loc.updatedAt,
        vehicle:    loc.vehicle,
      };
    }
    setLocations(map);
  }, [initialLocations]);

  // Socket.IO — update locations in real-time
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);

    socket.on('connect',    () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));

    // New GPS position from ESP32
    socket.on('location:update', (payload: LocationData) => {
      setLocations(prev => ({
        ...prev,
        [payload.vehicleId]: payload,
      }));
    });

    // Vehicle went offline (backend offline detection job)
    socket.on('vehicles:offline', (payload: { vehicleIds: string[] }) => {
      setLocations(prev => {
        const next = { ...prev };
        for (const id of payload.vehicleIds) {
          if (next[id]) {
            next[id] = { ...next[id], engineOn: false };
          }
        }
        return next;
      });
    });

    return () => {
      socket.off('location:update');
      socket.off('vehicles:offline');
    };
  }, [accessToken]);

  // Lock/unlock
  const lockMutation = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) => vehicleApi.lock(id, locked),
    onSuccess: (_, { locked }) => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(locked ? '🔒 Lock command sent' : '🔓 Unlock command sent');
    },
    onError: () => toast.error('Command failed'),
  });

  const locationList = Object.values(locations);
  const filtered = locationList.filter(l =>
    !search || l.vehicle?.licensePlate?.toLowerCase().includes(search.toLowerCase()) ||
    l.vehicle?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: active first, then idle, then offline
  const sorted = [...filtered].sort((a, b) => {
    const order = (l: LocationData) => isActive(l.updatedAt) ? (l.engineOn ? 0 : 1) : 2;
    return order(a) - order(b);
  });

  const activeCount = locationList.filter(l => isActive(l.updatedAt) && l.engineOn).length;

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10">

        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Live Fleet</h2>
              <p className="text-xs text-gray-500">{activeCount} active · {locationList.length} total</p>
            </div>
            <span className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-full',
              wsConnected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
              {wsConnected ? <><Wifi size={10} />Live</> : <><WifiOff size={10} />Offline</>}
            </span>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search plate or name…"
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 && (
            <div className="p-6 text-center text-gray-400">
              <Truck size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">
                {locationList.length === 0 ? 'No GPS data received yet' : 'No vehicles match'}
              </p>
            </div>
          )}
          {sorted.map(loc => {
            const active = isActive(loc.updatedAt);
            const isSelected = selectedId === loc.vehicleId;
            const hasGps = !!(loc.latitude && loc.longitude);

            return (
              <div
                key={loc.vehicleId}
                onClick={() => { setSelectedId(loc.vehicleId); }}
                className={cn(
                  'px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-blue-50 transition',
                  isSelected && 'bg-blue-50 border-l-2 border-l-blue-500'
                )}>
                <div className="flex items-center gap-2.5">
                  {/* Status dot */}
                  <div className="relative shrink-0">
                    <div className={cn('w-2.5 h-2.5 rounded-full', statusColor(loc))} />
                    {active && loc.engineOn && (
                      <div className={cn('absolute inset-0 rounded-full animate-ping', statusColor(loc), 'opacity-50')} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-xs text-gray-900 font-mono truncate">
                        {loc.vehicle?.licensePlate ?? 'Unknown'}
                      </p>
                      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0',
                        active && loc.engineOn ? 'bg-green-100 text-green-800' :
                        active ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-500')}>
                        {statusLabel(loc)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{loc.vehicle?.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {hasGps
                        ? <p className="text-[10px] text-blue-600">📍 {formatSpeed(loc.speed)}</p>
                        : <p className="text-[10px] text-gray-400">No GPS fix</p>}
                      {loc.updatedAt && (
                        <p className="text-[9px] text-gray-400 truncate">{formatDate(loc.updatedAt)}</p>
                      )}
                    </div>
                  </div>

                  {/* Lock/unlock mini button — shows correct state */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setLockTarget({
                        id:     loc.vehicleId,
                        plate:  loc.vehicle?.licensePlate ?? '',
                        action: 'lock',   // always shows lock — full toggle is on vehicle detail page
                      });
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
                    title="Lock engine (go to vehicle detail for unlock)">
                    <Lock size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <LiveMap
          locations={sorted}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Lock modal */}
      {lockTarget && (
        <LockModal
          plate={lockTarget.plate}
          action={lockTarget.action}
          onConfirm={() => {
            lockMutation.mutate({ id: lockTarget.id, locked: lockTarget.action === 'lock' });
            setLockTarget(null);
          }}
          onCancel={() => setLockTarget(null)}
        />
      )}
    </div>
  );
}
