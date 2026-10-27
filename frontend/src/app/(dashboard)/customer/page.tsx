'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ShoppingBag, FileText, DollarSign, Clock, CheckCircle2, ArrowRight, MapPin } from 'lucide-react';

const CONTRACT_STATUS: Record<string, string> = {
  ACTIVE:     'bg-green-100 text-green-700',
  DRAFT:      'bg-gray-100 text-gray-600',
  COMPLETED:  'bg-blue-100 text-blue-700',
  DEFAULTED:  'bg-red-100 text-red-700',
  TERMINATED: 'bg-gray-100 text-gray-500',
  PENDING:    'bg-amber-100 text-amber-700',
};

const PAYMENT_STATUS: Record<string, string> = {
  PAID:    'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-blue-100 text-blue-700',
  WAIVED:  'bg-gray-100 text-gray-500',
};

type TabId = 'agreements' | 'payments' | 'history';

export default function CustomerPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<TabId>('agreements');

  // Fetch contracts/agreements where this user is customer
  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['customer-contracts'],
    queryFn: () => apiClient.get('/contracts/contracts?limit=50').then(r => r.data),
  });

  const contracts: any[] = contractsData?.data ?? contractsData ?? [];
  const activeContracts = contracts.filter((c: any) => c.status === 'ACTIVE');
  const totalBalance = contracts.reduce((s: number, c: any) => s + (c.totalBalance ?? 0), 0);
  const totalPaid    = contracts.reduce((s: number, c: any) => s + (c.totalPaid ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Welcome, {user?.firstName} — manage your rentals, agreements and payments here.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active agreements', value: activeContracts.length, icon: <FileText size={15} className="text-brand-600" />,   bg: 'bg-brand-50',  border: 'border-brand-200' },
          { label: 'Total agreements',  value: contracts.length,       icon: <ShoppingBag size={15} className="text-purple-600" />, bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: 'Total paid',        value: `RWF ${(totalPaid/1000).toFixed(0)}k`,    icon: <CheckCircle2 size={15} className="text-green-600" />, bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'Balance due',       value: `RWF ${(totalBalance/1000).toFixed(0)}k`, icon: <DollarSign size={15} className="text-amber-600" />,  bg: 'bg-amber-50',  border: 'border-amber-200' },
        ].map(({ label, value, icon, bg, border }) => (
          <div key={label} className={`bg-white rounded-xl border ${border} p-4 shadow-xs flex items-center gap-3`}>
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center shrink-0`}>{icon}</div>
            <div>
              <p className="text-lg font-bold text-gray-900 tabular">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([['agreements','My Agreements'],['payments','Payments'],['history','History']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as TabId)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition',
              tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {label}
          </button>
        ))}
      </div>

      {/* Agreements tab */}
      {tab === 'agreements' && (
        isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : contracts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <ShoppingBag size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-600">No agreements yet</p>
            <p className="text-gray-400 text-sm mt-1">Your rental and hire-purchase agreements will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((c: any) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CONTRACT_STATUS[c.status] ?? 'bg-gray-100 text-gray-600')}>
                        {c.status}
                      </span>
                      <span className="text-xs text-gray-400">{c.contractType?.replace(/_/g,' ')}</span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {c.vehicle?.name ?? c.vehicle?.licensePlate ?? 'Vehicle'}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {formatDate(c.startDate)} → {c.endDate ? formatDate(c.endDate) : 'Ongoing'}
                      </span>
                      <span>#{c.contractNumber?.slice(0,10)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900 tabular">
                      {c.currency} {(c.periodicAmount ?? 0).toLocaleString()}/period
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Paid: {c.currency} {(c.totalPaid ?? 0).toLocaleString()}
                    </p>
                    {(c.totalBalance ?? 0) > 0 && (
                      <p className="text-xs text-amber-600 font-medium mt-0.5">
                        Balance: {c.currency} {(c.totalBalance ?? 0).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Payments tab */}
      {tab === 'payments' && <CustomerPayments />}

      {/* History tab */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <Clock size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">Payment history</p>
          <p className="text-sm text-gray-400 mt-1">Full transaction history will appear here.</p>
          <Link href="/support" className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
            Contact support <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}

function CustomerPayments() {
  const { data: contracts } = useQuery({
    queryKey: ['customer-contracts'],
    queryFn: () => apiClient.get('/contracts/contracts?limit=50').then(r => r.data),
  });
  const allContracts: any[] = (contracts as any)?.data ?? contracts ?? [];

  return (
    <div className="space-y-3">
      {allContracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <DollarSign size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No payment records</p>
        </div>
      ) : allContracts.map((c: any) => (
        <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">
              {c.vehicle?.licensePlate ?? 'Vehicle'} · {c.contractType?.replace(/_/g,' ')}
            </p>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', (PAYMENT_STATUS as any)[c.paymentStatus] ?? 'bg-gray-100 text-gray-600')}>
              {c.status}
            </span>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400">Total value</p>
              <p className="font-semibold tabular">{c.currency} {(c.totalValue ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total paid</p>
              <p className="font-semibold tabular text-green-600">{c.currency} {(c.totalPaid ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Balance</p>
              <p className={cn('font-semibold tabular', (c.totalBalance ?? 0) > 0 ? 'text-amber-600' : 'text-green-600')}>
                {c.currency} {(c.totalBalance ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
