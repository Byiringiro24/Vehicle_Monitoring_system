'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ShoppingCart, Truck, MessageSquare, DollarSign, ArrowRight, Plus, CheckCircle2 } from 'lucide-react';

export default function SellerPage() {
  const { user } = useAuthStore();

  const { data: vehiclesData } = useQuery({
    queryKey: ['seller-vehicles'],
    queryFn: () => apiClient.get('/vehicles?limit=50').then(r => r.data),
  });
  const vehicles: any[] = vehiclesData?.data ?? vehiclesData ?? [];
  const forSale = vehicles.filter((v: any) =>
    v.status === 'AVAILABLE' || v.vehiclePurpose === 'PERSONAL'
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Sales</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your vehicle listings, inquiries and sales orders.</p>
        </div>
        <Link href="/vehicles"
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition shadow-sm">
          <Plus size={14} /> Add listing
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total vehicles',    value: vehicles.length,  icon: <Truck size={15} className="text-brand-600" />,        bg: 'bg-brand-50',  border: 'border-brand-200' },
          { label: 'Available',          value: vehicles.filter(v => v.status === 'AVAILABLE').length, icon: <CheckCircle2 size={15} className="text-green-600" />, bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'Active agreements',  value: 0,                icon: <ShoppingCart size={15} className="text-purple-600" />, bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: 'Revenue',            value: 'RWF 0',          icon: <DollarSign size={15} className="text-teal-600" />,    bg: 'bg-teal-50',   border: 'border-teal-200' },
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

      {/* Listings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Your Listings</h2>
          <Link href="/vehicles" className="text-xs text-brand-600 hover:underline">
            Manage all vehicles →
          </Link>
        </div>
        {vehicles.length === 0 ? (
          <div className="p-10 text-center">
            <Truck size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-600">No vehicles registered yet</p>
            <p className="text-sm text-gray-400 mt-1">Add vehicles from the Vehicles page to list them for sale.</p>
            <Link href="/vehicles" className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
              Go to Vehicles <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 border-b">
                <tr>{['Vehicle','Type','Status','Year','Purchase Price','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehicles.map((v: any) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{v.licensePlate}</p>
                      <p className="text-xs text-gray-400">{v.name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.vehicleClass?.replace(/_/g,' ') ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                        v.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                        v.status === 'ACTIVE'    ? 'bg-blue-100 text-blue-700' :
                                                   'bg-gray-100 text-gray-500')}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 tabular">{v.year}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 tabular">
                      {v.purchasePrice ? `RWF ${v.purchasePrice.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/vehicles/${v.id}`}
                        className="text-xs text-brand-600 hover:underline font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inquiries placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <MessageSquare size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">Inquiry management coming soon</p>
        <p className="text-sm text-gray-400 mt-1">
          Customers will be able to send inquiries about your vehicles. You'll manage them here.
        </p>
        <Link href="/support" className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
          Contact support for early access <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
