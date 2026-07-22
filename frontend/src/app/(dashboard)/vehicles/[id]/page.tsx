'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleApi, telemetryApi } from '@/lib/api';
import { getStatusColor, formatDate, formatSpeed, formatFuel, formatTemp } from '@/lib/utils';
import {
  ArrowLeft, Truck, MapPin, Fuel, Thermometer, Gauge,
  Lock, Unlock, History, BarChart2, Info, Route, Calendar, Copy, Check,
  Wifi, WifiOff, AlertTriangle, RefreshCw, Satellite, Terminal,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { deviceApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

const TelemetryChart = dynamic(() => import('@/components/charts/TelemetryChart'), { ssr: false });
const GpsHistoryMap  = dynamic(() => import('@/components/maps/GpsHistoryMap'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full bg-gray-100 rounded-xl text-gray-400">Loading map…</div>,
});

type Tab = 'overview' | 'history' | 'trips' | 'telemetry' | 'commands';

// ─── Relative time helper ─────────────────────────────────────────────────────
function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return 'Never';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 5)   return 'Just now';
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Copy-to-clipboard button ─────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const done = () => { setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2500); };
  const handle = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else { fallback(); }
  };
  const fallback = () => {
    const el = document.createElement('textarea');
    el.value = text; el.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(el); el.focus(); el.select();
    try { document.execCommand('copy'); done(); } catch { toast.error('Copy failed'); }
    document.body.removeChild(el);
  };
  return (
    <button onClick={handle}
      className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-700 border border-gray-300 transition shrink-0">
      {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ─── Engine lock confirmation modal ───────────────────────────────────────────
function LockConfirmModal({ plate, action, onConfirm, onCancel }:
  { plate: string; action: 'lock'|'unlock'; onConfirm:()=>void; onCancel:()=>void }) {
  const [input, setInput] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const isLock = action === 'lock';
  const match  = input.trim().toUpperCase() === plate.toUpperCase();
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', isLock ? 'bg-red-100' : 'bg-green-100')}>
            {isLock ? <Lock size={22} className="text-red-600" /> : <Unlock size={22} className="text-green-600" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isLock ? 'Lock Engine' : 'Unlock Engine'}</h2>
            <p className="text-sm text-gray-500">{isLock ? 'Cuts the ignition relay immediately' : 'Restores the ignition relay'}</p>
          </div>
        </div>
        <div className={cn('flex items-start gap-2 p-3 rounded-xl text-sm', isLock ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{isLock ? 'Engine will be cut immediately. Only lock a stationary vehicle.' : 'Ignition relay will be released. Confirm it is safe.'}</span>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            Type plate <span className="font-mono font-bold">{plate}</span> to confirm
          </label>
          <input ref={ref} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && match) onConfirm(); }}
            placeholder={plate}
            className={cn('w-full px-4 py-2.5 border-2 rounded-xl font-mono text-sm uppercase tracking-widest outline-none transition',
              input.length === 0 ? 'border-gray-300 focus:border-blue-400'
              : match ? 'border-green-400 bg-green-50 text-green-800'
              : 'border-red-300 bg-red-50 text-red-700')} />
          {input.length > 0 && !match && <p className="text-xs text-red-500">Plate doesn't match</p>}
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={onConfirm} disabled={!match}
            className={cn('flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition',
              isLock ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-200' : 'bg-green-600 hover:bg-green-700 disabled:bg-green-200',
              'disabled:cursor-not-allowed')}>
            {isLock ? '🔒 Confirm Lock' : '🔓 Confirm Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GPS Ping Status badge ────────────────────────────────────────────────────
function GpsPingBadge({ vehicleId }: { vehicleId: string }) {
  const [pinging, setPinging]   = useState(false);
  const [result, setResult]     = useState<boolean | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  async function doPing() {
    setPinging(true);
    setResult(null);
    try {
      const data = await vehicleApi.gpsPing(vehicleId);
      setResult(data.gpsOnline);
      setCheckedAt(data.checkedAt);
      if (data.gpsOnline) {
        toast.success('GPS module is online ✅');
      } else {
        toast.error('GPS module did not respond — offline or out of range');
      }
    } catch {
      setResult(false);
      toast.error('Ping request failed');
    } finally {
      setPinging(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result !== null && (
        <span className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
          result ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        )}>
          {result ? <Wifi size={12} /> : <WifiOff size={12} />}
          {result ? 'GPS Online' : 'GPS Offline'}
        </span>
      )}
      <button
        onClick={doPing}
        disabled={pinging}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition',
          'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed'
        )}>
        {pinging
          ? <><RefreshCw size={12} className="animate-spin" /> Pinging…</>
          : <><Satellite size={12} /> Ping GPS</>}
      </button>
      {checkedAt && <span className="text-xs text-gray-400">Checked {formatDate(checkedAt)}</span>}
    </div>
  );
}

// ─── Device SIM Card ──────────────────────────────────────────────────────────
function DeviceSimCard({ vehicleId, current, onSave, saving }:
  { vehicleId: string; current?: string; onSave: (n: string) => void; saving: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(current ?? '');
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        📶 SIM Card Number
      </h3>
      {editing ? (
        <div className="flex gap-2">
          <input value={value} onChange={e => setValue(e.target.value)}
            placeholder="+250780000000"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => { onSave(value); setEditing(false); }} disabled={saving}
            className="px-3 py-2 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {saving ? '…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)}
            className="px-3 py-2 border border-gray-300 text-xs rounded-lg hover:bg-gray-50">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-gray-700">{current || 'Not set'}</span>
          <button onClick={() => { setValue(current ?? ''); setEditing(true); }}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            {current ? 'Edit' : 'Add'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Remote Device Commands ───────────────────────────────────────────────────
function DeviceCommands({ vehicleId: _id, onCommand, pending }:
  { vehicleId: string; onCommand: (cmd: string, p?: object) => void; pending: boolean }) {
  const [ussd, setUssd] = useState('');
  const [showUssd, setShowUssd] = useState(false);

  const buttons = [
    { label: 'Check Internet',  cmd: 'check_internet', icon: '🌐', color: 'bg-blue-50 text-blue-700 border-blue-200',       desc: 'Check signal & data' },
    { label: 'Ping Device',     cmd: 'ping',            icon: '📡', color: 'bg-green-50 text-green-700 border-green-200',   desc: 'Confirm online' },
    { label: 'Restart GSM',     cmd: 'restart',         icon: '🔄', color: 'bg-orange-50 text-orange-700 border-orange-200', desc: 'Reboot SIM808' },
    { label: 'Check Balance',   cmd: 'ussd',            icon: '💳', color: 'bg-purple-50 text-purple-700 border-purple-200', desc: 'Run USSD code', ussd: true },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        ⚡ Remote Device Commands
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {buttons.map(b => (
          <button key={b.cmd}
            disabled={pending}
            onClick={() => {
              if (b.ussd) { setShowUssd(true); return; }
              onCommand(b.cmd);
            }}
            className={cn('flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-xs font-semibold transition hover:opacity-80 disabled:opacity-50', b.color)}>
            <span className="text-base">{b.icon}</span>
            <span>{b.label}</span>
            <span className="font-normal opacity-60 text-[10px]">{b.desc}</span>
          </button>
        ))}
      </div>

      {/* USSD input */}
      {showUssd && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className="text-xs font-medium text-gray-700">USSD Code (e.g. *175# to buy data)</label>
          <div className="flex gap-2">
            <input value={ussd} onChange={e => setUssd(e.target.value)}
              placeholder="*175#"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-brand-500" />
            <button onClick={() => { onCommand('ussd', { code: ussd }); setShowUssd(false); setUssd(''); }}
              disabled={!ussd || pending}
              className="px-3 py-2 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50">
              Send
            </button>
            <button onClick={() => setShowUssd(false)}
              className="px-3 py-2 border border-gray-300 text-xs rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-gray-400">
            Common codes: *175# (buy Airtel data), *131# (check MTN balance)
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Data Plan Tracker ────────────────────────────────────────────────────────
function DataPlanCard({ vehicleId, vehicle, onSave, saving }:
  { vehicleId: string; vehicle: any; onSave: (d: any) => void; saving: boolean }) {
  const [open, setOpen]         = useState(false);
  const [type, setType]         = useState<'DAILY'|'WEEKLY'|'MONTHLY'>(vehicle?.dataPlanType ?? 'MONTHLY');
  const [boughtAt, setBoughtAt] = useState('');
  const [expiry, setExpiry]     = useState('');

  // Auto-calculate expiry from bought date + type
  const calcExpiry = (bought: string, planType: string) => {
    if (!bought) return '';
    const d = new Date(bought);
    if (planType === 'DAILY')   d.setDate(d.getDate() + 1);
    if (planType === 'WEEKLY')  d.setDate(d.getDate() + 7);
    if (planType === 'MONTHLY') d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 16);
  };

  const current = vehicle?.dataPlanExpiry;
  const now     = Date.now();
  const expMs   = current ? new Date(current).getTime() - now : null;
  const expired = expMs !== null && expMs < 0;
  const urgent  = expMs !== null && expMs > 0 && expMs < 3 * 86400_000;

  return (
    <div className={cn('bg-white rounded-xl border p-4 space-y-3',
      expired ? 'border-red-300 bg-red-50' : urgent ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200')}>
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        📶 SIM Data Plan
      </h3>

      {/* Current status */}
      {current ? (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Plan type</span>
            <span className="font-semibold">{vehicle.dataPlanType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Expires</span>
            <span className={cn('font-semibold', expired ? 'text-red-600' : urgent ? 'text-yellow-700' : 'text-green-700')}>
              {formatDate(current)}
              {expired && ' ⚠ EXPIRED'}
              {urgent && !expired && ' ⚠ Expires soon'}
            </span>
          </div>
          {vehicle.dataPlanBoughtAt && (
            <div className="flex justify-between">
              <span className="text-gray-500">Purchased</span>
              <span>{formatDate(vehicle.dataPlanBoughtAt)}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No data plan recorded yet</p>
      )}

      {/* Record new purchase */}
      {open ? (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-1">
            {(['DAILY','WEEKLY','MONTHLY'] as const).map(t => (
              <button key={t} onClick={() => { setType(t); if (boughtAt) setExpiry(calcExpiry(boughtAt, t)); }}
                className={cn('py-1.5 rounded-lg text-xs font-semibold border transition',
                  type === t ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
                {t}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium">Date & time purchased</label>
            <input type="datetime-local" value={boughtAt}
              onChange={e => { setBoughtAt(e.target.value); setExpiry(calcExpiry(e.target.value, type)); }}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium">Expiry (auto-calculated)</label>
            <input type="datetime-local" value={expiry}
              onChange={e => setExpiry(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <p className="text-[10px] text-gray-400">
            Alert: Monthly = 3 days before · Weekly = 1 day before · Daily = 3 hours before
          </p>
          <div className="flex gap-2">
            <button onClick={() => { onSave({ dataPlanType: type, dataPlanBoughtAt: boughtAt, dataPlanExpiry: expiry }); setOpen(false); }}
              disabled={!boughtAt || !expiry || saving}
              className="flex-1 py-2 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 disabled:opacity-50 font-semibold">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setOpen(false)}
              className="px-3 py-2 border border-gray-300 text-xs rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="w-full py-2 border border-brand-200 text-brand-700 text-xs rounded-lg hover:bg-brand-50 font-semibold transition">
          📥 Record New Purchase
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, sub, icon, color = 'blue' }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color?: string;
}) {
  const bg: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red:    'bg-red-50 text-red-600',
    gray:   'bg-gray-100 text-gray-500',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', bg[color] ?? bg.blue)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VehicleDetailPage({ params }: { params: { id: string } }) {
  const qc = useQueryClient();
  const { accessToken } = useAuthStore();
  const [tab, setTab]   = useState<Tab>('overview');
  const [from, setFrom] = useState(format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"));
  const [to, setTo]     = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  // Live state from Socket.IO
  const [liveLoc, setLiveLoc]               = useState<any>(null);
  const [liveStatus, setLiveStatus]         = useState<string | null>(null);
  const [engineLocked, setEngineLocked]     = useState<boolean | null>(null);
  const [wsConnected, setWsConnected]       = useState(false);
  const [wsInitialised, setWsInitialised]   = useState(false);
  const [gpsModuleOnline, setGpsModuleOnline] = useState<boolean | null>(null);
  const [confirmAction, setConfirmAction]   = useState<'lock'|'unlock'|null>(null);
  const [connectedNow, setConnectedNow]     = useState(false); // true when gps:online fired for this vehicle

  // Log of command responses from the ESP32 device
  const [cmdLog, setCmdLog] = useState<Array<{ ts: string; summary: string; raw: Record<string, any> }>>([]);

  // Ticker to refresh relative timestamps every 2s
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(timer);
  }, []);

  // DB vehicle fetch
  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', params.id],
    queryFn:  () => vehicleApi.get(params.id),
  });

  useEffect(() => {
    if (vehicle) setEngineLocked(vehicle.engineLocked ?? false);
  }, [vehicle]);

  // GPS history — use full datetime (from/to include time)
  const { data: gpsData } = useQuery({
    queryKey: ['gps-history', params.id, from, to],
    queryFn:  () => vehicleApi.gpsHistory(params.id, {
      from: new Date(from).toISOString(),
      to:   new Date(to).toISOString(),
      limit: 3000,
    }),
    enabled:  tab === 'history',
  });

  // Telemetry chart data
  const { data: telemetryData } = useQuery({
    queryKey: ['telemetry', params.id, from, to],
    queryFn:  () => telemetryApi.getHistory(params.id, { from, to }),
    enabled:  tab === 'telemetry',
  });

  // Socket.IO — live telemetry, lock state, online/offline
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);

    socket.on('connect',    () => { setWsConnected(true); setWsInitialised(true); socket.emit('subscribe:vehicle', params.id); });
    socket.on('disconnect', () =>   setWsConnected(false));

    socket.on('telemetry:update', (p: any) => {
      if (p.vehicleId !== params.id) return;
      const d = p.data;
      setLiveLoc({
        latitude: d.latitude, longitude: d.longitude, speed: d.speed,
        heading: d.heading, engineOn: d.engineOn, fuelLevel: d.fuelLevel,
        engineTemp: d.engineTemp, updatedAt: p.timestamp,
      });
      // GPS status based on speed, NOT engineOn
      const spd = d.speed ?? 0;
      setLiveStatus(spd > 2 ? 'ACTIVE' : 'IDLE');

      // Capture command responses (ack, pong, ussd_response, internet_status, restarting)
      if (d.ack || d.pong || d.cmd || d.ussd_response || d.event) {
        const summary = d.ack ? `Engine ${d.ack === 'lock' ? '🔒 LOCKED' : '🔓 UNLOCKED'}`
          : d.pong ? `📡 Pong — GPS: ${d.gpsModuleOn ? 'ON' : 'OFF'}, Locked: ${d.locked}`
          : d.cmd === 'internet_status' ? `🌐 Signal: ${d.signal}/31 (${d.signalPct}%) GPRS: ${d.gprsOk ? '✅' : '❌'} GPS: ${d.gpsOn ? 'ON' : 'OFF'}`
          : d.cmd === 'ussd_response' ? `💬 USSD ${d.code}: ${d.ussd_response}`
          : d.event === 'restarting' ? '🔄 Device restarting...'
          : d.event === 'device_connected' ? '✅ Device connected'
          : JSON.stringify(d).slice(0, 80);
        setCmdLog(prev => [{ ts: p.timestamp ?? new Date().toISOString(), summary, raw: d }, ...prev.slice(0, 49)]);
      }
    });

    socket.on('vehicle:lock', (p: any) => {
      if (p.vehicleId !== params.id) return;
      setEngineLocked(p.locked);
      qc.invalidateQueries({ queryKey: ['vehicle', params.id] });
    });

    socket.on('vehicles:offline', (p: any) => {
      if (p.vehicleIds?.includes(params.id)) {
        setLiveStatus('OFFLINE');
        setConnectedNow(false);
      }
    });

    // GPS module connect/disconnect events
    socket.on('gps:online',  (p: any) => {
      if (p.vehicleId === params.id) {
        setGpsModuleOnline(true);
        setConnectedNow(true);
        setLiveStatus(prev => prev === 'OFFLINE' ? 'IDLE' : prev);
      }
    });
    socket.on('gps:offline', (p: any) => {
      if (p.vehicleId === params.id) {
        setGpsModuleOnline(false);
        setConnectedNow(false);
      }
    });

    // Heartbeat — device online but may have no GPS fix — update last seen time
    socket.on('device:heartbeat', (p: any) => {
      if (p.vehicleId !== params.id) return;
      setConnectedNow(true);
      setLiveStatus(prev => prev === 'OFFLINE' ? 'IDLE' : prev);
      // Update liveLoc updatedAt so "Last update" shows current time
      setLiveLoc((prev: any) => prev ? { ...prev, updatedAt: p.updatedAt } : { updatedAt: p.updatedAt });
    });

    return () => {
      socket.off('telemetry:update');
      socket.off('vehicle:lock');
      socket.off('vehicles:offline');
      socket.off('gps:online');
      socket.off('gps:offline');
      socket.off('device:heartbeat');
      socket.emit('unsubscribe:vehicle', params.id);
    };
  }, [accessToken, params.id, qc]);

  // Lock mutation
  const lockMutation = useMutation({
    mutationFn: ({ locked }: { locked: boolean }) => vehicleApi.lock(params.id, locked),
    onSuccess: (_, { locked }) => {
      setEngineLocked(locked);
      qc.invalidateQueries({ queryKey: ['vehicle', params.id] });
      toast.success(locked ? '🔒 Engine locked' : '🔓 Engine unlocked');
    },
    onError: () => toast.error('Lock command failed'),
  });

  // Device command mutation
  const cmdMutation = useMutation({
    mutationFn: ({ command, params: p }: { command: string; params?: object }) =>
      deviceApi.sendCommand(params.id, command, p),
    onSuccess: (_, { command }) => toast.success(`Command "${command}" sent to device`),
    onError: () => toast.error('Command failed — check device connection'),
  });

  // SIM update mutation
  const simMutation = useMutation({
    mutationFn: (simNumber: string) => deviceApi.updateSim(params.id, simNumber),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', params.id] });
      toast.success('SIM number updated');
    },
    onError: () => toast.error('Failed to update SIM number'),
  });

  // Data plan mutation
  const dataPlanMutation = useMutation({
    mutationFn: (data: any) => deviceApi.updateDataPlan(params.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', params.id] });
      toast.success('Data plan recorded');
    },
    onError: () => toast.error('Failed to save data plan'),
  });

  // Regenerate token
  const regenMutation = useMutation({
    mutationFn: () => vehicleApi.regenerateToken(params.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', params.id] });
      toast.success('Device token regenerated');
    },
    onError: () => toast.error('Token regeneration failed'),
  });

  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-40 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Truck size={40} className="mb-3 opacity-20" />
        <p className="font-medium">Vehicle not found</p>
        <Link href="/vehicles" className="mt-4 text-blue-600 text-sm hover:underline">← Back to vehicles</Link>
      </div>
    );
  }

  const loc    = liveLoc ?? vehicle.lastLocation;
  const locked = engineLocked ?? vehicle.engineLocked;

  // ── Status resolution: connectedNow is ground truth ─────────────────────────
  // If we received a gps:online / device:heartbeat for this vehicle, it's confirmed online.
  // Use speed to distinguish ACTIVE vs IDLE.
  // Fall back to DB status only when we have no live signal at all.
  function getStatus(): string {
    if (connectedNow) {
      return (loc?.speed ?? 0) > 2 ? 'ACTIVE' : 'IDLE';
    }
    // If liveStatus was set by telemetry:update (ACTIVE/IDLE), trust it
    if (liveStatus && liveStatus !== 'OFFLINE') return liveStatus;
    // If updatedAt is within 10 seconds, device is likely still alive
    if (loc?.updatedAt) {
      const age = Date.now() - new Date(loc.updatedAt).getTime();
      if (age < 10_000) return (loc?.speed ?? 0) > 2 ? 'ACTIVE' : 'IDLE';
    }
    return liveStatus ?? vehicle.status ?? 'OFFLINE';
  }
  const status = getStatus();

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',  label: 'Overview',    icon: <Info size={14} /> },
    { id: 'history',   label: 'GPS History', icon: <Route size={14} /> },
    { id: 'telemetry', label: 'Telemetry',   icon: <BarChart2 size={14} /> },
    { id: 'commands',  label: 'Device Commands', icon: <Terminal size={14} /> },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/vehicles"
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500">
            <ArrowLeft size={16} />
          </Link>
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Truck size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{vehicle.name}</h1>
            <p className="text-sm text-gray-500 font-mono">{vehicle.licensePlate}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* WebSocket connection indicator — only show after first connect attempt */}
          {wsInitialised && (
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              wsConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
              <span className={cn('w-1.5 h-1.5 rounded-full', wsConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400')} />
              {wsConnected ? 'Live' : 'Offline'}
            </span>
          )}

          {/* Vehicle status badge */}
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', getStatusColor(status))}>
            {status}
          </span>

          {/* GPS module live indicator (from MQTT connect/disconnect events) */}
          {gpsModuleOnline !== null && (
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
              gpsModuleOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700')}>
              {gpsModuleOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
              {gpsModuleOnline ? 'GPS Connected' : 'GPS Disconnected'}
            </span>
          )}

          {/* Engine lock button */}
          <button
            onClick={() => setConfirmAction(locked ? 'unlock' : 'lock')}
            disabled={lockMutation.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition',
              locked
                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
              'disabled:opacity-50'
            )}>
            {locked ? <><Lock size={12} /> LOCKED</> : <><Unlock size={12} /> UNLOCKED</>}
          </button>
        </div>
      </div>

      {/* ── Live stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Speed"       value={formatSpeed(loc?.speed)}     icon={<Gauge size={18} />}       color="blue"   />
        <Stat label="Fuel Level"  value={formatFuel(loc?.fuelLevel)}  icon={<Fuel size={18} />}        color="yellow" />
        <Stat label="Engine Temp" value={formatTemp(loc?.engineTemp)} icon={<Thermometer size={18} />} color="red"    />
        <Stat label="Today km"    value={`${(loc?.distanceTodayKm ?? 0).toFixed(1)} km`}
          icon={<Route size={18} />} color="green"
          sub={loc?.updatedAt ? `Last seen ${timeAgo(loc.updatedAt)}` : 'No data'} />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px',
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left column — vehicle info */}
          <div className="lg:col-span-1 space-y-4">

            {/* GPS Ping */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Satellite size={15} className="text-blue-500" /> GPS Module Status
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Send a ping to check if the GPS module is currently online and responding.
                If no response arrives within 8 seconds, the device is offline.
              </p>
              <GpsPingBadge vehicleId={params.id} />
            </div>

            {/* Last location */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MapPin size={15} className="text-blue-500" /> Last Known Position
              </h3>
              {loc?.latitude ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Latitude</span>
                    <span className="font-mono text-gray-900">{loc.latitude.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Longitude</span>
                    <span className="font-mono text-gray-900">{loc.longitude.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Speed</span>
                    <span className="font-semibold">{formatSpeed(loc.speed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Engine</span>
                    <span className={loc.engineOn ? 'text-green-700 font-semibold' : 'text-gray-500'}>
                      {loc.engineOn ? 'ON ✅' : 'OFF'}
                    </span>
                  </div>
                  {loc.updatedAt && (
                    <p className="text-xs text-gray-400 pt-1 border-t">
                      Last update: {timeAgo(loc.updatedAt)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No GPS data received yet</p>
              )}
            </div>

            {/* Device Token */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Device Token</h3>
              <p className="text-xs text-gray-500">Used as MQTT username & password for this vehicle's GPS device.</p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-mono text-xs text-gray-700 truncate flex-1">
                  {vehicle.deviceToken?.substring(0, 16)}…
                </span>
                <CopyButton text={vehicle.deviceToken ?? ''} />
              </div>
              <button
                onClick={() => { if (confirm('Regenerate device token? The old token will stop working immediately.')) regenMutation.mutate(); }}
                disabled={regenMutation.isPending}
                className="w-full mt-1 py-2 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition disabled:opacity-50">
                {regenMutation.isPending ? 'Regenerating…' : '⟳ Regenerate Token'}
              </button>
            </div>

            {/* SIM Card Number */}
            <DeviceSimCard
              vehicleId={params.id}
              current={(vehicle as any).simNumber}
              onSave={(n) => simMutation.mutate(n)}
              saving={simMutation.isPending}
            />
          </div>

          {/* Right column — vehicle details */}
          <div className="lg:col-span-2 space-y-4">

            {/* Basic info */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Vehicle Details</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                {[
                  ['Manufacturer',  vehicle.manufacturer],
                  ['Model',         vehicle.model],
                  ['Year',          vehicle.year],
                  ['VIN',           vehicle.vin ?? '—'],
                  ['Engine No.',    vehicle.engineNumber ?? '—'],
                  ['Color',         vehicle.color ?? '—'],
                  ['Vehicle Class', vehicle.vehicleClass?.replace(/_/g,' ')],
                  ['Purpose',       vehicle.purpose?.replace(/_/g,' ')],
                  ['Energy Type',   vehicle.energyType],
                  ['Transmission',  vehicle.transmission?.replace(/_/g,' ')],
                  ['Fleet',         vehicle.fleet?.name ?? 'Unassigned'],
                  ['Odometer',      `${(vehicle.odometer ?? 0).toLocaleString()} km`],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex flex-col">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="font-medium text-gray-900">{value ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Calendar size={15} className="text-blue-500" /> Compliance & Insurance
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                {[
                  ['Insurance Expiry',   vehicle.insuranceExpiry],
                  ['Road Tax Expiry',    vehicle.roadTaxExpiry],
                  ['Inspection Expiry',  vehicle.inspectionExpiry],
                  ['Insurance Company',  vehicle.insuranceCompany ?? '—'],
                  ['Policy No.',         vehicle.insurancePolicyNo ?? '—'],
                ].map(([label, value]) => {
                  const isDate = value && value !== '—';
                  const expired = isDate && new Date(value as string) < new Date();
                  return (
                    <div key={label as string} className="flex flex-col">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className={cn('font-medium', expired ? 'text-red-600' : 'text-gray-900')}>
                        {isDate ? formatDate(value as string) : (value ?? '—')}
                        {expired && <span className="ml-1 text-xs font-bold">⚠ EXPIRED</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GPS Device info */}
            {vehicle.gpsDevice && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Satellite size={15} className="text-blue-500" /> GPS Device
                </h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                  {[
                    ['Device ID',     vehicle.gpsDevice.deviceId],
                    ['IMEI',          vehicle.gpsDevice.imei ?? '—'],
                    ['SIM Number',    vehicle.gpsDevice.simNumber ?? '—'],
                    ['Provider',      vehicle.gpsDevice.networkProvider ?? '—'],
                    ['Firmware',      vehicle.gpsDevice.firmwareVersion ?? '—'],
                    ['Status',        vehicle.gpsDevice.status],
                    ['Last Comm.',    vehicle.gpsDevice.lastCommunication ? formatDate(vehicle.gpsDevice.lastCommunication) : 'Never'],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex flex-col">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="font-medium text-gray-900">{value ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GPS HISTORY TAB ─────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
            <Calendar size={15} className="text-gray-400 shrink-0" />
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">From</label>
              <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">To</label>
              <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <span className="text-sm text-gray-500 font-medium">
              {gpsData?.count ?? 0} GPS points
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: 500 }}>
            {gpsData?.points ? (
              <GpsHistoryMap
                points={gpsData.points}
                vehiclePlate={vehicle.licensePlate}
                vehicleName={vehicle.name}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <RefreshCw size={20} className="animate-spin mr-2" /> Loading GPS history…
              </div>
            )}
          </div>
          {gpsData?.count === 0 && (
            <p className="text-center text-sm text-gray-400">
              No GPS points found for this period. Try expanding the time range.
            </p>
          )}
        </div>
      )}

      {/* ── TELEMETRY TAB ───────────────────────────────────────────────────── */}
      {tab === 'telemetry' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ minHeight: 400 }}>
            {telemetryData?.data?.length > 0 ? (
              <TelemetryChart data={telemetryData.data} />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <BarChart2 size={36} className="mb-3 opacity-20" />
                <p>No telemetry data for this period</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COMMANDS TAB ────────────────────────────────────────────────────── */}
      {tab === 'commands' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <DeviceCommands
              vehicleId={params.id}
              onCommand={(cmd, p) => cmdMutation.mutate({ command: cmd, params: p })}
              pending={cmdMutation.isPending}
            />
            <DataPlanCard
              vehicleId={params.id}
              vehicle={vehicle}
              onSave={(d) => dataPlanMutation.mutate(d)}
              saving={dataPlanMutation.isPending}
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              📨 Device Responses <span className="text-xs font-normal text-gray-400">({cmdLog.length})</span>
            </h3>
            {cmdLog.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No responses yet. Send a command to see results here.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {cmdLog.map((entry, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-800">{entry.summary}</p>
                      <p className="text-[10px] text-gray-400">{formatDate(entry.ts)}</p>
                    </div>
                    <details>
                      <summary className="text-[10px] text-gray-400 cursor-pointer">Raw data</summary>
                      <pre className="text-[9px] text-gray-600 mt-1 bg-white rounded p-2 overflow-x-auto">{JSON.stringify(entry.raw, null, 2)}</pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Lock confirmation modal ──────────────────────────────────────────── */}
      {confirmAction && (
        <LockConfirmModal
          plate={vehicle.licensePlate}
          action={confirmAction}
          onConfirm={() => {
            lockMutation.mutate({ locked: confirmAction === 'lock' });
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
