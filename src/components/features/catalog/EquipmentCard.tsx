import React from 'react';
import Link from 'next/link';
import type { LabEquipment } from '@/lib/types';
import { formatEquipmentName } from '@/lib/types';
import {
  Cpu,
  Radio,
  Sliders,
  Wrench,
  Layers,
  Sparkles,
  MapPin,
  FileText,
  Package,
  Monitor,
  Fingerprint,
  Network,
  Boxes,
  Maximize2,
} from 'lucide-react';

interface EquipmentCardProps {
  item: LabEquipment;
  viewMode?: 'grid' | 'list';
}

function getCategoryIcon(categoryName: string) {
  const cat = categoryName.toLowerCase();
  if (cat.includes('hmi') || cat.includes('pantalla') || cat.includes('teclado') || cat.includes('interfa')) {
    return Monitor;
  }
  if (cat.includes('biometr') || cat.includes('huella')) {
    return Fingerprint;
  }
  if (cat.includes('red') || cat.includes('ethernet') || cat.includes('comunic')) {
    return Network;
  }
  if (cat.includes('expansi')) {
    return Maximize2;
  }
  if (cat.includes('iot') || cat.includes('micro') || cat.includes('stm') || cat.includes('esp')) {
    return Cpu;
  }
  if (cat.includes('sensor')) {
    return Radio;
  }
  if (cat.includes('actuador') || cat.includes('motor') || cat.includes('meca')) {
    return Sliders;
  }
  if (cat.includes('herramienta') || cat.includes('soldad')) {
    return Wrench;
  }
  if (cat.includes('consumible') || cat.includes('fungible')) {
    return Boxes;
  }
  if (cat.includes('instrument') || cat.includes('oscil')) {
    return ActivityIcon;
  }
  return Layers;
}

function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-8 h-8 text-slate-400"
      {...props}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export function EquipmentCard({ item, viewMode = 'grid' }: EquipmentCardProps) {
  const categoryName =
    (item as any).equipment_categories?.name ||
    (typeof item.category === 'string' ? item.category : 'General');

  const IconComponent = getCategoryIcon(categoryName);

  const available = item.available_quantity ?? 0;
  const minAlert = item.min_stock_alert ?? 3;
  const isDamaged = item.condition === 'Dañado/Baja' || item.condition === 'Requiere Mantenimiento';

  // Determinación de Estado Luminoso (Dot + Texto)
  let statusColor = 'bg-emerald-500';
  let statusText = `Disponible: ${available}`;
  let statusBg = 'text-emerald-700 bg-emerald-50 border-emerald-200';

  if (isDamaged || available === 0) {
    statusColor = 'bg-red-500';
    statusText = isDamaged ? 'En Reparación' : 'Agotado';
    statusBg = 'text-red-700 bg-red-50 border-red-200';
  } else if (available <= minAlert) {
    statusColor = 'bg-amber-500';
    statusText = `Últimas unidades: ${available}`;
    statusBg = 'text-amber-800 bg-amber-50 border-amber-200';
  }

  const displayName = formatEquipmentName(item.name);

  // Vista en Modo Lista
  if (viewMode === 'list') {
    return (
      <Link
        href={`/dashboard/equipment/${item.id}`}
        className="group block bg-white border border-slate-200 rounded-lg p-4 hover:border-red-600 hover:-translate-y-0.5 transition-all duration-150 shadow-2xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-100 transition-colors">
              <IconComponent className="w-6 h-6 text-slate-500 group-hover:text-red-600 transition-colors" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {categoryName}
                </span>
                {item.is_consumable && (
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    Fungible
                  </span>
                )}
                {item.name !== displayName && (
                  <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                    {item.name}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-red-600 transition-colors mt-0.5">
                {displayName}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1 max-w-xl">
                {item.short_description || item.description || 'Activo didáctico de laboratorio.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0 self-end sm:self-center">
            <div className="text-right">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBg}`}
              >
                <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
                <span>{statusText}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                {item.location || 'Laboratorio'}
              </p>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Vista en Modo Cuadrícula (Grid)
  return (
    <Link
      href={`/dashboard/equipment/${item.id}`}
      className="group block bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-red-600 hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between shadow-2xs hover:shadow-xs"
    >
      <div>
        {/* Contenedor Superior de Imagen / Icono Placeholder */}
        <div className="h-36 bg-slate-50 border-b border-slate-100 flex items-center justify-center relative p-4 group-hover:bg-slate-100/60 transition-colors">
          <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-2xs group-hover:border-slate-300 transition-colors">
            <IconComponent className="w-7 h-7 text-slate-600 group-hover:text-red-600 transition-colors" />
          </div>

          {/* Badge Superior Flotante: ID */}
          <span className="absolute top-2.5 left-2.5 font-mono text-[10px] font-bold text-slate-400 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded border border-slate-200">
            #{String(item.id).padStart(4, '0')}
          </span>

          {item.is_consumable && (
            <span className="absolute top-2.5 right-2.5 text-[9px] font-mono font-bold text-purple-700 bg-purple-50/90 px-1.5 py-0.5 rounded border border-purple-200">
              Fungible
            </span>
          )}
        </div>

        {/* Cuerpo de la Tarjeta */}
        <div className="p-4 space-y-2.5">
          {/* Categoría Badge */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[150px]">
              {categoryName}
            </span>
          </div>

          {/* Nombre del Equipo */}
          <h3
            className="text-sm font-semibold text-slate-900 group-hover:text-red-600 transition-colors truncate leading-snug"
            title={displayName}
          >
            {displayName}
          </h3>

          {/* Descripción corta */}
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {item.short_description ||
              item.description ||
              'Componente didáctico para prácticas de laboratorio.'}
          </p>
        </div>
      </div>

      {/* Pie de Tarjeta: Estado Luminoso */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-100/80 flex items-center justify-between mt-auto">
        <div
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusBg}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
          <span className="font-mono">{statusText}</span>
        </div>

        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium truncate max-w-[90px]">
          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="truncate">{item.location || 'Lab'}</span>
        </span>
      </div>
    </Link>
  );
}
