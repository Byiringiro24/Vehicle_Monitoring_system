'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, alertApi } from '@/lib/api';
import { Settings, Plus, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const ALERT_TYPES = ['SPEEDING','LOW_FUEL','ENGINE_OVERHEAT','BATTERY_LOW','IDLE_TOO_LONG','OFFLINE'];
const SEVERITIES = ['CRITICAL','HIGH','MEDIUM','LOW'];

export default function SettingsPage() {
  const qc = useQueryClient();
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', type: 'SPEEDING', severity: 'HIGH', threshold: '' });

  const { data: rules = [] } = useQuery({ queryKey: ['alert-rules'], queryFn: alertApi.listRules });
  const { data: org } = useQuery({ queryKey: ['org'], queryFn: () => apiClient.get('/organizations/me').then(r => r.data) });

  const deleteRule = useMutation({
    mutationFn: alertApi.deleteRule,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); toast.success('Rule deleted'); },
  });

  const createRule = useMutation({
    mutationFn: () => {
      const condKey: Record<string, string> = { SPEEDING: 'maxSpeed', LOW_FUEL: 'minFuel', ENGINE_OVERHEAT: 'maxTemp', BATTERY_LOW: 'minVoltage' };
      const conditions = { [condKey[ruleForm.type] ?? 'value']: parseFloat(ruleForm.threshold) };
      return alertApi.createRule({ name: ruleForm.name, type: ruleForm.type, severity: ruleForm.severity, conditions });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); setShowRuleForm(false); toast.success('Rule created'); },
  });

  const severityColors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-800', HIGH: 'bg-orange-100 text-orange-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800', LOW: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="text-2xl font-bold text-gray-900">Settings</h1></div>

      {/* Organization */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Settings size={18} /> Organization</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {org && [['Name', org.name], ['Email', org.email], ['Phone', org.phone], ['Slug', org.slug]].map(([k, v]) => (
            <div key={k}><dt className="text-gray-500 font-medium mb-0.5">{k}</dt><dd className="text-gray-900">{v ?? '—'}</dd></div>
          ))}
        </dl>
      </div>

      {/* Alert Rules */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><AlertTriangle size={18} /> Alert Rules</h2>
          <button onClick={() => setShowRuleForm(!showRuleForm)}
            className="flex items-center gap-1.5 text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition">
            <Plus size={14} /> Add Rule
          </button>
        </div>

        {showRuleForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Rule Name</label>
                <input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Speed Limit 100km/h" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select value={ruleForm.type} onChange={e => setRuleForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  {ALERT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
                <select value={ruleForm.severity} onChange={e => setRuleForm(p => ({ ...p, severity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Threshold Value</label>
                <input value={ruleForm.threshold} onChange={e => setRuleForm(p => ({ ...p, threshold: e.target.value }))}
                  type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. 100" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRuleForm(false)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition">Cancel</button>
              <button onClick={() => createRule.mutate()} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition disabled:opacity-60" disabled={createRule.isPending}>
                {createRule.isPending ? 'Saving...' : 'Save Rule'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {rules.map((rule: any) => (
            <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-800">{rule.name}</p>
                <p className="text-xs text-gray-500">{rule.type.replace('_', ' ')} · {JSON.stringify(rule.conditions)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', severityColors[rule.severity])}>{rule.severity}</span>
                <button onClick={() => deleteRule.mutate(rule.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {!rules.length && <p className="text-sm text-gray-400 text-center py-4">No alert rules configured</p>}
        </div>
      </div>
    </div>
  );
}