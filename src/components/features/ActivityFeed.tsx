'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EquipmentTransaction, TransactionAction } from '@/lib/types';
import { formatEquipmentName } from '@/lib/types';
import {
  AlertTriangle,
  ArrowUpRight,
  RotateCcw,
  PlusCircle,
  Bot,
  Radio,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ActivityFeedProps {
  initialEvents?: EquipmentTransaction[];
  limit?: number;
}

export function ActivityFeed({ initialEvents = [], limit = 15 }: ActivityFeedProps) {
  const [events, setEvents] = useState<EquipmentTransaction[]>(initialEvents.slice(0, limit));
  const [isLive, setIsLive] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (initialEvents.length > 0 && events.length === 0) {
      setEvents(initialEvents.slice(0, limit));
    }
  }, [initialEvents, limit]);

  useEffect(() => {
    // Suscripción Realtime a la tabla equipment_transactions
    const channel = supabase
      .channel('equipment-activity-feed-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'equipment_transactions',
        },
        async (payload) => {
          const newTx = payload.new as EquipmentTransaction;

          // Enriquecer con los datos del equipo si no están anidados
          try {
            const { data: eqData } = await supabase
              .from('lab_equipment')
              .select('name, category, location')
              .eq('id', newTx.equipment_id)
              .single();

            if (eqData) {
              newTx.lab_equipment = eqData;
            }
          } catch (e) {
            console.error('Error fetching equipment for realtime event:', e);
          }

          setEvents((prev) => [newTx, ...prev].slice(0, limit));
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, limit]);

  // Función de estilo e iconos según el tipo de acción
  const getEventConfig = (action: TransactionAction) => {
    switch (action) {
      case 'REPORTE_DANO':
        return {
          icon: AlertTriangle,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeText: 'Daño / Falla',
          badgeClass: 'bg-red-100 text-red-800 border-red-200',
          dotColor: 'bg-red-500',
        };
      case 'PRESTAMO_CLASE':
        return {
          icon: ArrowUpRight,
          iconColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          badgeText: 'Préstamo',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
          dotColor: 'bg-blue-500',
        };
      case 'DEVOLUCION':
        return {
          icon: RotateCcw,
          iconColor: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
          badgeText: 'Devolución',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          dotColor: 'bg-emerald-500',
        };
      case 'INGRESO_NUEVO':
        return {
          icon: PlusCircle,
          iconColor: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
          badgeText: 'Ingreso Nuevo',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          dotColor: 'bg-emerald-500',
        };
      case 'AUDITORIA_IA':
        return {
          icon: Bot,
          iconColor: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          badgeText: 'Auditoría IA',
          badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
          dotColor: 'bg-purple-500',
        };
      default:
        return {
          icon: Clock,
          iconColor: 'text-slate-600',
          bgColor: 'bg-slate-50',
          borderColor: 'border-slate-200',
          badgeText: 'Movimiento',
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
          dotColor: 'bg-slate-400',
        };
    }
  };

  const formatNarrative = (tx: EquipmentTransaction) => {
    const rawName = tx.lab_equipment?.name || `Equipo #${tx.equipment_id}`;
    const eqName = formatEquipmentName(rawName);
    const qty = tx.quantity || 1;

    switch (tx.action) {
      case 'REPORTE_DANO':
        return (
          <>
            <span className="font-semibold text-slate-900">{eqName}</span> marcado como{' '}
            <span className="font-bold text-red-600">Dañado/Mantenimiento</span> por{' '}
            <span className="font-medium text-slate-700">{tx.operator || 'Docente'}</span>
          </>
        );
      case 'PRESTAMO_CLASE':
        return (
          <>
            <span className="font-semibold text-slate-900">{qty}x {eqName}</span> prestado a{' '}
            <span className="font-bold text-blue-700">{tx.assigned_to || 'Grupo de Estudiantes'}</span>
          </>
        );
      case 'DEVOLUCION':
        return (
          <>
            <span className="font-semibold text-slate-900">{qty}x {eqName}</span> devuelto por{' '}
            <span className="font-medium text-emerald-700">{tx.assigned_to || 'Estudiante'}</span>
          </>
        );
      case 'INGRESO_NUEVO':
        return (
          <>
            Se agregaron <span className="font-bold text-emerald-700">{qty}x</span>{' '}
            <span className="font-semibold text-slate-900">{eqName}</span> al inventario
          </>
        );
      case 'AUDITORIA_IA':
        return (
          <>
            <span className="font-semibold text-slate-900">IA confirmó stock ({qty}u)</span> de{' '}
            <span className="font-medium text-purple-900">{eqName}</span>{' '}
            {tx.lab_equipment?.location ? `en ${tx.lab_equipment.location}` : ''}
          </>
        );
      default:
        return (
          <>
            Operación en <span className="font-semibold text-slate-900">{eqName}</span> ({qty} unidades)
          </>
        );
    }
  };

  return (
    <div className="card bg-white overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Registro Global de Eventos</h2>
            <p className="text-xs text-slate-500">
              Trazabilidad en tiempo real · Operaciones físicas y auditorías IA
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            {isLive ? 'EN VIVO' : 'SINCRONIZANDO'}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Últimos {events.length}</span>
        </div>
      </div>

      {/* Timeline List */}
      <div className="p-5 flex-1 overflow-y-auto max-h-[460px] divide-y divide-slate-100">
        {events.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Radio className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No hay movimientos recientes</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Los nuevos préstamos, ingresos y auditorías de IA aparecerán aquí al instante.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {events.map((tx) => {
              const config = getEventConfig(tx.action);
              const Icon = config.icon;
              const dateStr = new Date(tx.timestamp).toLocaleTimeString('es-NI', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });
              const dateDay = new Date(tx.timestamp).toLocaleDateString('es-NI', {
                day: '2-digit',
                month: 'short',
              });

              return (
                <div key={tx.id} className="relative group">
                  {/* Timeline indicator node */}
                  <div
                    className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${config.dotColor}`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>

                  <div className="bg-white rounded-lg border border-slate-100 p-3.5 hover:border-slate-300 hover:shadow-xs transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${config.bgColor} border ${config.borderColor}`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-block px-1.5 py-0.2 text-[10px] font-bold rounded border uppercase tracking-wider ${config.badgeClass}`}
                            >
                              {config.badgeText}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {dateDay} · {dateStr}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 mt-1 leading-snug">
                            {formatNarrative(tx)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {tx.notes && (
                      <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 rounded px-2.5 py-1 border border-slate-100 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-600">Nota:</span>
                        <span className="truncate">{tx.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
