'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Car, DollarSign, TrendingUp, TrendingDown, Building2, ArrowRight, CheckCircle2, Plus } from 'lucide-react';

export default function OwnerPage() {
  const { user } = useAuthStore();
  const [claimVehicleId, setClaimVehicleId] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [showClaim, setShowClaim] = useState(false);

  const { data: ownedVehicles = [], isLoading, refetch } = useQuery({
    queryKey: ['owner-vehicles'],
    queryFn: () => apiClient.get('/owner/vehicles').then(r => r.data),
  });

  const { data: statementsData } = useQuery({
    queryKey: ['owner-statements'],
    queryFn: () => apiClient.get('/owner/statements').then(r => r.data),
  });

  const { data: orgVehicles } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => apiClient.get('/vehicles?limit=200').then(r => r.data),
  });

  const vehicles: any[] = ownedVehicles as any[];
  const statements: any[] = statementsData?.statements ?? [];
  const allOrgVehicles: any[] = (orgVehicles as any)?.data ?? orgVehicles ?? [];
  const unownedVehicles = allOrgVehicles.filter((v: any) => !v.ownerUserId);

  const totalIncome   = vehicles.reduce((s, v) => s + (v.monthlyIncome ?? 0), 0);
  const totalExpenses = vehicles.reduce((s, v) => s + (v.monthlyExpenses ?? 0), 0);
  const totalNet      = vehicles.reduce((s, v) => s + (v.monthlyNet ?? 0), 0);

  async function handleClaim() {
    if (!claimVehicleId) return;
    setClaiming(true);
    try {
      await apiClient.patch(`/owner/vehicles/${claimVehicleId}/claim`);
      refetch();
      setShowClaim(false);
      setClaimVehicleId('');
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Failed to claim vehicle');
    } finally { setClaiming(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Vehicles</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Personal vehicle ownership · {formatDate(new Date())}
          </p>
        </div>
        {unownedVehicles.length > 0 && (
          <button onClick={() => setShowClaim(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition shadow-sm">
            <Plus size={14} /> Claim a vehicle
          </button>
        )}
      </div>

      {/* This month summary */}
      {vehicles.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Income this month',  value: totalIncome,   icon: <TrendingUp size={15} className="text-green-600" />,  bg: 'bg-green-50',  border: 'border-green-200', color: 'text-green-700' },
            { label: 'Expenses',           value: totalExpenses, icon: <TrendingDown size={15} className="text-red-500" />,   bg: 'bg-red-50',    border: 'border-red-200',   color: 'text-red-600' },
            { label: 'Net this month',     value: totalNet,      icon: <DollarSign size={15} className="text-teal-600" />,    bg: 'bg-teal-50',   border: 'border-teal-200',  color: 'text-teal-700' },
          ].map(({ label, value, icon, bg, border, color }) => (
            <div key={label} className={`bg-white rounded-xl border ${border} p-4 shadow-xs`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <p className={`text-xl font-bold tabular ${color}`}>RWF {value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Owned vehicles */}
      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : vehicles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Car size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No vehicles registered under your ownership</p>
          <p className="text-gray-400 text-sm mt-1">
            If you own a vehicle that's managed by a company, click "Claim a vehicle" to link it to your account.
          </p>
          {unownedVehicles.length > 0 && (
            <button onClick={() => setShowClaim(true)}
              className="mt-4 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition">
              Claim a vehicle <ArrowRight size={14} />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {vehicles.map((v: any) => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Vehicle header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
                    <Car size={22} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{v.licensePlate}</p>
                    <p className="text-sm text-gray-500">{v.manufacturer} {v.model} {v.year}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {v.organization && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg">
                      <Building2 size={11} className="text-gray-400" /> {v.organization.name}
                    </span>
                  )}
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                    v.status === 'ACTIVE'      ? 'bg-green-100 text-green-700' :
                    v.status === 'IDLE'        ? 'bg-yellow-100 text-yellow-700' :
                    v.status === 'MAINTENANCE' ? 'bg-orange-100 text-orange-700' :
                                                  'bg-gray-100 text-gray-500')}>
                    {v.status ?? 'OFFLINE'}
                  </span>
                </div>
              </div>

              {/* Financials */}
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                {[
                  { label: 'Income',   value: v.monthlyIncome   ?? 0, color: 'text-green-600' },
                  { label: 'Expenses', value: v.monthlyExpenses ?? 0, color: 'text-red-500' },
                  { label: 'Net',      value: v.monthlyNet      ?? 0, color: v.monthlyNet >= 0 ? 'text-teal-600' : 'text-red-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-5 py-4 text-center">
                    <p className="text-xs text-gray-400 mb-0.5">{label} (this month)</p>
                    <p className={`text-lg font-bold tabular ${color}`}>RWF {value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Active agreement */}
              {v.activeContract && (
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Active contract: <strong>{v.activeContract.contractType?.replace(/_/g,' ')}</strong> · 
                    RWF {(v.activeContract.periodicAmount ?? 0).toLocaleString()}/period
                  </p>
                  <Link href={`/agreements/${v.activeContract.id}`}
                    className="text-xs text-brand-600 font-medium hover:underline">
                    View agreement →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Monthly statements */}
      {statements.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Monthly Statements</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50 border-b">
                <tr>{['Month','Income','Expenses','Net'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statements.map((s: any) => (
                  <tr key={s.month} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.month}</td>
                    <td className="px-4 py-3 text-sm text-green-600 tabular font-medium">RWF {(s.income ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-red-500 tabular">RWF {(s.expense ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm tabular font-bold">
                      <span className={s.net >= 0 ? 'text-teal-600' : 'text-red-600'}>
                        RWF {(s.net ?? 0).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Claim vehicle modal */}
      {showClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Claim ownership of a vehicle</h2>
              <button onClick={() => setShowClaim(false)}><span className="text-gray-400 text-xl leading-none">×</span></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Select a vehicle from your organization to register as your personal property.
            </p>
            <select value={claimVehicleId} onChange={e => setClaimVehicleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 mb-4">
              <option value="">Select a vehicle…</option>
              {unownedVehicles.map((v: any) => (
                <option key={v.id} value={v.id}>{v.licensePlate} — {v.name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowClaim(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleClaim} disabled={!claimVehicleId || claiming}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {claiming ? 'Claiming…' : 'Claim vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
