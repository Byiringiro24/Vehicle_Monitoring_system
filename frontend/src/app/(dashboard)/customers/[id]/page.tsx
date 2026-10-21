'use client';
import { useQuery } from '@tanstack/react-query';
import { apiClient, agreementApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Phone, Mail, MapPin, CreditCard,
  FileText, User, Calendar, Star, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CREDIT_BADGE: Record<string, string> = {
  GOOD:        'bg-green-100 text-green-800',
  FAIR:        'bg-yellow-100 text-yellow-800',
  POOR:        'bg-red-100 text-red-800',
  BLACKLISTED: 'bg-red-200 text-red-900',
};

const AG_STATUS: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-700',
  ACTIVE:   'bg-green-100 text-green-800',
  COMPLETED:'bg-blue-100 text-blue-800',
  DEFAULTED:'bg-red-100 text-red-800',
  TERMINATED:'bg-red-100 text-red-700',
};

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', params.id],
    queryFn:  () => apiClient.get(`/contracts/customers/${params.id}`).then(r => r.data),
  });

  const { data: agData } = useQuery({
    queryKey: ['customer-agreements', params.id],
    queryFn:  () => agreementApi.list({ customerId: params.id, limit: 100 }),
    enabled:  !!params.id,
  });

  const agreements = agData?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-36 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!customer) return (
    <div className="text-center py-20 text-gray-400">
      <User size={40} className="mx-auto mb-3 opacity-20" />
      <p>Customer not found</p>
      <Link href="/customers" className="mt-4 text-brand-600 text-sm hover:underline inline-block">← Back to customers</Link>
    </div>
  );

  const totalPaid      = agreements.reduce((s: number, a: any) => s + a.totalPaid, 0);
  const activeAgreements = agreements.filter((a: any) => a.status === 'ACTIVE').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/customers" className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500 shrink-0">
          <ArrowLeft size={16} />
        </Link>
        <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-lg shrink-0">
          {customer.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CREDIT_BADGE[customer.creditStatus] ?? 'bg-gray-100')}>
            {customer.creditStatus} · Score {customer.creditScore}
          </span>
        </div>
      </div>

      {/* Contact + Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-2">Contact</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-gray-800">
              <Phone size={13} className="text-gray-400" /> {customer.phone}
            </div>
            {customer.altPhone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone size={13} className="text-gray-400" /> {customer.altPhone}
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail size={13} className="text-gray-400" />
                <span className="truncate">{customer.email}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-2">Location</p>
          <div className="flex items-center gap-2 text-sm text-gray-800">
            <MapPin size={13} className="text-gray-400" />
            {customer.city ? `${customer.city}${customer.district ? ', ' + customer.district : ''}` : 'Not set'}
          </div>
          {customer.address && <p className="text-xs text-gray-400 mt-1">{customer.address}</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Collected</p>
          <p className="text-lg font-bold text-green-700">RWF {totalPaid.toLocaleString()}</p>
          <p className="text-xs text-gray-400">{agreements.length} agreement{agreements.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Active Agreements</p>
          <p className="text-lg font-bold text-blue-700">{activeAgreements}</p>
          <p className="text-xs text-gray-400">Customer since {formatDate(customer.createdAt)}</p>
        </div>
      </div>

      {/* Identity */}
      {(customer.nationalId || customer.occupation || customer.employer || customer.emergencyContact) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Identity & Employment</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {customer.nationalId && (
              <div><p className="text-gray-400 text-xs">National ID</p><p className="font-medium">{customer.nationalId}</p></div>
            )}
            {customer.occupation && (
              <div><p className="text-gray-400 text-xs">Occupation</p><p className="font-medium">{customer.occupation}</p></div>
            )}
            {customer.employer && (
              <div><p className="text-gray-400 text-xs">Employer</p><p className="font-medium">{customer.employer}</p></div>
            )}
            {customer.emergencyContact && (
              <div>
                <p className="text-gray-400 text-xs">Emergency Contact</p>
                <p className="font-medium">{customer.emergencyContact}</p>
                {customer.emergencyPhone && <p className="text-xs text-gray-400">{customer.emergencyPhone}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agreements */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Agreements ({agreements.length})</h3>
          <Link href={`/agreements?customerId=${params.id}`}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
            View all <ChevronRight size={13} />
          </Link>
        </div>
        {agreements.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            <FileText size={28} className="mx-auto mb-2 opacity-20" />
            No agreements yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {agreements.map((a: any) => (
              <div key={a.id}
                onClick={() => router.push(`/agreements/${a.id}`)}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition cursor-pointer">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <FileText size={15} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{a.title}</p>
                  <p className="text-xs text-gray-400">
                    {a.vehicle.licensePlate} · {a.currency} {a.rateAmount.toLocaleString()} / {a.ratePeriod}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', AG_STATUS[a.status] ?? 'bg-gray-100')}>
                    {a.status}
                  </span>
                  <p className="text-xs text-green-700 mt-0.5">Paid: {a.currency} {a.totalPaid.toLocaleString()}</p>
                </div>
                <ChevronRight size={15} className="text-gray-300 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {customer.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Notes</p>
          <p className="text-sm text-gray-800">{customer.notes}</p>
        </div>
      )}
    </div>
  );
}
