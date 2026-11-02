'use client';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useParams } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { Truck, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function InvoicePage() {
  const params = useParams();
  const { user } = useAuthStore();
  const invoiceId = params.id as string;

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiClient.get('/invoices?limit=100').then(r => r.data?.data ?? r.data ?? []),
  });

  const invoice = (invoices as any[]).find((i: any) => i.id === invoiceId);

  if (!invoice) {
    return (
      <div className="max-w-2xl">
        <Link href="/finance" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline mb-4">
          <ArrowLeft size={14} /> Back to Finance
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="font-semibold text-gray-600">Invoice not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between no-print">
        <Link href="/finance" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to Finance
        </Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition shadow-sm">
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      {/* Invoice document */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 print:border-0 print:shadow-none" id="invoice-print">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
                <Truck size={18} className="text-white" />
              </div>
              <div>
                <p className="font-black text-lg text-gray-900">ARTIC<span className="text-brand-600">.</span>VMS</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Vehicle Monitoring System</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{user?.organization?.name ?? 'ARTIC VMS'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Invoice</p>
            <p className="text-xl font-bold text-gray-900 font-mono">{invoice.invoiceNumber}</p>
            <p className="text-xs text-gray-500 mt-1">Issued: {formatDate(invoice.createdAt)}</p>
            {invoice.dueDate && <p className="text-xs text-gray-500">Due: {formatDate(invoice.dueDate)}</p>}
          </div>
        </div>

        {/* Bill to */}
        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
            <p className="font-semibold text-gray-900">{invoice.customer?.name ?? 'Customer'}</p>
            <p className="text-sm text-gray-500">{invoice.customer?.email ?? ''}</p>
            <p className="text-sm text-gray-500">{invoice.customer?.phone ?? ''}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Status</p>
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
              invoice.status === 'PAID' ? 'bg-green-100 text-green-700' :
              invoice.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
              'bg-amber-100 text-amber-700'}`}>
              {invoice.status}
            </span>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full border-t border-gray-200">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</th>
              <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-4 text-sm text-gray-700">{invoice.description ?? 'Vehicle services'}</td>
              <td className="py-4 text-sm font-semibold text-gray-900 tabular text-right">{invoice.currency} {(invoice.amount ?? 0).toLocaleString()}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200">
              <td className="py-4 text-right text-sm font-bold text-gray-900">Total</td>
              <td className="py-4 text-lg font-bold text-gray-900 tabular text-right">{invoice.currency} {(invoice.amount ?? 0).toLocaleString()}</td>
            </tr>
            {(invoice.balance ?? 0) > 0 && invoice.status !== 'PAID' && (
              <tr>
                <td className="py-2 text-right text-sm font-medium text-amber-600">Balance Due</td>
                <td className="py-2 text-sm font-bold text-amber-600 tabular text-right">{invoice.currency} {(invoice.balance ?? 0).toLocaleString()}</td>
              </tr>
            )}
          </tfoot>
        </table>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            This invoice was generated by ARTIC VMS · Vehicle Monitoring System<br />
            {user?.organization?.name ?? ''} · {formatDate(new Date())}
          </p>
          <p className="text-xs text-gray-300 mt-2">
            For questions about this invoice, contact your fleet manager or visit articvms.ddnsgeek.com/support
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print, #invoice-print * { visibility: visible; }
          #invoice-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
