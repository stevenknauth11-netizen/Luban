'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EquipmentTransaction } from '@/lib/types';
import { formatEquipmentName } from '@/lib/types';
import { Bot, Radio, Clock, MapPin, Sparkles } from 'lucide-react';

interface IaLiveFeedWidgetProps {
  initialEvents: EquipmentTransaction[];
}

export function IaLiveFeedWidget({ initialEvents }: IaLiveFeedWidgetProps) {
  const supabase = createClient();
  const [events, setEvents] = useState<EquipmentTransaction[]>(initialEvents);

  useEffect(() => {
    // Suscripción al canal de transacciones en tiempo real
    const channel = supabase
      .channel('ia_audit_live_feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'equipment_transactions',
        },
        async (payload) => {
          const newTx = payload.new as EquipmentTransaction;

          // Traer nombre del equipo para enriquecer el feed
          const { data: eq } = await supabase
            .from('lab_equipment')
            .select('name, category, location')
            .eq('id', newTx.equipment_id)
            .single();

          const fullTx: EquipmentTransaction = {
            ...newTx,
            lab_equipment: eq ? { name: eq.name, category: eq.category, location: eq.location } : undefined,
          };

          setEvents((prev) => [fullTx, ...prev.slice(0, 19)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div className="card overflow-hidden">
      {/* Header con pulsador en vivo */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">
              Feed en Vivo: Auditoría IA &quot;Hands-Free&quot;
            </h2>
            <p className="text-xs text-white/50">
              Estación NEWLab (STM32 + OV7725) detectando en mesas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
            En Línea
          </span>
        </div>
      </div>

      {/* Lista de Eventos en Tiempo Real */}
      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {events.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Radio className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
            <p className="font-semibold text-slate-600">Esperando transmisiones del nodo NEWLab...</p>
            <p className="mt-1">Las detecciones automáticas de componentes aparecerán aquí instantáneamente.</p>
          </div>
        ) : (
          events.map((tx) => {
            const rawEqName = tx.lab_equipment?.name || `Activo #${tx.equipment_id}`;
            const eqName = formatEquipmentName(rawEqName);
            const location = tx.lab_equipment?.location || 'Mesa Principal';

            return (
              <div
                key={tx.id}
                className="px-5 py-3 flex items-start justify-between hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isAi
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-blue-50 text-blue-600 border border-blue-200'
                    }`}
                  >
                    {isAi ? <Sparkles className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 leading-snug">
                      {isAi ? (
                        <>
                          IA detectó: <span className="text-red-700 font-bold">{tx.quantity}x {eqName}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold">{tx.action}</span>: {tx.quantity}x {eqName}
                        </>
                      )}
                    </p>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {location}
                      </span>
                      <span>·</span>
                      <span className="text-slate-400">{tx.assigned_to || tx.operator || 'NEWLab'}</span>
                      {tx.notes && (
                        <>
                          <span>·</span>
                          <span className="italic text-slate-600 truncate max-w-[200px]">&quot;{tx.notes}&quot;</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <time className="text-[11px] text-slate-400 font-mono whitespace-nowrap ml-3">
                  {new Date(tx.timestamp).toLocaleTimeString('es-NI', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
