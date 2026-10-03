'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface CategoryWearStats {
  category: string;
  enUso: number;
  danados: number;
  disponibles: number;
}

interface ConditionDamageChartProps {
  data: CategoryWearStats[];
}

export function ConditionDamageChart({ data }: ConditionDamageChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-xs">
        Sin datos de desgaste registrados
      </div>
    );
  }

  return (
    <div className="w-full h-72 sm:h-80 min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="category"
            tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#64748B', fontSize: 11 }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-slate-900 text-white p-3 rounded shadow-xl text-xs space-y-1">
                    <p className="font-bold text-slate-100 border-b border-slate-700 pb-1">
                      {label}
                    </p>
                    <p className="text-emerald-400">
                      Disponibles: <span className="font-bold">{payload[0]?.value ?? 0}</span>
                    </p>
                    <p className="text-amber-400">
                      En Préstamo / Clase: <span className="font-bold">{payload[1]?.value ?? 0}</span>
                    </p>
                    <p className="text-red-400">
                      Dañados / Mantenimiento: <span className="font-bold">{payload[2]?.value ?? 0}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
            iconType="circle"
          />
          <Bar dataKey="disponibles" name="Disponibles" fill="#059669" radius={[2, 2, 0, 0]} />
          <Bar dataKey="enUso" name="En Préstamo / Uso" fill="#D97706" radius={[2, 2, 0, 0]} />
          <Bar dataKey="danados" name="Dañados / Mantenimiento" fill="#DC2626" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
