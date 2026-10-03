'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LabEquipment, Profile } from '@/lib/types';
import { formatEquipmentName } from '@/lib/types';
import { toast } from 'sonner';
import {
  X,
  BookOpen,
  RotateCcw,
  AlertOctagon,
  Loader2,
  Users,
  FileText,
  PackageCheck,
} from 'lucide-react';

export type OperationType = 'PRESTAMO' | 'DEVOLUCION' | 'DANO';

interface EquipmentOperationsModalProps {
  item: LabEquipment | null;
  initialType: OperationType;
  isOpen: boolean;
  profile: Profile | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EquipmentOperationsModal({
  item,
  initialType,
  isOpen,
  profile,
  onClose,
  onSuccess,
}: EquipmentOperationsModalProps) {
  const supabase = createClient();
  const [opType, setOpType] = useState<OperationType>(initialType);
  const [quantity, setQuantity] = useState<number>(1);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [newCondition, setNewCondition] = useState<'Requiere Mantenimiento' | 'Dañado/Baja'>('Requiere Mantenimiento');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen || !item) return null;

  const inUseQuantity = item.total_quantity - item.available_quantity;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    setLoading(true);

    const operatorName = profile?.full_name ? `${profile.full_name} (${profile.role})` : (profile?.email || 'Docente');

