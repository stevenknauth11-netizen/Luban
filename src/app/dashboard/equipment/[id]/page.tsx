import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { LabEquipment, EquipmentTransaction, Profile } from '@/lib/types';
import { formatEquipmentName } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ArrowLeft,
  Cpu,
  BookOpen,
  Wrench,
  ExternalLink,
  Layers,
  MapPin,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Package,
} from 'lucide-react';

interface EquipmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EquipmentDetailPage({ params }: EquipmentDetailPageProps) {
  const { id } = await params;
  const equipmentId = Number(id);

  if (isNaN(equipmentId)) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();

  // 1. Consultar Activo con su Categoría Dinámica
  const { data: equipmentData, error: eqErr } = await supabase
    .from('lab_equipment')
    .select('*, equipment_categories(name, description)')
    .eq('id', equipmentId)
    .single();

  if (eqErr || !equipmentData) {
    notFound();
  }

  const item = equipmentData as LabEquipment;

  // 2. Consultar Historial de Movimientos de este Equipo
  const { data: txData } = await supabase
    .from('equipment_transactions')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('timestamp', { ascending: false })
    .limit(10);

  const transactions = (txData as EquipmentTransaction[]) ?? [];

  // Parsear Especificaciones Técnicas (JSONB)
  const specs = (item.technical_specs || {}) as Record<string, string>;
  const hasSpecs = Object.keys(specs).length > 0;

  const categoryName =
    (item as any).equipment_categories?.name || item.category || 'General';

  const isAvailable = (item.available_quantity ?? 0) > 0;
  const availabilityPercent = Math.round(
    ((item.available_quantity ?? 0) / (item.total_quantity || 1)) * 100
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Barra de Navegación Superior */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <Link
          href="/dashboard/equipment"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Catálogo de Laboratorio</span>
        </Link>

        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <span>Activo #{String(item.id).padStart(4, '0')}</span>
          <span>·</span>
          <span>Taller Lúban (INATEC)</span>
        </div>
      </div>

      {/* Header Principal de la Wiki */}
      <div className="card p-6 bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="badge badge-info font-mono text-xs font-bold">
                {categoryName}
              </span>
              <StatusBadge status={item.condition} />
              {item.is_consumable ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  Material Fungible / Consumible
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Activo Inventariable Retornable
                </span>
              )}
              {item.is_active === false && (
                <span className="badge badge-danger text-[11px]">
                  Archivado / Inactivo
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatEquipmentName(item.name)}
            </h1>
            {item.name !== formatEquipmentName(item.name) && (
              <p className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded inline-block">
                Clase IA: {item.name}
              </p>
            )}

            <p className="text-sm text-slate-600 leading-relaxed">
              {item.short_description ||
                item.description ||
                'Recurso didáctico para capacitación tecnológica e investigación aplicada.'}
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 font-medium">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>Ubicación: <strong className="text-slate-800">{item.location}</strong></span>
              </div>
            </div>
          </div>

          {/* Tarjeta de Disponibilidad Física Inmediata */}
          <div className="w-full md:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between flex-shrink-0">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Disponibilidad en Mesas
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-3xl font-black ${
                    isAvailable ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {item.available_quantity}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  de {item.total_quantity} unidades
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    availabilityPercent === 0
                      ? 'bg-red-500'
                      : availabilityPercent < 30
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                  style={{ width: `${availabilityPercent}%` }}
                />
              </div>
            </div>

            {item.datasheet_url && (
              <a
                href={item.datasheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Consultar Datasheet Oficial</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Secciones Educativas estilo Wiki */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Aplicación Práctica y Especificaciones Técnicas */}
        <div className="lg:col-span-7 space-y-6">
          {/* Sección 1: Aplicación Práctica en Clases */}
          <div className="card p-6 bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Aplicación Práctica Educativa
                </h2>
                <p className="text-[11px] text-slate-400">
                  Objetivo didáctico en los módulos técnicos de INATEC
                </p>
              </div>
            </div>

            <div className="prose prose-sm text-slate-700 leading-relaxed">
              <p>
                {item.educational_use ||
                  'Este equipo está destinado a prácticas experimentales en el taller, permitiendo a los estudiantes validar circuitos físicos, adquirir telemetría de sensores y desarrollar firmware embebido.'}
              </p>
            </div>
          </div>

          {/* Sección 2: Especificaciones Técnicas (JSONB Renderizado) */}
          <div className="card p-6 bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Especificaciones Técnicas del Fabricante
                </h2>
                <p className="text-[11px] text-slate-400">
                  Parámetros eléctricos, lógicos y mecánicos de referencia
                </p>
              </div>
            </div>

            {hasSpecs ? (
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs min-w-[280px]">
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(specs).map(([key, val], idx) => (
                      <tr
                        key={key}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                      >
                        <td className="px-4 py-2.5 font-bold text-slate-700 w-2/5 border-r border-slate-100">
                          {key}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-800 font-medium">
                          {val}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                <Info className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                <p>No se han registrado parámetros clave/valor para este componente.</p>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Trazabilidad y Últimos Préstamos */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card bg-white border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Historial de Movimientos
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {transactions.length} registros
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <p className="font-semibold text-slate-600">Sin movimientos registrados</p>
                  <p className="mt-0.5 text-slate-400">
                    Las asignaciones a estudiantes o reportes de falla se listarán aquí.
                  </p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="badge badge-info text-[10px] uppercase font-bold">
                        {tx.action.replace('_', ' ')}
                      </span>
                      <time className="text-[11px] text-slate-400 font-mono">
                        {new Date(tx.timestamp).toLocaleDateString('es-NI', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>

                    <p className="text-xs text-slate-800 font-medium mt-1.5">
                      {tx.quantity} unidades · Asignado a:{' '}
                      <strong className="text-slate-900">{tx.assigned_to || 'General'}</strong>
                    </p>

                    {tx.notes && (
                      <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded">
                        "{tx.notes}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
