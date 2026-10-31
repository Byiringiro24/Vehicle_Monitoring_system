'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Clock3, CreditCard, FileText, ShoppingBag } from 'lucide-react';

import { apiClient } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const CONTRACT_STATUS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  DRAFT: 'bg-slate-100 text-slate-600',
  COMPLETED: 'bg-blue-100 text-blue-700',
  DEFAULTED: 'bg-red-100 text-red-700',
  TERMINATED: 'bg-slate-100 text-slate-500',
  PENDING: 'bg-amber-100 text-amber-700',
};

const PAYMENT_STATUS: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-blue-100 text-blue-700',
  WAIVED: 'bg-slate-100 text-slate-600',
};

type TabId = 'agreements' | 'payments' | 'history';

export default function CustomerPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<TabId>('agreements');

  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['customer-contracts'],
    queryFn: () => apiClient.get('/contracts/contracts?limit=50').then((r) => r.data),
  });

  const contracts: any[] = contractsData?.data ?? contractsData ?? [];
  const activeContracts = contracts.filter((contract) => contract.status === 'ACTIVE');
  const totalBalance = contracts.reduce((sum, contract) => sum + (contract.totalBalance ?? 0), 0);
  const totalPaid = contracts.reduce((sum, contract) => sum + (contract.totalPaid ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back, {user?.firstName}. Track your agreements, payments, and document activity in one place.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active agreements', value: activeContracts.length, icon: FileText, tone: 'bg-brand-50 text-brand-700' },
          { label: 'Total agreements', value: contracts.length, icon: ShoppingBag, tone: 'bg-violet-50 text-violet-700' },
          { label: 'Total paid', value: `RWF ${Number(totalPaid).toLocaleString()}`, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Balance due', value: `RWF ${Number(totalBalance).toLocaleString()}`, icon: CreditCard, tone: 'bg-amber-50 text-amber-700' },
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

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {([
          ['agreements', 'My Agreements'],
          ['payments', 'Payments'],
          ['history', 'History'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as TabId)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition',
              tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'agreements' && (
        isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((item) => (
              <div key={item} className="app-panel h-28 animate-pulse" />
            ))}
          </div>
        ) : contracts.length === 0 ? (
          <div className="app-panel p-12 text-center">
            <ShoppingBag size={36} className="mx-auto mb-3 text-slate-200" />
            <p className="text-lg font-semibold text-slate-700">No agreements yet</p>
            <p className="mt-1 text-sm text-slate-500">Your rental and hire-purchase agreements will appear here as soon as they are created.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract: any) => (
              <div key={contract.id} className="app-panel p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', CONTRACT_STATUS[contract.status] ?? 'bg-slate-100 text-slate-600')}>
                        {contract.status}
                      </span>
                      <span className="text-xs uppercase tracking-[0.12em] text-slate-400">{contract.contractType?.replace(/_/g, ' ')}</span>
                    </div>

                    <p className="text-base font-semibold text-slate-900">
                      {contract.vehicle?.name ?? contract.vehicle?.licensePlate ?? 'Vehicle'}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={12} />
                        {formatDate(contract.startDate)} → {contract.endDate ? formatDate(contract.endDate) : 'Ongoing'}
                      </span>
                      <span>#{contract.contractNumber?.slice(0, 10)}</span>
                    </div>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-sm font-bold text-slate-900 tabular">
                      {contract.currency} {(contract.periodicAmount ?? 0).toLocaleString()}/period
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Paid: {contract.currency} {(contract.totalPaid ?? 0).toLocaleString()}</p>
                    {(contract.totalBalance ?? 0) > 0 && (
                      <p className="mt-1 text-xs font-medium text-amber-600">Balance: {contract.currency} {(contract.totalBalance ?? 0).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'payments' && <CustomerPayments />}

      {tab === 'history' && (
        <div className="app-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
            <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
              Updated today
            </span>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Agreement confirmed', detail: 'Toyota Hilux — recurring monthly plan', time: '2h ago' },
              { label: 'Payment scheduled', detail: 'Next invoice due in 6 days', time: '1 day ago' },
              { label: 'Document verified', detail: 'National ID and insurance uploaded successfully', time: '3 days ago' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                </div>
                <span className="text-[11px] text-slate-400">{item.time}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <a href="/support" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
              Need help
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerPayments() {
  const { data: contracts } = useQuery({
    queryKey: ['customer-contracts'],
    queryFn: () => apiClient.get('/contracts/contracts?limit=50').then((r) => r.data),
  });

  const allContracts: any[] = (contracts as any)?.data ?? contracts ?? [];

  return (
    <div className="space-y-3">
      {allContracts.length === 0 ? (
        <div className="app-panel p-8 text-center">
          <CreditCard size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="text-base font-semibold text-slate-700">No payment records</p>
        </div>
      ) : (
        allContracts.map((contract: any) => (
          <div key={contract.id} className="app-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3">
              <p className="text-sm font-semibold text-slate-800">
                {contract.vehicle?.licensePlate ?? 'Vehicle'} · {contract.contractType?.replace(/_/g, ' ')}
              </p>
              <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', (PAYMENT_STATUS as any)[contract.paymentStatus] ?? 'bg-slate-100 text-slate-600')}>
                {contract.status}
              </span>
            </div>

            <div className="grid gap-4 px-5 py-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Total value</p>
                <p className="mt-1 text-base font-bold text-slate-900 tabular">{contract.currency} {(contract.totalValue ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Total paid</p>
                <p className="mt-1 text-base font-bold text-emerald-600 tabular">{contract.currency} {(contract.totalPaid ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Balance</p>
                <p className={cn('mt-1 text-base font-bold tabular', (contract.totalBalance ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                  {contract.currency} {(contract.totalBalance ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
