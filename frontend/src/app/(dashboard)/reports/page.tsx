'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { BarChart3, Download, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

export default function ReportsPage() {
  const [from, setFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: alertSummary, isLoading } = useQuery({
    queryKey: ['report-alerts', from, to],
    queryFn: () => apiClient.get('/reports/alerts-summary', { params: { from, to } }).then(r => r.data),
  });

  const { data: trips } = useQuery({
    queryKey: ['report-trips', from, to],
    queryFn: () => apiClient.get('/reports/trips', { params: { from, to } }).then(r => r.data),
  });

  const alertChartData = (alertSummary?.data ?? []).reduce((acc: any[], row: any) => {
    const existing = acc.find(a => a.type === row.type);
    if (existing) existing[row.severity] = row._count;
    else acc.push({ type: row.type.replace('_', ' '), [row.severity]: row._count });
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1><p className="text-gray-500 text-sm">Fleet analytics and reports</p></div>
      </div>

      {/* Date range */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap shadow-sm">
        <Calendar size={18} className="text-gray-400" />
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Alert Summary Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Alerts by Type</h3>
          {isLoading ? <div className="h-48 bg-gray-100 rounded animate-pulse" /> : alertChartData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={alertChartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="CRITICAL" fill="#ef4444" />
                <Bar dataKey="HIGH" fill="#f97316" />
                <Bar dataKey="MEDIUM" fill="#f59e0b" />
                <Bar dataKey="LOW" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-gray-400 py-12">No alert data for period</p>}
        </div>

        {/* Trip Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Vehicle Activity</h3>
          <div className="space-y-3">
            {(trips?.data ?? []).slice(0, 6).map((row: any) => (
              <div key={row.vehicleId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">Vehicle {row.vehicleId.slice(0, 8)}...</p>
                  <p className="text-xs text-gray-500">{row._count?.id ?? 0} telemetry records</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{Math.round(row._max?.speed ?? 0)} km/h</p>
                  <p className="text-xs text-gray-500">max speed</p>
                </div>
              </div>
            ))}
            {!(trips?.data?.length) && <p className="text-center text-gray-400 py-8 text-sm">No trip data for period</p>}
          </div>
        </div>
      </div>
    </div>
  );
}