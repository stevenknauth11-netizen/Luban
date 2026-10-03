'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LabEquipment, Profile, EquipmentCondition } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionModal } from '@/components/ui/ActionModal';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  FileText,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

export default function MaintenancePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [damagedItems, setDamagedItems] = useState<LabEquipment[]>([]);

  // Modal de Reparación
  const [repairTarget, setRepairTarget] = useState<LabEquipment | null>(null);
  const [repairNotes, setRepairNotes] = useState('');
  const [targetCondition, setTargetCondition] = useState<EquipmentCondition>('Óptimo');
  const [submittingRepair, setSubmittingRepair] = useState(false);

  const canManage = profile?.role === 'admin' || profile?.role === 'teacher';

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [userRes, eqRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('lab_equipment')
        .select('*')
        .in('condition', ['Requiere Mantenimiento', 'Dañado/Baja'])
        .order('updated_at', { ascending: false }),
    ]);

    if (userRes.data?.user) {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userRes.data.user.id)
        .single();
      if (p) setProfile(p as Profile);
    }

    if (eqRes.data) {
      setDamagedItems(eqRes.data as LabEquipment[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleConfirmRepair() {
    if (!repairTarget) return;

    if (!repairNotes.trim()) {
      toast.error('Notas técnicas requeridas', {
        description: 'Detalla el procedimiento o sustitución efectuada en el equipo.',
      });
      return;
    }

    setSubmittingRepair(true);
    try {
      // 1. Restaurar condición del equipo a Óptimo y recuperar su cantidad disponible
      const { error: updateErr } = await supabase
        .from('lab_equipment')
        .update({
          condition: targetCondition,
          available_quantity: repairTarget.total_quantity,
        })
        .eq('id', repairTarget.id);

      if (updateErr) throw updateErr;

      // 2. Registrar en transacciones la resolución del mantenimiento
      const operatorName = profile?.full_name || profile?.email || 'Técnico de Laboratorio';
      const { error: txErr } = await supabase.from('equipment_transactions').insert({
        equipment_id: repairTarget.id,
        action: 'INGRESO_NUEVO',
        quantity: repairTarget.total_quantity,
        assigned_to: repairTarget.location,
        operator: operatorName,
        notes: `[Mantenimiento Completado - Estado: ${targetCondition}] ${repairNotes.trim()}`,
      });

      if (txErr) throw txErr;

      toast.success('Equipo Reparado y Reintegrado', {
        description: `${repairTarget.name} fue reintegrado con éxito al inventario activo.`,
      });

      setRepairTarget(null);
      setRepairNotes('');
      fetchData();
    } catch (err: any) {
      toast.error('Error al procesar mantenimiento', { description: err.message });
    } finally {
      setSubmittingRepair(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Taller de Mantenimiento</h1>
            <p className="text-xs text-slate-500">
              Cola de reparación técnica, diagnóstico de fallas y calibración de activos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge badge-danger text-xs font-bold">
            {damagedItems.length} Equipos en cola
          </span>
        </div>
      </div>

      {/* Tarjetas de Diagnóstico */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {damagedItems.length === 0 ? (
          <div className="col-span-full card p-12 text-center bg-white">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
            <h3 className="text-base font-bold text-slate-900">
              Laboratorio en Óptimas Condiciones
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No hay hardware registrado con averías, desgastes críticos o requerimientos de mantenimiento en el Taller Luban.
            </p>
          </div>
        ) : (
          damagedItems.map((item) => (
            <div
              key={item.id}
              className="card p-5 bg-white border border-red-100 hover:border-red-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="badge badge-info text-[10px] font-mono font-bold">
                    {item.category}
                  </span>
                  <StatusBadge status={item.condition} size="sm" />
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {item.name}
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  {item.description || 'Sin notas de descripción técnica.'}
                </p>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ubicación: <strong>{item.location}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                    <span>Afectados: <strong>{item.total_quantity} unidades</strong></span>
                  </div>
                </div>
              </div>

              {canManage && (
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end">
                  <button
                    onClick={() => {
                      setRepairTarget(item);
                      setTargetCondition('Óptimo');
                      setRepairNotes('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Reintegrar a Stock</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Reintegrar / Finalizar Reparación */}
      <ActionModal
        isOpen={Boolean(repairTarget)}
        onClose={() => setRepairTarget(null)}
        onConfirm={handleConfirmRepair}
        title="Finalizar Mantenimiento y Reintegrar Activo"
        description={
          <span>
            Estás a punto de reincorporar{' '}
            <strong className="text-slate-900">{repairTarget?.name}</strong> al catálogo
            disponible para clases y prácticas.
          </span>
        }
        confirmText="Confirmar Reincorporación"
        variant="success"
        loading={submittingRepair}
      >
        <div className="space-y-3 mt-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nueva Condición del Equipo
            </label>
            <select
              value={targetCondition}
              onChange={(e) => setTargetCondition(e.target.value as EquipmentCondition)}
              className="select-field text-xs"
            >
              <option value="Óptimo">Óptimo (Completamente Reparado y Calibrado)</option>
              <option value="Desgaste Menor">Desgaste Menor (Operativo con Observaciones)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Procedimiento Técnico de Reparación / Notas *
            </label>
            <textarea
              rows={3}
              placeholder="Ej: Reemplazo de diodo de protección en línea de alimentación. Calibrado y probado con carga."
              value={repairNotes}
              onChange={(e) => setRepairNotes(e.target.value)}
              className="input-field text-xs resize-none"
              required
            />
          </div>
        </div>
      </ActionModal>
    </div>
  );
}
