'use client';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',
  IDLE: '#f59e0b',
  OFFLINE: '#6b7280',
  MAINTENANCE: '#f97316',
  DECOMMISSIONED: '#ef4444',
};

export function VehicleStatusChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));
  if (!chartData.length) return <p className="text-gray-400 text-center py-8">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
          paddingAngle={3} dataKey="value">
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name] ?? '#6b7280'} />
          ))}
        </Pie>
        <Tooltip formatter={(v: any) => [${v} vehicles]} />
        <Legend formatter={(value) => value.toLowerCase().replace('_', ' ')} />
      </PieChart>
    </ResponsiveContainer>
  );
}