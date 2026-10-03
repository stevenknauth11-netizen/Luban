'use client';

import Link from 'next/link';
import type { EquipmentStock } from '@/lib/types';
import { formatEquipmentName } from '@/lib/types';
import { AlertTriangle, MapPin, ArrowRight, ShieldAlert } from 'lucide-react';

interface CriticalStockWidgetProps {
  items: EquipmentStock[];
}

export function CriticalStockWidget({ items }: CriticalStockWidgetProps) {
  const criticalItems = items.filter(
    (item) => (item.quantity ?? 0) <= (item.min_threshold ?? 5)
  );

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Widget de Stock Crítico (Alerta ≤ 5 uds.)
            </h2>
            <p className="text-xs text-slate-500">
              Componentes que requieren reposición inmediata
            </p>
          </div>
        </div>
        <span className={`badge ${criticalItems.length > 0 ? 'badge-danger' : 'badge-success'}`}>
          {criticalItems.length} Críticos
        </span>
      </div>

      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
        {criticalItems.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400">
            <p className="text-sm font-medium text-emerald-600 mb-1">
              ✓ Niveles de stock saludables
            </p>
            <p className="text-xs text-slate-400">
              Ningún componente electrónico se encuentra por debajo del umbral de alerta.
            </p>
          </div>
        ) : (
          criticalItems.map((item) => (
            <div
              key={item.id}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/75 transition-colors"
            >
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {formatEquipmentName(item.name)}
                  </p>
                  <span className="badge badge-info text-[10px] py-0.5">
                    {item.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {item.location || 'Sin ubicación fijada'}
                  </span>
                  <span>·</span>
                  <span className="text-slate-400">ID: #{item.id}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 text-xs font-bold rounded ${
                      item.quantity === 0
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {item.quantity === 0 ? 'Agotado (0)' : `${item.quantity} disponibles`}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
        <Link
          href="/dashboard/inventory"
          className="text-xs font-medium text-slate-600 hover:text-red-600 inline-flex items-center gap-1 transition-colors"
        >
          Gestionar en Inventario
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
