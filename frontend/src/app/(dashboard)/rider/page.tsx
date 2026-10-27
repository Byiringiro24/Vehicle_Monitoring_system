'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Bike, DollarSign, Calendar, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, TrendingDown, ArrowRight, FileText,
} from 'lucide-react';

type TabId = 'today' | 'history' | 'agreement';

export default function RiderPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('today');
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  // Fetch driver profile (rider uses driver model)
  const { data: driverList = [] } = useQuery({
    queryKey: ['my-driver-profile'],
    queryFn: () => apiClient.get('/drivers').then(r => r.data ?? []),
  });

  // Find the current user's driver profile
  const myProfile = (driverList as any[]).find((d: any) => d.userId === user?.id);
  const assignedVehicle = myProfile?.currentVehicle;

  // Fetch contracts for this driver
  const { data: contractsData } = useQuery({
    queryKey: ['rider-contracts'],
    queryFn: () => apiClient.get('/contracts/contracts?limit=20').then(r => r.data),
    enabled: !!myProfile,
  });
  const contracts: any[] = contractsData?.data ?? contractsData ?? [];
  const activeContract = contracts.find((c: any) => c.status === 'ACTIVE' && c.driverId === myProfile?.id);

  // Driver payments (remittances)
  const { data: payments = [] } = useQuery({
    queryKey: ['rider-payments'],
    queryFn: () => apiClient.get('/financial/driver-payments').then(r => r.data ?? []),
    enabled: !!myProfile,
  });

  const today = new Date();
  const thisMonth = (payments as any[]).find((p: any) =>
    p.month === today.getMonth() + 1 && p.year === today.getFullYear()
  );

  const dailyObligation = activeContract?.periodicAmount ?? 0;
  const paidToday = 0; // would come from daily tracking — show 0 for now
  const remaining = Math.max(0, dailyObligation - paidToday);

  const recordPayment = useMutation({
    mutationFn: () => {
      if (!myProfile) throw new Error('No driver profile');
      return apiClient.post('/financial/driver-payments', {
        driverId: myProfile.id,
        month: today.getMonth() + 1,
        year: today.getFullYear(),
        paidAmount: Number(payAmount),
      }).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rider-payments'] });
      toast.success(`Payment of RWF ${Number(payAmount).toLocaleString()} recorded`);
      setPayAmount('');
      setPaying(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to record payment'),
  });

  // Generate week calendar (Mon–Sun)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);
  const weekDates = weekDays.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  if (!myProfile) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rider Portal</h1>
          <p className="text-gray-500 text-sm mt-0.5">Your motorcycle and remittance dashboard</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Bike size={36} className="text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-900">No rider profile found</p>
          <p className="text-sm text-amber-700 mt-1">
            You need to be assigned as a driver/rider by a company to access this portal.
            Contact your fleet manager or the company that invited you.
          </p>
          <a href="/support" className="mt-4 inline-flex items-center gap-1.5 text-sm text-amber-700 font-medium hover:underline">
            Contact support <ArrowRight size={13} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rider Portal</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Good {today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening'}, {user?.firstName} ·{' '}
          {formatDate(today)}
        </p>
      </div>

      {/* Assigned motorcycle card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
            <Bike size={22} className="text-brand-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900">
              {assignedVehicle ? `${assignedVehicle.licensePlate} · ${assignedVehicle.name}` : 'No vehicle assigned'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {assignedVehicle
                ? `${assignedVehicle.manufacturer ?? ''} ${assignedVehicle.model ?? ''} ${assignedVehicle.year ?? ''}`.trim()
                : 'Contact your fleet manager'}
            </p>
          </div>
          {assignedVehicle && (
            <span className={cn('ml-auto text-xs px-2 py-0.5 rounded-full font-medium',
              assignedVehicle.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
              assignedVehicle.status === 'IDLE'   ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-gray-100 text-gray-500')}>
              {assignedVehicle.status ?? 'OFFLINE'}
            </span>
          )}
        </div>

        {/* Remittance today */}
        {dailyObligation > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Today's obligation</p>
              <p className="text-lg font-bold text-gray-900 tabular">RWF {dailyObligation.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Paid today</p>
              <p className="text-lg font-bold text-green-600 tabular">RWF {paidToday.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Remaining</p>
              <p className={cn('text-lg font-bold tabular', remaining > 0 ? 'text-amber-600' : 'text-green-600')}>
                RWF {remaining.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Record payment button */}
        {dailyObligation > 0 && !paying && (
          <button onClick={() => setPaying(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2.5 rounded-xl transition">
            <DollarSign size={14} /> Record remittance payment
          </button>
        )}

        {paying && (
          <div className="mt-4 flex gap-2">
            <input
              type="number"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              placeholder="Amount (RWF)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={() => recordPayment.mutate()}
              disabled={!payAmount || recordPayment.isPending}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-60">
              {recordPayment.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setPaying(false)}
              className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([['today','This Week'],['history','History'],['agreement','Agreement']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as TabId)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition',
              tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {label}
          </button>
        ))}
      </div>

      {/* This week tab */}
      {tab === 'today' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="font-semibold text-gray-800 mb-4">Weekly remittance tracker</p>
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              const isPast  = d < today && !isToday;
              return (
                <div key={i} className={cn('rounded-xl p-2 text-center border transition',
                  isToday ? 'border-brand-400 bg-brand-50' :
                  isPast  ? 'border-gray-100 bg-gray-50' :
                            'border-gray-100 bg-white')}>
                  <p className="text-[10px] text-gray-400">{weekDays[i]}</p>
                  <p className={cn('text-xs font-semibold mt-0.5',
                    isToday ? 'text-brand-700' : 'text-gray-700')}>
                    {d.getDate()}
                  </p>
                  <div className="mt-1.5 flex items-center justify-center">
                    {isPast
                      ? <CheckCircle2 size={12} className="text-green-400" />
                      : isToday
                      ? <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                      : <div className="w-2 h-2 bg-gray-200 rounded-full" />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-green-500" />
              <div>
                <p className="text-xs text-gray-400">This month paid</p>
                <p className="font-semibold text-gray-900 tabular">
                  RWF {(thisMonth?.paidAmount ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown size={15} className="text-amber-500" />
              <div>
                <p className="text-xs text-gray-400">Expected</p>
                <p className="font-semibold text-gray-900 tabular">
                  RWF {(thisMonth?.expectedAmount ?? dailyObligation * 26).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {(payments as any[]).length === 0 ? (
            <div className="p-8 text-center">
              <Clock size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No payment history yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>{['Month','Expected','Paid','Difference','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(payments as any[]).map((p: any) => {
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{months[p.month - 1]} {p.year}</td>
                      <td className="px-4 py-3 text-sm tabular text-gray-700">RWF {(p.expectedAmount ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm tabular text-green-600 font-medium">RWF {(p.paidAmount ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm tabular">
                        <span className={cn('font-medium', (p.difference ?? 0) >= 0 ? 'text-green-600' : 'text-red-500')}>
                          {(p.difference ?? 0) >= 0 ? '+' : ''}RWF {(p.difference ?? 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                          p.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          p.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600')}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Agreement tab */}
      {tab === 'agreement' && (
        <div className="space-y-3">
          {activeContract ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
                  <FileText size={18} className="text-teal-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Active Agreement</p>
                  <p className="text-xs text-gray-400">#{activeContract.contractNumber?.slice(0, 12)}</p>
                </div>
                <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">ACTIVE</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                {[
                  { label: 'Type',            value: activeContract.contractType?.replace(/_/g,' ') },
                  { label: 'Periodic amount', value: `RWF ${(activeContract.periodicAmount ?? 0).toLocaleString()}` },
                  { label: 'Start date',      value: formatDate(activeContract.startDate) },
                  { label: 'End date',        value: activeContract.endDate ? formatDate(activeContract.endDate) : 'Ongoing' },
                  { label: 'Total value',     value: `RWF ${(activeContract.totalValue ?? 0).toLocaleString()}` },
                  { label: 'Balance due',     value: `RWF ${(activeContract.totalBalance ?? 0).toLocaleString()}` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <FileText size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="font-semibold text-gray-600">No active agreement</p>
              <p className="text-sm text-gray-400 mt-1">Contact your fleet manager if you believe this is an error.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
