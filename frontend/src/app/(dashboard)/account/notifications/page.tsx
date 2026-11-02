'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Bell, Mail, Smartphone, Save, Loader2 } from 'lucide-react';

const ALERT_GROUPS = [
  {
    label: 'GPS & Vehicle',
    types: [
      { code: 'SPEEDING',          label: 'Speeding',           desc: 'Vehicle exceeds the speed threshold' },
      { code: 'OFFLINE',           label: 'Device offline',     desc: 'GPS device stops sending data' },
      { code: 'GEOFENCE_ENTRY',    label: 'Geofence entry',     desc: 'Vehicle enters a geofence zone' },
      { code: 'GEOFENCE_EXIT',     label: 'Geofence exit',      desc: 'Vehicle exits a geofence zone' },
      { code: 'IDLE_TOO_LONG',     label: 'Idle too long',      desc: 'Vehicle engine running but not moving' },
      { code: 'HARSH_BRAKING',     label: 'Harsh braking',      desc: 'Sudden deceleration detected' },
      { code: 'HARSH_ACCELERATION',label: 'Harsh acceleration', desc: 'Sudden acceleration detected' },
      { code: 'ACCIDENT',          label: 'Accident',           desc: 'Potential accident detected' },
    ],
  },
  {
    label: 'Fuel & Battery',
    types: [
      { code: 'LOW_FUEL',            label: 'Low fuel',         desc: 'Fuel level below threshold' },
      { code: 'LOW_BATTERY',         label: 'Low battery',      desc: 'Battery level low (electric vehicles)' },
      { code: 'ENGINE_OVERHEAT',     label: 'Engine overheat',  desc: 'Engine temperature too high' },
      { code: 'BATTERY_LOW_VOLTAGE', label: 'Low voltage',      desc: 'Battery voltage below minimum' },
    ],
  },
  {
    label: 'Compliance & Documents',
    types: [
      { code: 'INSURANCE_EXPIRING',  label: 'Insurance expiring', desc: 'Insurance expires within 30 days' },
      { code: 'ROAD_TAX_EXPIRING',   label: 'Road tax expiring',  desc: 'Road tax expires within 30 days' },
      { code: 'INSPECTION_DUE',      label: 'Inspection due',     desc: 'Vehicle inspection is due' },
      { code: 'MAINTENANCE_DUE',     label: 'Maintenance due',    desc: 'Scheduled maintenance is due' },
    ],
  },
];

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<Record<string, { email: boolean; app: boolean }>>({});
  const [initialized, setInitialized] = useState(false);

  const { data: prefs = [], isLoading } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => apiClient.get('/notifications/preferences').then(r => r.data),
    onSuccess: (data: any[]) => {
      if (!initialized) {
        const map: Record<string, { email: boolean; app: boolean }> = {};
        data.forEach(p => { map[p.alertType] = { email: p.emailEnabled, app: p.inAppEnabled }; });
        setLocalPrefs(map);
        setInitialized(true);
      }
    },
  } as any);

  function getVal(code: string, type: 'email' | 'app'): boolean {
    if (localPrefs[code] !== undefined) return type === 'email' ? localPrefs[code].email : localPrefs[code].app;
    const saved = (prefs as any[]).find(p => p.alertType === code);
    return type === 'email' ? (saved?.emailEnabled ?? true) : (saved?.inAppEnabled ?? true);
  }

  function toggle(code: string, type: 'email' | 'app') {
    setLocalPrefs(prev => ({
      ...prev,
      [code]: {
        email: type === 'email' ? !getVal(code, 'email') : getVal(code, 'email'),
        app:   type === 'app'   ? !getVal(code, 'app')   : getVal(code, 'app'),
      },
    }));
  }

  async function saveAll() {
    setSaving(true);
    try {
      const all = ALERT_GROUPS.flatMap(g => g.types).map(t => ({
        alertType:    t.code,
        emailEnabled: getVal(t.code, 'email'),
        inAppEnabled: getVal(t.code, 'app'),
      }));
      await apiClient.put('/notifications/preferences', all);
      toast.success('Notification preferences saved');
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Choose which alerts you receive by email and in-app.
          </p>
        </div>
        <button
          onClick={saveAll}
          disabled={saving}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60 shadow-sm">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save preferences</>}
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
        <div className="flex items-center gap-1.5"><Mail size={13} className="text-brand-500" /> Email notification</div>
        <div className="flex items-center gap-1.5"><Bell size={13} className="text-purple-500" /> In-app notification</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-brand-500" /> Enabled</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-200" /> Disabled</div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        ALERT_GROUPS.map(group => (
          <div key={group.label} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-800 text-sm">{group.label}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {group.types.map(t => (
                <div key={t.code} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{t.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                  </div>
                  {/* Email toggle */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Mail size={12} className="text-gray-400" />
                    <button
                      onClick={() => toggle(t.code, 'email')}
                      className={`relative w-9 h-5 rounded-full transition ${getVal(t.code, 'email') ? 'bg-brand-500' : 'bg-gray-200'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${getVal(t.code, 'email') ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {/* In-app toggle */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Bell size={12} className="text-gray-400" />
                    <button
                      onClick={() => toggle(t.code, 'app')}
                      className={`relative w-9 h-5 rounded-full transition ${getVal(t.code, 'app') ? 'bg-purple-500' : 'bg-gray-200'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${getVal(t.code, 'app') ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="text-xs text-gray-400 text-center pb-4">
        Changes apply to future alerts only. Existing unread alerts are not affected.
      </div>
    </div>
  );
}