    try {
      if (opType === 'PRESTAMO') {
        if (quantity > item.available_quantity) {
          toast.error('Cantidad no disponible', {
            description: `Solo hay ${item.available_quantity} equipos disponibles para préstamo.`,
          });
          setLoading(false);
          return;
        }

        const newAvailable = item.available_quantity - quantity;

        // 1. Actualizar disponibilidad
        const { error: updateErr } = await supabase
          .from('lab_equipment')
          .update({ available_quantity: newAvailable })
          .eq('id', item.id);

        if (updateErr) throw updateErr;

        // 2. Registrar transacción
        const { error: txErr } = await supabase.from('equipment_transactions').insert({
          equipment_id: item.id,
          action: 'PRESTAMO_CLASE',
          quantity: quantity,
          assigned_to: assignedTo.trim() || 'Grupo de Laboratorio',
          operator: operatorName,
          notes: notes.trim() || 'Práctica regular de laboratorio',
        });

        if (txErr) throw txErr;

        toast.success(`Préstamo registrado exitosamente`, {
          description: `${quantity}x ${item.name} asignado a: ${assignedTo || 'Grupo de Clase'}.`,
        });
      } else if (opType === 'DEVOLUCION') {
        if (quantity > inUseQuantity) {
          toast.error('Exceso de devolución', {
            description: `Actualmente solo hay ${inUseQuantity} equipos en uso/préstamo.`,
          });
          setLoading(false);
          return;
        }

        const newAvailable = item.available_quantity + quantity;

        // 1. Actualizar disponibilidad
        const { error: updateErr } = await supabase
          .from('lab_equipment')
          .update({ available_quantity: newAvailable })
          .eq('id', item.id);

        if (updateErr) throw updateErr;

        // 2. Registrar transacción
        const { error: txErr } = await supabase.from('equipment_transactions').insert({
          equipment_id: item.id,
          action: 'DEVOLUCION',
          quantity: quantity,
          assigned_to: assignedTo.trim() || 'Devolución de Clase',
          operator: operatorName,
          notes: notes.trim() || 'Reingreso conforme al almacén',
        });

        if (txErr) throw txErr;

        toast.success(`Devolución completada`, {
          description: `${quantity}x ${item.name} reingresado como disponible.`,
        });
      } else if (opType === 'DANO') {
        if (quantity > item.available_quantity) {
          toast.error('Cantidad no válida', {
            description: `No puedes reportar daño de más equipos que los que están registrados como disponibles (${item.available_quantity}).`,
          });
          setLoading(false);
          return;
        }

        if (!notes.trim()) {
          toast.error('Nota técnica obligatoria', {
            description: 'Debes detallar la falla o avería técnica del equipo.',
          });
          setLoading(false);
          return;
        }

        const newAvailable = Math.max(0, item.available_quantity - quantity);

        // 1. Descontar disponible y cambiar condición
        const { error: updateErr } = await supabase
          .from('lab_equipment')
          .update({
            available_quantity: newAvailable,
            condition: newCondition,
          })
          .eq('id', item.id);

        if (updateErr) throw updateErr;

        // 2. Registrar reporte de daño en trazabilidad
        const { error: txErr } = await supabase.from('equipment_transactions').insert({
          equipment_id: item.id,
          action: 'REPORTE_DANO',
          quantity: quantity,
          assigned_to: assignedTo.trim() || 'Incidencia de Taller',
          operator: operatorName,
          notes: `[Condición: ${newCondition}] ${notes.trim()}`,
        });

        if (txErr) throw txErr;

        toast.warning(`Reporte de avería asentado`, {
          description: `${quantity}x ${item.name} marcado como '${newCondition}'.`,
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido al procesar transacción';
      toast.error('Error en la operación', { description: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="card w-full max-w-[95%] sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Operaciones de Laboratorio
              </h2>
              <p className="text-xs text-slate-500">
                Activo: <span className="font-semibold text-slate-700">{formatEquipmentName(item.name)}</span> (ID: #{item.id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Pestañas de Acción */}
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setOpType('PRESTAMO')}
            className={`flex-1 py-3 px-3 sm:px-4 flex items-center justify-center gap-1.5 transition-colors border-b-2 whitespace-nowrap min-h-[44px] ${
              opType === 'PRESTAMO'
                ? 'border-blue-600 text-blue-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Préstamo a Clase
          </button>

          <button
            type="button"
            onClick={() => setOpType('DEVOLUCION')}
            className={`flex-1 py-3 px-3 sm:px-4 flex items-center justify-center gap-1.5 transition-colors border-b-2 whitespace-nowrap min-h-[44px] ${
              opType === 'DEVOLUCION'
                ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Devolución
          </button>

          <button
            type="button"
            onClick={() => setOpType('DANO')}
            className={`flex-1 py-3 px-3 sm:px-4 flex items-center justify-center gap-1.5 transition-colors border-b-2 whitespace-nowrap min-h-[44px] ${
              opType === 'DANO'
                ? 'border-red-600 text-red-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            Reporte de Daño
          </button>
        </div>

        {/* Resumen de Estado del Activo */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-slate-400">Total Físico</p>
            <p className="font-bold text-slate-800 text-sm">{item.total_quantity} uds.</p>
          </div>
          <div>
            <p className="text-slate-400">Disponibles</p>
            <p className="font-bold text-emerald-700 text-sm">{item.available_quantity} uds.</p>
          </div>
          <div>
            <p className="text-slate-400">En Préstamo/Uso</p>
            <p className="font-bold text-amber-700 text-sm">{inUseQuantity} uds.</p>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cantidad a procesar *
              </label>
              <input
                type="number"
                min="1"
                max={opType === 'DEVOLUCION' ? inUseQuantity || 1 : item.available_quantity || 1}
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field text-sm py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {opType === 'DEVOLUCION'
                  ? `Máximo retornable: ${inUseQuantity}`
                  : `Máximo disponible: ${item.available_quantity}`}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Asignado a / Grupo
              </label>
              <input
                type="text"
                placeholder={opType === 'DANO' ? 'Ej: Práctica IoT Mesa 2' : 'Ej: Grupo 3 - Clase Robótica'}
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="input-field text-sm py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
              />
            </div>
          </div>

          {/* Opciones exclusivas de Reporte de Daño */}
          {opType === 'DANO' && (
            <div>
              <label className="block text-xs font-semibold text-red-700 mb-1">
                Nueva Clasificación del Estado Técnico *
              </label>
              <select
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value as 'Requiere Mantenimiento' | 'Dañado/Baja')}
                className="select-field text-sm py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
              >
                <option value="Requiere Mantenimiento">Requiere Mantenimiento (Reparable en Taller)</option>
                <option value="Dañado/Baja">Dañado / Baja Definitiva (Irreparable)</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              {opType === 'DANO' ? 'Diagnóstico / Nota Técnica de la Avería *' : 'Notas o Código de Práctica'}
            </label>
            <textarea
              rows={3}
              required={opType === 'DANO'}
              placeholder={
                opType === 'DANO'
                  ? 'Describe detalladamente la falla (Ej: Pin GND quemado por sobretensión, cristal oscilador desprendido...)'
                  : 'Notas de la sesión, módulo didáctico, o docente a cargo...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field text-sm resize-none"
            />
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary text-sm w-full sm:w-auto min-h-[44px] sm:min-h-0 justify-center"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading || (opType === 'PRESTAMO' && item.available_quantity === 0) || (opType === 'DEVOLUCION' && inUseQuantity === 0)}
              className={`btn text-sm w-full sm:w-auto min-h-[44px] sm:min-h-0 justify-center ${
                opType === 'DANO' ? 'btn-danger' : 'btn-primary'
              }`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {opType === 'PRESTAMO' && 'Confirmar Préstamo'}
              {opType === 'DEVOLUCION' && 'Confirmar Devolución'}
              {opType === 'DANO' && 'Asentar Reporte de Daño'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
