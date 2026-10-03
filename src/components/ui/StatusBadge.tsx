import React from 'react';
import type { EquipmentCondition } from '@/lib/types';
import { CheckCircle2, AlertCircle, Wrench, XCircle, Clock } from 'lucide-react';

export type DisplayStatus = EquipmentCondition | 'En Préstamo' | 'Disponible';

interface StatusBadgeProps {
  status: DisplayStatus;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function StatusBadge({
  status,
  size = 'md',
  showIcon = true,
}: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'Óptimo':
    case 'Disponible':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 ${sizeClasses}`}
        >
          {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
          <span>{status}</span>
        </span>
      );

    case 'Desgaste Menor':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-md border border-amber-200 bg-amber-50 text-amber-700 ${sizeClasses}`}
        >
          {showIcon && <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
          <span>{status}</span>
        </span>
      );

    case 'Requiere Mantenimiento':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-md border border-orange-200 bg-orange-50 text-orange-700 ${sizeClasses}`}
        >
          {showIcon && <Wrench className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />}
          <span>Requiere Mantenimiento</span>
        </span>
      );

    case 'Dañado/Baja':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-md border border-red-200 bg-red-50 text-red-700 ${sizeClasses}`}
        >
          {showIcon && <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />}
          <span>Dañado / Baja</span>
        </span>
      );

    case 'En Préstamo':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-md border border-blue-200 bg-blue-50 text-blue-700 ${sizeClasses}`}
        >
          {showIcon && <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
          <span>En Préstamo</span>
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md border border-slate-200 bg-slate-50 text-slate-700 ${sizeClasses}`}
        >
          <span>{status}</span>
        </span>
      );
  }
}
