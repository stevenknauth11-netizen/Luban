'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { LabEquipment, UserRole } from '@/lib/types';
import { formatEquipmentName } from '@/lib/types';
import { BookOpen, AlertTriangle, Plus, Loader2, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface DashboardQuickActionsProps {
  equipmentList: LabEquipment[];
  userRole?: UserRole;
  operatorName?: string;
}

export function DashboardQuickActions({
  equipmentList,
  userRole = 'viewer',
  operatorName = 'Docente INATEC',
}: DashboardQuickActionsProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [faultModalOpen, setFaultModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Estados para Préstamo
  const [selectedEqId, setSelectedEqId] = useState<number>(equipmentList[0]?.id || 0);
  const [loanQty, setLoanQty] = useState<number>(1);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [loanNotes, setLoanNotes] = useState<string>('');

  // Estados para Reporte de Falla
  const [faultEqId, setFaultEqId] = useState<number>(equipmentList[0]?.id || 0);
  const [faultCondition, setFaultCondition] = useState<'Requiere Mantenimiento' | 'Dañado/Baja'>(
    'Requiere Mantenimiento'
  );
  const [faultNotes, setFaultNotes] = useState<string>('');

  // Solo docentes y admins pueden realizar operaciones
  const canOperate = userRole === 'admin' || userRole === 'teacher';
  if (!canOperate) return null;

  const currentLoanItem = equipmentList.find((e) => e.id === Number(selectedEqId));
  const currentFaultItem = equipmentList.find((e) => e.id === Number(faultEqId));

  async function handleLoanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentLoanItem) return;

    if (loanQty > currentLoanItem.available_quantity) {
      toast.error('Stock insuficiente', {
        description: `Solo hay ${currentLoanItem.available_quantity} unidades disponibles de ${currentLoanItem.name}.`,
      });
      return;
    }

    if (!assignedTo.trim()) {
      toast.error('Receptor requerido', {
        description: 'Debes indicar el nombre del estudiante, grupo o mesa receptora.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const newAvailable = currentLoanItem.available_quantity - loanQty;

      // 1. Actualizar disponibilidad
      const { error: updateErr } = await supabase
        .from('lab_equipment')
        .update({ available_quantity: newAvailable })
        .eq('id', currentLoanItem.id);

      if (updateErr) throw updateErr;

      // 2. Registrar en transacciones
      const { error: txErr } = await supabase.from('equipment_transactions').insert({
        equipment_id: currentLoanItem.id,
        action: 'PRESTAMO_CLASE',
        quantity: loanQty,
        assigned_to: assignedTo.trim(),
        operator: operatorName,
        notes: loanNotes.trim() || 'Préstamo rápido para práctica en laboratorio',
      });

      if (txErr) throw txErr;

      toast.success('Préstamo Registrado con Éxito', {
        description: `${loanQty}x ${currentLoanItem.name} asignado a ${assignedTo}.`,
      });

      setLoanModalOpen(false);
      setAssignedTo('');
      setLoanNotes('');
      setLoanQty(1);
      router.refresh();
    } catch (err: any) {
      toast.error('Error al registrar préstamo', {
        description: err.message || 'Ocurrió un error en la base de datos.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFaultSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFaultItem) return;

    if (!faultNotes.trim()) {
      toast.error('Diagnóstico requerido', {
        description: 'Por favor describe la falla observada para el equipo técnico.',
      });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Marcar equipo con la condición reportada
      const { error: updateErr } = await supabase
        .from('lab_equipment')
        .update({ condition: faultCondition })
        .eq('id', currentFaultItem.id);

      if (updateErr) throw updateErr;

      // 2. Registrar en transacciones
      const { error: txErr } = await supabase.from('equipment_transactions').insert({
        equipment_id: currentFaultItem.id,
        action: 'REPORTE_DANO',
        quantity: 1,
        assigned_to: currentFaultItem.location,
        operator: operatorName,
        notes: `[Estado: ${faultCondition}] ${faultNotes.trim()}`,
      });

      if (txErr) throw txErr;

      toast.warning('Avería Registrada', {
        description: `${currentFaultItem.name} enviado al Taller de Mantenimiento.`,
      });

      setFaultModalOpen(false);
      setFaultNotes('');
      router.refresh();
    } catch (err: any) {
      toast.error('Error al reportar avería', {
        description: err.message || 'Error en la base de datos.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <button
          onClick={() => {
            if (equipmentList.length > 0 && !selectedEqId) {
              setSelectedEqId(equipmentList[0].id);
            }
            setLoanModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors min-h-[44px] sm:min-h-0"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Nuevo Préstamo</span>
        </button>

        <button
          onClick={() => {
            if (equipmentList.length > 0 && !faultEqId) {
              setFaultEqId(equipmentList[0].id);
            }
            setFaultModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 text-xs font-bold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors min-h-[44px] sm:min-h-0"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>Reportar Falla</span>
        </button>
      </div>

      {/* Modal: Nuevo Préstamo */}
      {loanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[95%] sm:max-w-md max-h-[92vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-blue-50/50 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Registrar Préstamo de Clase</h3>
                  <p className="text-[11px] text-slate-500">Asignar material para sesión técnica</p>
                </div>
              </div>
              <button
                onClick={() => setLoanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLoanSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seleccionar Equipo Técnico *
                </label>
                <select
                  value={selectedEqId}
                  onChange={(e) => {
                    setSelectedEqId(Number(e.target.value));
                    setLoanQty(1);
                  }}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id} disabled={eq.available_quantity <= 0}>
                      {formatEquipmentName(eq.name)} ({eq.available_quantity} disponibles de {eq.total_quantity}) · [{eq.category}]
                    </option>
                  ))}
                </select>
                {currentLoanItem && (
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">
                    Ubicación actual: <span className="font-semibold text-slate-700">{currentLoanItem.location}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cantidad a Prestar *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={currentLoanItem?.available_quantity || 1}
                    value={loanQty}
                    onChange={(e) => setLoanQty(Number(e.target.value))}
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Disponible Máx.
                  </label>
                  <div className="text-xs font-mono font-bold bg-slate-100 px-3 py-2 rounded-lg text-slate-700 border border-slate-200">
                    {currentLoanItem?.available_quantity ?? 0} unidades
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Asignado a (Estudiante / Grupo / Mesa) *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Grupo 2 - Mecatrónica / Bryan Morales"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas de Entrega / Práctica
                </label>
                <textarea
                  placeholder="Ej: Práctica de sensores analógicos en Mesa 3. Devolución 16:30 hrs."
                  value={loanNotes}
                  onChange={(e) => setLoanNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLoanModalOpen(false)}
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[44px] sm:min-h-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || (currentLoanItem?.available_quantity ?? 0) <= 0}
                  className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 min-h-[44px] sm:min-h-0"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar Préstamo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reportar Falla */}
      {faultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[95%] sm:max-w-md max-h-[92vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-red-50/50 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-red-600 text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reporte de Avería Técnica</h3>
                  <p className="text-[11px] text-slate-500">Notificar daño o solicitar mantenimiento</p>
                </div>
              </div>
              <button
                onClick={() => setFaultModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFaultSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Equipo Afectado *
                </label>
                <select
                  value={faultEqId}
                  onChange={(e) => setFaultEqId(Number(e.target.value))}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {formatEquipmentName(eq.name)} · [{eq.category}] (Condición: {eq.condition})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Clasificación del Estado *
                </label>
                <select
                  value={faultCondition}
                  onChange={(e) => setFaultCondition(e.target.value as any)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="Requiere Mantenimiento">Requiere Mantenimiento (Reparable)</option>
                  <option value="Dañado/Baja">Dañado / Baja Definitiva (Inoperativo)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción Detallada de la Falla *
                </label>
                <textarea
                  placeholder="Ej: Falla en canal 1 del osciloscopio tras sobrevoltaje en práctica de rectificadores."
                  value={faultNotes}
                  onChange={(e) => setFaultNotes(e.target.value)}
                  rows={3}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  required
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFaultModalOpen(false)}
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[44px] sm:min-h-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 min-h-[44px] sm:min-h-0"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Registrar Falla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
