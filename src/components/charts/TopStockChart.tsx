'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TopStockItem } from '@/lib/types';
import { Package } from 'lucide-react';

interface TopStockChartProps {
  data: TopStockItem[];
}

const BAR_COLORS = ['#CC0000', '#0F172A', '#2563EB', '#059669', '#D97706'];

export function TopStockChart({ data }: TopStockChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Package className="w-8 h-8 mb-2 text-slate-300" />
        <p className="text-sm">Sin datos de inventario disponibles</p>
      </div>
    );
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
          <XAxis type="number" tick={{ fill: '#64748B', fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as TopStockItem;
                return (
                  <div className="bg-slate-900 text-white px-3 py-2 rounded shadow-lg text-xs">
                    <p className="font-semibold text-slate-100">{item.name}</p>
                    <p className="text-slate-400 mt-0.5">Categoría: {item.category}</p>
                    <p className="text-red-400 font-bold mt-1">Stock: {item.quantity} unidades</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="quantity" radius={[0, 4, 4, 0]} barSize={22}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
