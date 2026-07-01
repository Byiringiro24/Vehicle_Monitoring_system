'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialApi, contractApi, expenseApi } from '@/lib/api';
import { format, subDays } from 'date-fns';
import { DollarSign, Plus, TrendingUp, TrendingDown, AlertCircle,
  CheckCircle, Clock, Shield, FileText, Fuel, Wrench, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type FinTab = 'dashboard' | 'contracts' | 'expenses' | 'payments';

const EXPENSE_CATEGORIES = [
  'MAINTENANCE','FUEL','INSURANCE','ROAD_TAX','INSPECTION',
  'PERMIT','FINE','ACCIDENT_REPAIR','TYRE','BATTERY','GPS_SIM',
  'PARKING','TOWING','CLEANING','SALARY','COMMISSION','OTHER',
];

const CONTRACT_TYPES = [
  'RENTAL_DAILY','RENTAL_WEEKLY','RENTAL_MONTHLY','RENTAL_QUARTERLY',
  'RENTAL_YEARLY','LEASE','INSTALLMENT_SALE','HIRE_PURCHASE',
  'DRIVER_DAILY_SUBMISSION','CUSTOM',
];

function KpiCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className={cn('bg-white rounded-xl p-4 border shadow-sm flex items-center gap-4', color)}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-current/10 text-current shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Finance Dashboard ────────────────────────────────────────────────────────
function FinanceDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['fin-dash-main'],
    queryFn: () => financialApi.dashboard(),
    refetchInterval: 60000,
  });
  const fmt = (n: number) => `${(n ?? 0).toLocaleString('en-RW')} RWF`;
  const t = data?.today ?? {};
  const m = data?.month ?? {};
  const c = data?.compliance ?? {};
  const s = data?.monthlyStats ?? {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Today's Income"   value={isLoading ? '…' : fmt(t.income)}   icon={<TrendingUp size={20} />}  color="border-green-200" />
        <KpiCard label="Today's Expenses" value={isLoading ? '…' : fmt(t.expenses)} icon={<TrendingDown size={20} />} color="border-red-200" />
        <KpiCard label="Today's Profit"   value={isLoading ? '…' : fmt(t.profit)}   icon={<DollarSign size={20} />}
          color={(t.profit??0)>=0 ? 'border-blue-200' : 'border-red-300'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Monthly Income"   value={isLoading ? '…' : fmt(m.income)}   icon={<TrendingUp size={20} />}  color="border-green-200" />
        <KpiCard label="Monthly Expenses" value={isLoading ? '…' : fmt(m.expenses)} icon={<TrendingDown size={20} />} color="border-red-200" />
        <KpiCard label="Monthly Profit"   value={isLoading ? '…' : fmt(m.profit)}   icon={<DollarSign size={20} />}
          color={(m.profit??0)>=0 ? 'border-blue-200' : 'border-red-300'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Outstanding Balance" value={isLoading ? '…' : fmt(data?.outstanding)}
          sub={`${data?.overdueCount ?? 0} overdue`} icon={<AlertCircle size={20} />} color="border-yellow-200" />
        <KpiCard label="Due Today"     value={isLoading ? '…' : `${data?.dueTodayCount ?? 0} payments`}
          icon={<Clock size={20} />} color="border-orange-200" />
        <KpiCard label="Maintenance"   value={isLoading ? '…' : fmt(s.maintenance)}
          sub="this month" icon={<Wrench size={20} />} color="border-gray-200" />
        <KpiCard label="Fuel Cost"     value={isLoading ? '…' : fmt(s.fuel)}
          sub="this month" icon={<Fuel size={20} />} color="border-gray-200" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Insurance Expiring" value={`${c.insuranceExpiring ?? 0} vehicles`}
          sub="within 30 days" icon={<Shield size={20} />} color="border-red-200" />
        <KpiCard label="Road Tax Expiring"  value={`${c.roadTaxExpiring ?? 0} vehicles`}
          sub="within 30 days" icon={<FileText size={20} />} color="border-orange-200" />
        <KpiCard label="Net Business Value" value={isLoading ? '…' : fmt(data?.netBusinessValue)}
          sub="vehicle assets" icon={<TrendingUp size={20} />} color="border-purple-200" />
      </div>
      {/* Top customers */}
      {(data?.topCustomers?.length > 0) && (
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" /> Top Paying Customers (This Month)
          </h3>
          <div className="space-y-2">
            {data.topCustomers.slice(0, 5).map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.customer?.name ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{c.customer?.phone ?? ''}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-green-700">{fmt(c._sum?.amount ?? 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Contracts Tab ────────────────────────────────────────────────────────────
function ContractsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    vehicleId: '', customerId: '', contractType: 'RENTAL_MONTHLY',
    startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '',
    totalValue: '', periodicAmount: '', depositAmount: '0', notes: '',
  });

  const { data: contracts } = useQuery({ queryKey: ['contracts'], queryFn: () => contractApi.list() });
  const { data: customers  } = useQuery({ queryKey: ['customers'],  queryFn: () => contractApi.customers() });

  const createMutation = useMutation({
    mutationFn: () => contractApi.create({
      ...form,
      totalValue:      parseFloat(form.totalValue),
      periodicAmount:  parseFloat(form.periodicAmount),
      depositAmount:   parseFloat(form.depositAmount),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); toast.success('Contract created'); setShowForm(false); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const rows = contracts?.data ?? [];
  const statusColor = (s: string) => ({
    ACTIVE:'bg-green-100 text-green-800', COMPLETED:'bg-blue-100 text-blue-800',
    DEFAULTED:'bg-red-100 text-red-800',  TERMINATED:'bg-gray-100 text-gray-700',
    PENDING:'bg-yellow-100 text-yellow-800',
  }[s] ?? 'bg-gray-100 text-gray-700');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-800">Contracts</h2>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={15} /> New Contract
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>{['#','Vehicle','Customer','Type','Value','Paid','Balance','Status'].map(h =>
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((c: any, i: number) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-400">{i+1}</td>
                <td className="px-3 py-2 text-sm font-mono font-bold">{c.vehicle?.licensePlate}</td>
                <td className="px-3 py-2 text-sm">{c.customer?.name}</td>
                <td className="px-3 py-2 text-xs">{c.contractType.replace(/_/g,' ')}</td>
                <td className="px-3 py-2 text-sm font-medium">{(c.totalValue??0).toLocaleString()}</td>
                <td className="px-3 py-2 text-sm text-green-700">{(c.totalPaid??0).toLocaleString()}</td>
                <td className="px-3 py-2 text-sm text-red-700">{(c.totalBalance??0).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor(c.status))}>{c.status}</span>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">No contracts yet</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">New Contract</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Type', key: 'contractType', type: 'select', opts: CONTRACT_TYPES },
                { label: 'Customer', key: 'customerId', type: 'select', opts: [], custOpts: (customers?.data ?? []).map((c: any) => ({ value: c.id, label: c.name })) },
                { label: 'Start Date', key: 'startDate', type: 'date' },
                { label: 'End Date',   key: 'endDate',   type: 'date' },
                { label: 'Total Value (RWF)', key: 'totalValue',     type: 'number' },
                { label: 'Periodic Amount',   key: 'periodicAmount', type: 'number' },
                { label: 'Deposit (RWF)',      key: 'depositAmount', type: 'number' },
              ].map(({ label, key, type, opts, custOpts }) => (
                <div key={key} className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  {type === 'select' ? (
                    <select value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                      <option value="">Select…</option>
                      {custOpts ? custOpts.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)
                               : (opts ?? []).map((o: string) => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
                    </select>
                  ) : (
                    <input type={type} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  )}
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {createMutation.isPending ? 'Saving…' : 'Create Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────
function ExpensesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    vehicleId: '', category: 'FUEL', amount: '', description: '',
    date: format(new Date(), 'yyyy-MM-dd'), supplier: '', invoiceNumber: '',
    litres: '', pricePerLitre: '', maintenanceType: '', fineNumber: '', fineReason: '',
  });
  const { data: expenses } = useQuery({ queryKey: ['expenses-list'], queryFn: () => expenseApi.list({ limit: 100 }) });

  const createMutation = useMutation({
    mutationFn: () => expenseApi.create({ ...form, amount: parseFloat(form.amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses-list'] }); toast.success('Expense recorded'); setShowForm(false); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: expenseApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses-list'] }); toast.success('Deleted'); },
  });

  const rows = expenses?.data ?? [];

  const catColor: Record<string, string> = {
    FUEL:'bg-blue-100 text-blue-800', MAINTENANCE:'bg-orange-100 text-orange-800',
    INSURANCE:'bg-purple-100 text-purple-800', FINE:'bg-red-100 text-red-800',
    ROAD_TAX:'bg-yellow-100 text-yellow-800', TYRE:'bg-green-100 text-green-800',
    GPS_SIM:'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-800">Vehicle Expenses</h2>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={15} /> Record Expense
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>{['Date','Vehicle','Category','Description','Supplier','Amount',''].map(h =>
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-500">{format(new Date(e.date), 'dd MMM yy')}</td>
                <td className="px-3 py-2 text-xs font-mono font-bold">{e.vehicle?.licensePlate}</td>
                <td className="px-3 py-2">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', catColor[e.category] ?? 'bg-gray-100 text-gray-700')}>
                    {e.category.replace(/_/g,' ')}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm max-w-48 truncate">{e.description}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{e.supplier ?? '—'}</td>
                <td className="px-3 py-2 text-sm font-bold text-red-700">{e.amount.toLocaleString()} RWF</td>
                <td className="px-3 py-2">
                  <button onClick={() => { if (confirm('Delete this expense?')) deleteMutation.mutate(e.id); }}
                    className="text-xs text-gray-400 hover:text-red-600 transition">✕</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No expenses recorded yet</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">Record Expense</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Category', key: 'category', type: 'select', opts: EXPENSE_CATEGORIES },
                { label: 'Date',     key: 'date',     type: 'date' },
                { label: 'Amount (RWF)', key: 'amount', type: 'number' },
                { label: 'Supplier', key: 'supplier', type: 'text' },
                { label: 'Invoice #', key: 'invoiceNumber', type: 'text' },
              ].map(({ label, key, type, opts }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  {type === 'select' ? (
                    <select value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                      {(opts ?? []).map((o: string) => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
                    </select>
                  ) : (
                    <input type={type} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  )}
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Oil change at Total Rubis Kigali"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              {form.category === 'FUEL' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Litres</label>
                    <input type="number" value={form.litres} onChange={e => setForm(p => ({ ...p, litres: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Price/Litre</label>
                    <input type="number" value={form.pricePerLitre} onChange={e => setForm(p => ({ ...p, pricePerLitre: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  </div>
                </>
              )}
              {form.category === 'FINE' && (
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fine Number</label>
                    <input value={form.fineNumber} onChange={e => setForm(p => ({ ...p, fineNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                    <input value={form.fineReason} onChange={e => setForm(p => ({ ...p, fineReason: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {createMutation.isPending ? 'Saving…' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Finance Page ────────────────────────────────────────────────────────
export default function FinancePage() {
  const [tab, setTab] = useState<FinTab>('dashboard');
  const TABS = [
    { id: 'dashboard' as FinTab, label: 'Dashboard',  icon: <DollarSign size={14} /> },
    { id: 'contracts' as FinTab, label: 'Contracts',  icon: <FileText size={14} /> },
    { id: 'expenses'  as FinTab, label: 'Expenses',   icon: <Receipt size={14} /> },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <p className="text-gray-500 text-sm">Vehicle Asset &amp; Financial Management</p>
      </div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition',
              tab === t.id ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-gray-700'
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <FinanceDashboard />}
      {tab === 'contracts' && <ContractsTab />}
      {tab === 'expenses'  && <ExpensesTab />}
    </div>
  );
}
