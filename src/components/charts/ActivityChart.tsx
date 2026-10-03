'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DailyActivityPoint } from '@/lib/types';
import { Activity } from 'lucide-react';

interface ActivityChartProps {
  data: DailyActivityPoint[];
}

export function ActivityChart({ data }: ActivityChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Activity className="w-8 h-8 mb-2 text-slate-300" />
        <p className="text-sm">Sin registros de actividad en los últimos 7 días</p>
      </div>
    );
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#CC0000" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#CC0000" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorAdds" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748B', fontSize: 12 }}
            dy={5}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#64748B', fontSize: 12 }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-slate-900 text-white px-3 py-2.5 rounded shadow-lg text-xs space-y-1">
                    <p className="font-semibold text-slate-200 border-b border-slate-700 pb-1">
                      {label}
                    </p>
                    <p className="text-emerald-400">
                      Entradas (ADD): <span className="font-bold">{payload[0]?.value ?? 0}</span>
                    </p>
                    {payload[1] && (
                      <p className="text-red-400">
                        Total Operaciones: <span className="font-bold">{payload[1]?.value ?? 0}</span>
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="adds"
            name="Entradas"
            stroke="#059669"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorAdds)"
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Total Movimientos"
            stroke="#CC0000"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorTotal)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
