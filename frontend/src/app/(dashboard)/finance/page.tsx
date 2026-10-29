'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialApi, contractApi, expenseApi, apiClient } from '@/lib/api';
import { format, subDays } from 'date-fns';
import { DollarSign, Plus, TrendingUp, TrendingDown, AlertCircle,
  CheckCircle, Clock, Shield, FileText, Fuel, Wrench, Receipt,
  BarChart3, Users2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type FinTab = 'dashboard' | 'contracts' | 'expenses' | 'invoices' | 'statements';

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

// â”€â”€â”€ Finance Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        <KpiCard label="Today's Income"   value={isLoading ? 'â€¦' : fmt(t.income)}   icon={<TrendingUp size={20} />}  color="border-green-200" />
        <KpiCard label="Today's Expenses" value={isLoading ? 'â€¦' : fmt(t.expenses)} icon={<TrendingDown size={20} />} color="border-red-200" />
        <KpiCard label="Today's Profit"   value={isLoading ? 'â€¦' : fmt(t.profit)}   icon={<DollarSign size={20} />}
          color={(t.profit??0)>=0 ? 'border-blue-200' : 'border-red-300'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Monthly Income"   value={isLoading ? 'â€¦' : fmt(m.income)}   icon={<TrendingUp size={20} />}  color="border-green-200" />
        <KpiCard label="Monthly Expenses" value={isLoading ? 'â€¦' : fmt(m.expenses)} icon={<TrendingDown size={20} />} color="border-red-200" />
        <KpiCard label="Monthly Profit"   value={isLoading ? 'â€¦' : fmt(m.profit)}   icon={<DollarSign size={20} />}
          color={(m.profit??0)>=0 ? 'border-blue-200' : 'border-red-300'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Outstanding Balance" value={isLoading ? 'â€¦' : fmt(data?.outstanding)}
          sub={`${data?.overdueCount ?? 0} overdue`} icon={<AlertCircle size={20} />} color="border-yellow-200" />
        <KpiCard label="Due Today"     value={isLoading ? 'â€¦' : `${data?.dueTodayCount ?? 0} payments`}
          icon={<Clock size={20} />} color="border-orange-200" />
        <KpiCard label="Maintenance"   value={isLoading ? 'â€¦' : fmt(s.maintenance)}
          sub="this month" icon={<Wrench size={20} />} color="border-gray-200" />
        <KpiCard label="Fuel Cost"     value={isLoading ? 'â€¦' : fmt(s.fuel)}
          sub="this month" icon={<Fuel size={20} />} color="border-gray-200" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Insurance Expiring" value={`${c.insuranceExpiring ?? 0} vehicles`}
          sub="within 30 days" icon={<Shield size={20} />} color="border-red-200" />
        <KpiCard label="Road Tax Expiring"  value={`${c.roadTaxExpiring ?? 0} vehicles`}
          sub="within 30 days" icon={<FileText size={20} />} color="border-orange-200" />
        <KpiCard label="Net Business Value" value={isLoading ? 'â€¦' : fmt(data?.netBusinessValue)}
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

// â”€â”€â”€ Contracts Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                      <option value="">Selectâ€¦</option>
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
                {createMutation.isPending ? 'Savingâ€¦' : 'Create Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Expenses Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                <td className="px-3 py-2 text-xs text-gray-500">{e.supplier ?? 'â€”'}</td>
                <td className="px-3 py-2 text-sm font-bold text-red-700">{e.amount.toLocaleString()} RWF</td>
                <td className="px-3 py-2">
                  <button onClick={() => { if (confirm('Delete this expense?')) deleteMutation.mutate(e.id); }}
                    className="text-xs text-gray-400 hover:text-red-600 transition">âœ•</button>
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
                {createMutation.isPending ? 'Savingâ€¦' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Invoices Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function InvoicesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerId: '', vehicleId: '', description: '',
    amount: '', currency: 'RWF', dueDate: format(new Date(Date.now() + 7*86400000), 'yyyy-MM-dd'),
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiClient.get('/invoices?limit=100').then(r => r.data?.data ?? r.data ?? []),
  });
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => contractApi.customers() });

  const createMutation = useMutation({
    mutationFn: () => apiClient.post('/invoices', { ...form, amount: parseFloat(form.amount) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice created'); setShowForm(false); setForm({ customerId:'', vehicleId:'', description:'', amount:'', currency:'RWF', dueDate: format(new Date(Date.now()+7*86400000),'yyyy-MM-dd') }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const markPaid = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/invoices/${id}/mark-paid`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Marked as paid'); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const STATUS_COLORS: Record<string, string> = {
    DRAFT:    'bg-gray-100 text-gray-600',
    SENT:     'bg-blue-100 text-blue-700',
    PAID:     'bg-green-100 text-green-700',
    OVERDUE:  'bg-red-100 text-red-700',
    CANCELLED:'bg-gray-100 text-gray-400',
  };

  const rows: any[] = invoices as any[];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-800">Invoices</h2>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={15} /> New Invoice
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total invoiced',  value: rows.reduce((s,r) => s+(r.amount??0), 0), color: 'text-gray-900' },
          { label: 'Paid',            value: rows.filter(r=>r.status==='PAID').reduce((s,r) => s+(r.amount??0), 0), color: 'text-green-600' },
          { label: 'Outstanding',     value: rows.filter(r=>r.status!=='PAID'&&r.status!=='CANCELLED').reduce((s,r) => s+(r.amount??0), 0), color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-xs p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-xl font-bold tabular mt-0.5 ${color}`}>RWF {value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-2">{[1,2,3].map(i=><div key={i} className="h-8 bg-gray-100 rounded animate-pulse"/>)}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>{['Invoice','Customer','Description','Amount','Due','Status',''].map(h=>
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-mono text-gray-500">#{inv.invoiceNumber ?? inv.id?.slice(0,8).toUpperCase()}</td>
                  <td className="px-3 py-2 text-sm">{inv.customer?.name ?? inv.customerId?.slice(0,8)}</td>
                  <td className="px-3 py-2 text-sm text-gray-600 max-w-[180px] truncate">{inv.description}</td>
                  <td className="px-3 py-2 text-sm font-bold tabular">{inv.currency} {(inv.amount??0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{inv.dueDate ? format(new Date(inv.dueDate),'dd MMM yy') : 'â€”'}</td>
                  <td className="px-3 py-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600')}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                      <button onClick={() => markPaid.mutate(inv.id)}
                        className="text-xs text-green-600 hover:text-green-700 font-medium hover:underline whitespace-nowrap">
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No invoices yet. Create your first invoice above.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">New Invoice</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer *</label>
                <select value={form.customerId} onChange={e => setForm(p=>({...p, customerId:e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select customerâ€¦</option>
                  {((customers?.data ?? []) as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                <input value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}
                  placeholder="e.g. Monthly vehicle rental â€” October 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount (RWF) *</label>
                  <input type="number" value={form.amount} onChange={e => setForm(p=>({...p,amount:e.target.value}))}
                    placeholder="450000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Due date *</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(p=>({...p,dueDate:e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.customerId || !form.description || !form.amount || createMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {createMutation.isPending ? 'Creatingâ€¦' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Owner Statements Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatementsTab() {
  const { data: statementsData, isLoading } = useQuery({
    queryKey: ['owner-statements-finance'],
    queryFn: () => apiClient.get('/owner/statements?months=6').then(r => r.data),
  });

  const statements: any[] = statementsData?.statements ?? [];
  const vehicles: any[]   = statementsData?.vehicles ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-gray-800">Owner Statements</h2>
        <p className="text-sm text-gray-500 mt-0.5">Monthly income/expense/net breakdown for vehicle owners.</p>
      </div>

      {vehicles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {vehicles.map((v: any) => (
            <span key={v.id} className="text-xs bg-brand-50 text-brand-700 border border-brand-200 px-3 py-1 rounded-full font-medium">
              {v.licensePlate} â€” {v.name}
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : statements.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <BarChart3 size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No owner statements available</p>
          <p className="text-sm text-gray-400 mt-1">
            Statements appear here once vehicles are registered under your ownership.
            Use the <strong>My Vehicles</strong> page to claim vehicle ownership.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>{['Month','Income','Expenses','Net'].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statements.map((s: any) => (
                <tr key={s.month} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.month}</td>
                  <td className="px-4 py-3 text-sm font-semibold tabular text-green-600">RWF {(s.income??0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm tabular text-red-500">RWF {(s.expense??0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-bold tabular">
                    <span className={(s.net??0) >= 0 ? 'text-teal-600' : 'text-red-600'}>
                      RWF {(s.net??0).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Main Finance Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function FinancePage() {
  const [tab, setTab] = useState<FinTab>('dashboard');
  const TABS = [
    { id: 'dashboard'  as FinTab, label: 'Dashboard',  icon: <DollarSign size={14} /> },
    { id: 'contracts'  as FinTab, label: 'Contracts',  icon: <FileText size={14} /> },
    { id: 'expenses'   as FinTab, label: 'Expenses',   icon: <Receipt size={14} /> },
    { id: 'invoices'   as FinTab, label: 'Invoices',   icon: <BarChart3 size={14} /> },
    { id: 'statements' as FinTab, label: 'Statements', icon: <Users2 size={14} /> },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <p className="text-gray-500 text-sm">Vehicle Asset &amp; Financial Management</p>
      </div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
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
      {tab === 'dashboard'  && <FinanceDashboard />}
      {tab === 'contracts'  && <ContractsTab />}
      {tab === 'expenses'   && <ExpensesTab />}
      {tab === 'invoices'   && <InvoicesTab />}
      {tab === 'statements' && <StatementsTab />}
    </div>
  );
}
