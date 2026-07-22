'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { telemetryApi, vehicleApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { formatDate, formatSpeed } from '@/lib/utils';
import { Search, Truck, Lock, AlertTriangle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
// getLiveStatus lives in lib/liveStatus — no Leaflet, safe for SSR
import { getLiveStatus } from '@/lib/liveStatus';
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
            <Lock size={18} className={isLock ? 'text-red-600' : 'text-green-600'} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{isLock ? 'Lock Engine' : 'Unlock Engine'}</h2>
            <p className="text-xs text-gray-500 font-mono">{plate}</p>
          </div>
        </div>
        <div className={cn('flex items-start gap-2 p-3 rounded-xl text-xs',
          isLock ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{isLock ? 'Engine cut immediately. Only lock a stationary vehicle.' : 'Relay released. Confirm it is safe.'}</span>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            Type <span className="font-mono font-bold">{plate}</span> to confirm
          </label>
          <input ref={ref} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && match) onConfirm(); }}
            placeholder={plate}
            className={cn('w-full px-3 py-2 border-2 rounded-lg font-mono text-sm uppercase tracking-widest outline-none transition',
              input.length === 0 ? 'border-gray-300' :
              match ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50')} />
          {input.length > 0 && !match && <p className="text-xs text-red-500">Plate doesn't match</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={!match}
            className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition',
              isLock ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-200'
                     : 'bg-green-600 hover:bg-green-700 disabled:bg-green-200',
              'disabled:cursor-not-allowed')}>
            {isLock ? '🔒 Lock' : '🔓 Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LiveMapPage() {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [lockTarget, setLockTarget] = useState<{id:string; plate:string; action:'lock'|'unlock'} | null>(null);

  // Live location map: vehicleId → LocationData
  const [locations, setLocations] = useState<Record<string, LocationData>>({});
  // Ground truth: which vehicle IDs have an active MQTT connection right now
  const [connectedDevices, setConnectedDevices] = useState<Set<string>>(new Set());

  // Re-render every 5s so status badges refresh automatically
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 5_000);
    return () => clearInterval(t);
  }, []);

  // Initial load from REST API
  const { data: initialLocations } = useQuery({
    queryKey: ['fleet-locations'],
    queryFn:  telemetryApi.getLocations,
    refetchInterval: 30_000,   // refresh every 30s as fallback
  });

  // Seed state from REST response
  useEffect(() => {
    if (!initialLocations) return;
    const map: Record<string, LocationData> = {};
    for (const loc of initialLocations) {
      if (!loc.vehicleId) continue;
      map[loc.vehicleId] = {
        vehicleId:  loc.vehicleId,
        latitude:   loc.latitude  ?? 0,
        longitude:  loc.longitude ?? 0,
        speed:      loc.speed     ?? 0,
        heading:    loc.heading   ?? 0,
        fuelLevel:  loc.fuelLevel,
        engineTemp: loc.engineTemp,
        engineOn:   loc.engineOn  ?? false,
        accuracy:   null,
        updatedAt:  loc.updatedAt,
        vehicle:    loc.vehicle,
      };
    }
    setLocations(prev => ({ ...map, ...prev }));  // keep live updates on top
  }, [initialLocations]);

  // Socket.IO — live GPS updates + device online/offline
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);

    socket.on('connect',    () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));

    // ── Live GPS position — update marker position immediately
    socket.on('location:update', (payload: LocationData) => {
      setLocations(prev => ({
        ...prev,
        [payload.vehicleId]: {
          ...prev[payload.vehicleId],
          ...payload,
          updatedAt: payload.updatedAt ?? new Date().toISOString(),
        },
      }));
    });

    // ── Heartbeat — device is online but may not have GPS fix
    // Updates the updatedAt so status stays ONLINE even when stationary
    socket.on('device:heartbeat', (p: { vehicleId: string; updatedAt: string }) => {
      setLocations(prev => {
        if (!prev[p.vehicleId]) return prev;
        return { ...prev, [p.vehicleId]: { ...prev[p.vehicleId], updatedAt: p.updatedAt } };
      });
    });

    // ── ESP32 connected to MQTT broker — device is ONLINE
    socket.on('gps:online', (p: { vehicleId: string }) => {
      setConnectedDevices(prev => { const s = new Set(prev); s.add(p.vehicleId); return s; });
      // Also refresh updatedAt so status flips to non-OFFLINE
      setLocations(prev => prev[p.vehicleId]
        ? { ...prev, [p.vehicleId]: { ...prev[p.vehicleId], updatedAt: new Date().toISOString() } }
        : prev);
    });

    // ── ESP32 disconnected from MQTT broker — device is OFFLINE
    socket.on('gps:offline', (p: { vehicleId: string }) => {
      setConnectedDevices(prev => {
        const next = new Set(prev);
        next.delete(p.vehicleId);
        return next;
      });
    });

    // ── Backend offline detection (stale vehicles)
    socket.on('vehicles:offline', (p: { vehicleIds: string[] }) => {
      setConnectedDevices(prev => {
        const next = new Set(prev);
        for (const id of p.vehicleIds) next.delete(id);
        return next;
      });
    });

    return () => {
      socket.off('location:update');
      socket.off('device:heartbeat');
      socket.off('gps:online');
      socket.off('gps:offline');
      socket.off('vehicles:offline');
    };
  }, [accessToken]);

  // Lock mutation
  const lockMutation = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) => vehicleApi.lock(id, locked),
    onSuccess: (_, { locked }) => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(locked ? '🔒 Lock command sent to device' : '🔓 Unlock command sent to device');
    },
    onError: () => toast.error('Command failed — check device connection'),
  });

  // ── Compute live status using connectedDevices as ground truth ───────────────
  // GPS status = ACTIVE (moving), IDLE (stationary), OFFLINE (no signal)
  // Engine lock state has NO effect on GPS status
  function getStatus(loc: LocationData): 'ACTIVE' | 'IDLE' | 'OFFLINE' {
    if (connectedDevices.has(loc.vehicleId)) {
      // Device is confirmed online — use speed for ACTIVE vs IDLE
      return (loc.speed ?? 0) > 2 ? 'ACTIVE' : 'IDLE';
    }
    return getLiveStatus(loc.updatedAt, loc.speed);
  }

  // Build sorted, filtered list
  const locationList = Object.values(locations);
  const filtered = locationList.filter(l =>
    !search ||
    l.vehicle?.licensePlate?.toLowerCase().includes(search.toLowerCase()) ||
    l.vehicle?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: ACTIVE → IDLE → OFFLINE
  const statusOrder = { ACTIVE: 0, IDLE: 1, OFFLINE: 2 };
  const sorted = [...filtered].sort((a, b) =>
    (statusOrder[getStatus(a)] ?? 2) - (statusOrder[getStatus(b)] ?? 2)
  );

  const activeCount  = locationList.filter(l => getStatus(l) === 'ACTIVE').length;
  const idleCount    = locationList.filter(l => getStatus(l) === 'IDLE').length;
  const offlineCount = locationList.filter(l => getStatus(l) === 'OFFLINE').length;

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10 shadow-sm">

        {/* Header */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Live Fleet</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="text-green-600 font-semibold">{activeCount} active</span>
                {' · '}{idleCount} idle{' · '}{offlineCount} offline
              </p>
            </div>
            <span className={cn('flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium',
              wsConnected ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-200')}>
              {wsConnected
                ? <><Wifi size={10} /> Live</>
                : <><WifiOff size={10} /> Offline</>}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search plate or name…"
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <Truck size={28} className="mx-auto mb-2 opacity-25" />
              <p className="text-xs font-medium">
                {locationList.length === 0 ? 'No GPS data yet' : 'No results'}
              </p>
              {locationList.length === 0 && (
                <p className="text-xs mt-1 text-gray-400">
                  Connect the ESP32 to see vehicles here
                </p>
              )}
            </div>
          )}

          {sorted.map(loc => {
            const status   = getStatus(loc);
            const isActive = status === 'ACTIVE';
            const isIdle   = status === 'IDLE';
            const hasGps   = !!(loc.latitude && loc.longitude && Math.abs(loc.latitude) > 0.001);
            const isSelected = selectedId === loc.vehicleId;

            const dotColor = isActive ? 'bg-green-500' : isIdle ? 'bg-yellow-400' : 'bg-gray-400';
            const badgeBg  = isActive ? 'bg-green-100 text-green-800' : isIdle ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500';

            return (
              <div
                key={loc.vehicleId}
                onClick={() => setSelectedId(isSelected ? null : loc.vehicleId)}
                className={cn(
                  'px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-blue-50/50 transition-all select-none',
                  isSelected ? 'bg-blue-50 border-l-[3px] border-l-blue-500' : 'border-l-[3px] border-l-transparent'
                )}>
                <div className="flex items-center gap-2.5">

                  {/* Live status dot */}
                  <div className="relative shrink-0">
                    <div className={cn('w-2.5 h-2.5 rounded-full', dotColor)} />
                    {isActive && (
                      <div className={cn('absolute inset-0 rounded-full animate-ping opacity-60', dotColor)} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="font-bold text-xs text-gray-900 font-mono truncate">
                        {loc.vehicle?.licensePlate ?? 'Unknown'}
                      </p>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0', badgeBg)}>
                        {status}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate leading-tight">
                      {loc.vehicle?.name ?? '—'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {hasGps ? (
                        <>
                          <span className="text-[10px] text-blue-600 font-medium">📍 {formatSpeed(loc.speed)}</span>
                          {loc.accuracy && loc.accuracy > 0 && (
                            <span className="text-[9px] text-gray-400">±{loc.accuracy.toFixed(0)}m</span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-400">No GPS fix</span>
                      )}
                    </div>
                    {loc.updatedAt && (
                      <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">
                        {formatDate(loc.updatedAt)}
                      </p>
                    )}
                  </div>

                  {/* Lock button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setLockTarget({
                        id:     loc.vehicleId,
                        plate:  loc.vehicle?.licensePlate ?? '',
                        action: 'lock',
                      });
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
                    title="Lock engine">
                    <Lock size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer stats */}
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{locationList.length} vehicle{locationList.length !== 1 ? 's' : ''} total</span>
            <span className="flex items-center gap-1">
              <RefreshCw size={9} className={wsConnected ? 'animate-spin' : ''} />
              Updates every 15s
            </span>
          </div>
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <LiveMap
          locations={sorted}
          selectedId={selectedId}
          onSelect={setSelectedId}
          connectedDevices={connectedDevices}
        />
      </div>

      {/* Lock confirmation modal */}
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
