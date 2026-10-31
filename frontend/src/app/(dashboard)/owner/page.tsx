'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, Car, DollarSign, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { apiClient } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

export default function OwnerPage() {
  const { user } = useAuthStore();
  const [claimVehicleId, setClaimVehicleId] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [showClaim, setShowClaim] = useState(false);

  const { data: ownedVehicles = [], isLoading, refetch } = useQuery({
    queryKey: ['owner-vehicles'],
    queryFn: () => apiClient.get('/owner/vehicles').then((r) => r.data),
  });

  const { data: statementsData } = useQuery({
    queryKey: ['owner-statements'],
    queryFn: () => apiClient.get('/owner/statements').then((r) => r.data),
  });

  const { data: orgVehicles } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => apiClient.get('/vehicles?limit=200').then((r) => r.data),
  });

  const vehicles: any[] = ownedVehicles as any[];
  const statements: any[] = statementsData?.statements ?? [];
  const allOrgVehicles: any[] = (orgVehicles as any)?.data ?? orgVehicles ?? [];
  const unownedVehicles = allOrgVehicles.filter((vehicle: any) => !vehicle.ownerUserId);

  const totalIncome = vehicles.reduce((sum, vehicle) => sum + (vehicle.monthlyIncome ?? 0), 0);
  const totalExpenses = vehicles.reduce((sum, vehicle) => sum + (vehicle.monthlyExpenses ?? 0), 0);
  const totalNet = vehicles.reduce((sum, vehicle) => sum + (vehicle.monthlyNet ?? 0), 0);

  async function handleClaim() {
    if (!claimVehicleId) return;
    setClaiming(true);
    try {
      await apiClient.patch(`/owner/vehicles/${claimVehicleId}/claim`);
      refetch();
      setShowClaim(false);
      setClaimVehicleId('');
    } catch (error: any) {
      alert(error.response?.data?.error ?? 'Failed to claim vehicle');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Vehicles</h1>
          <p className="mt-1 text-sm text-slate-500">Personal vehicle ownership · {formatDate(new Date())}</p>
        </div>

        {unownedVehicles.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClaim(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.26)] transition hover:translate-y-[-1px]"
          >
            <Plus size={14} />
            Claim a vehicle
          </button>
        )}
      </div>

      {vehicles.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { label: 'Income this month', value: `RWF ${totalIncome.toLocaleString()}`, icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'Expenses', value: `RWF ${totalExpenses.toLocaleString()}`, icon: TrendingDown, tone: 'bg-red-50 text-red-600' },
            { label: 'Net this month', value: `RWF ${totalNet.toLocaleString()}`, icon: DollarSign, tone: 'bg-cyan-50 text-cyan-700' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="app-panel p-4">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 tabular">{value}</p>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((item) => (
            <div key={item} className="app-panel h-40 animate-pulse" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="app-panel p-12 text-center">
          <Car size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-xl font-semibold text-slate-700">No vehicles under your ownership.</p>
          <p className="mt-2 text-sm text-slate-500">
            If you own a vehicle managed by a company, claim it here to link it to your account.
          </p>
          {unownedVehicles.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClaim(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Claim a vehicle
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {vehicles.map((vehicle: any) => (
            <div key={vehicle.id} className="app-panel overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Car size={22} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">{vehicle.licensePlate}</p>
                    <p className="text-sm text-slate-500">{vehicle.manufacturer} {vehicle.model} {vehicle.year}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {vehicle.organization && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
                      <Building2 size={11} className="text-slate-400" />
                      {vehicle.organization.name}
                    </span>
                  )}
                  <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', vehicle.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : vehicle.status === 'IDLE' ? 'bg-amber-100 text-amber-700' : vehicle.status === 'MAINTENANCE' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600')}>
                    {vehicle.status ?? 'OFFLINE'}
                  </span>
                </div>
              </div>

              <div className="grid gap-0 md:grid-cols-3">
                {[
                  { label: 'Income', value: vehicle.monthlyIncome ?? 0, color: 'text-emerald-600' },
                  { label: 'Expenses', value: vehicle.monthlyExpenses ?? 0, color: 'text-red-500' },
                  { label: 'Net', value: vehicle.monthlyNet ?? 0, color: (vehicle.monthlyNet ?? 0) >= 0 ? 'text-cyan-700' : 'text-red-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="border-t border-slate-200 px-5 py-4 text-center md:border-t-0 md:border-l md:first:border-l-0">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{label} (this month)</p>
                    <p className={cn('mt-1 text-lg font-bold tabular', color)}>RWF {Number(value).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {vehicle.activeContract && (
                <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-slate-500">
                    Active contract: <span className="font-semibold text-slate-700">{vehicle.activeContract.contractType?.replace(/_/g, ' ')}</span> · RWF {(vehicle.activeContract.periodicAmount ?? 0).toLocaleString()}/period
                  </p>
                  <Link href={`/agreements/${vehicle.activeContract.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
                    View agreement
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {statements.length > 0 && (
        <div className="app-panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Monthly statements</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-slate-50">
                <tr>
                  {['Month', 'Income', 'Expenses', 'Net'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {statements.map((statement: any) => (
                  <tr key={statement.month} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{statement.month}</td>
                    <td className="px-4 py-3 text-sm font-medium text-emerald-600 tabular">RWF {(statement.income ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-medium text-red-500 tabular">RWF {(statement.expense ?? 0).toLocaleString()}</td>
                    <td className={cn('px-4 py-3 text-sm font-bold tabular', (statement.net ?? 0) >= 0 ? 'text-cyan-700' : 'text-red-600')}>
                      RWF {(statement.net ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Claim ownership</h2>
              <button type="button" onClick={() => setShowClaim(false)} className="text-xl text-slate-400 hover:text-slate-600">
                ×
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-500">Select a vehicle from your organization to register it as your personal property.</p>

            <select
              value={claimVehicleId}
              onChange={(event) => setClaimVehicleId(event.target.value)}
              className="input-shell mb-4"
            >
              <option value="">Select a vehicle…</option>
              {unownedVehicles.map((vehicle: any) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.licensePlate} — {vehicle.name}
                </option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowClaim(false)}
                className="secondary-btn flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClaim}
                disabled={!claimVehicleId || claiming}
                className="primary-btn flex-1 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {claiming ? 'Claiming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
