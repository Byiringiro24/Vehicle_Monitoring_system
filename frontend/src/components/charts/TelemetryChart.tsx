'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function TelemetryChart({ data }: { data: any[] }) {
  const chartData = [...data].reverse().map(d => ({
    time: format(new Date(d.timestamp), 'HH:mm'),
    speed: d.speed ? Math.round(d.speed) : null,
    fuelLevel: d.fuelLevel ? Math.round(d.fuelLevel) : null,
    engineTemp: d.engineTemp ? Math.round(d.engineTemp) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="speed" stroke="#3b82f6" dot={false} name="Speed (km/h)" strokeWidth={2} />
        <Line type="monotone" dataKey="fuelLevel" stroke="#22c55e" dot={false} name="Fuel (%)" strokeWidth={2} />
        <Line type="monotone" dataKey="engineTemp" stroke="#f97316" dot={false} name="Temp (°C)" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}