'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { LabEquipment, EquipmentTransaction } from '@/lib/types';

interface RealtimeOptions {
  onStockChange?: (payload: { eventType: string; newRecord?: LabEquipment; oldRecord?: Partial<LabEquipment> }) => void;
  enableToasts?: boolean;
}

/**
 * Hook para escuchar eventos en tiempo real de Supabase sobre lab_equipment y equipment_transactions.
 * Notifica con Sonner Toasts cuando la estación NEWLab detecta equipos o los docentes registran préstamos/daños.
 */
export function useInventoryRealtime(options: RealtimeOptions = {}) {
  const { onStockChange, enableToasts = true } = options;
  const callbackRef = useRef(onStockChange);
  callbackRef.current = onStockChange;

  useEffect(() => {
    const supabase = createClient();

    // Canal 1: Activos de Laboratorio
    const equipmentChannel = supabase
      .channel('realtime_lab_equipment_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_equipment' },
        (payload) => {
          const eventType = payload.eventType;
          const newRecord = payload.new as LabEquipment | undefined;
          const oldRecord = payload.old as Partial<LabEquipment> | undefined;

          if (callbackRef.current) {
            callbackRef.current({ eventType, newRecord, oldRecord });
          }

          if (!enableToasts) return;

          if (eventType === 'INSERT' && newRecord) {
            toast.success(`Nuevo Activo Registrado: ${newRecord.name}`, {
              description: `${newRecord.total_quantity} uds. en ${newRecord.location || 'Laboratorio'}.`,
              duration: 4000,
            });
          } else if (eventType === 'UPDATE' && newRecord) {
            if (newRecord.condition === 'Requiere Mantenimiento' || newRecord.condition === 'Dañado/Baja') {
              toast.error(`Alerta Técnica: ${newRecord.name}`, {
                description: `Estado alterado a: ${newRecord.condition}.`,
                duration: 6000,
              });
            } else if (newRecord.available_quantity <= (newRecord.min_threshold ?? 3)) {
              toast.warning(`Disponibilidad Reducida: ${newRecord.name}`, {
                description: `Solo quedan ${newRecord.available_quantity} unidades disponibles para clase.`,
                duration: 5000,
              });
            }
          }
        }
      )
      .subscribe();

    // Canal 2: Transacciones Educativas y Detecciones IA
    const txChannel = supabase
      .channel('realtime_equipment_transactions_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'equipment_transactions' },
        (payload) => {
          const newTx = payload.new as EquipmentTransaction;
          if (!enableToasts || !newTx) return;

          if (newTx.action === 'AUDITORIA_IA') {
            toast.info(`Auditoría IA (NEWLab): Equipo Detectado`, {
              description: `${newTx.quantity}x activo #${newTx.equipment_id} verificado en mesa de trabajo.`,
              duration: 5000,
            });
          } else if (newTx.action === 'PRESTAMO_CLASE') {
            toast.success(`Préstamo a Clase Registrado`, {
              description: `${newTx.quantity}x entregado a: ${newTx.assigned_to || 'Grupo de Laboratorio'}.`,
              duration: 4000,
            });
          } else if (newTx.action === 'REPORTE_DANO') {
            toast.error(`Reporte de Daño / Falla`, {
              description: `Equipo #${newTx.equipment_id}: ${newTx.notes || 'Avería técnica registrada'}.`,
              duration: 6000,
            });
          } else if (newTx.action === 'DEVOLUCION') {
            toast.success(`Devolución Conforme`, {
              description: `${newTx.quantity}x reingresado a inventario disponible.`,
              duration: 4000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(equipmentChannel);
      supabase.removeChannel(txChannel);
    };
  }, [enableToasts]);
}
