'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EquipmentTransaction, LabEquipment, Profile } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionModal } from '@/components/ui/ActionModal';
import {
  BookOpen,
  RotateCcw,
  Plus,
  Loader2,
  Calendar,
  User,
  Package,
  Clock,
  CheckCircle2,
  Search,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

export default function LoansPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<EquipmentTransaction[]>([]);
  const [equipmentList, setEquipmentList] = useState<LabEquipment[]>([]);

  // Modal para devolver
  const [returningTx, setReturningTx] = useState<EquipmentTransaction | null>(null);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');

  // Modal para nuevo préstamo
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [selectedEqId, setSelectedEqId] = useState<number>(0);
  const [loanQty, setLoanQty] = useState<number>(1);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [loanNotes, setLoanNotes] = useState<string>('');
  const [submittingLoan, setSubmittingLoan] = useState(false);

  // Filtro
  const [filterQuery, setFilterQuery] = useState('');

  const canManage = profile?.role === 'admin' || profile?.role === 'teacher';

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [userRes, txRes, eqRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('equipment_transactions')
        .select('*, lab_equipment(id, name, category, location, available_quantity, total_quantity)')
        .in('action', ['PRESTAMO_CLASE', 'DEVOLUCION'])
        .order('timestamp', { ascending: false }),
      supabase.from('lab_equipment').select('*').order('name', { ascending: true }),
    ]);

    if (userRes.data?.user) {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userRes.data.user.id)
        .single();
      if (p) setProfile(p as Profile);
    }

    if (txRes.data) {
      setTransactions(txRes.data as EquipmentTransaction[]);
    }

    if (eqRes.data) {
      setEquipmentList(eqRes.data as LabEquipment[]);
      if (eqRes.data.length > 0 && selectedEqId === 0) {
        setSelectedEqId(eqRes.data[0].id);
      }
    }

    setLoading(false);
  }, [supabase, selectedEqId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Separar préstamos e historial de devoluciones
  // Un préstamo se considera "activo" si la cantidad disponible en el equipo es menor a la total o es reciente
  const loansList = transactions.filter((t) => t.action === 'PRESTAMO_CLASE');
  const returnList = transactions.filter((t) => t.action === 'DEVOLUCION');

  const filteredLoans = loansList.filter((l) => {
    const query = filterQuery.toLowerCase();
    const name = l.lab_equipment?.name?.toLowerCase() || '';
    const student = l.assigned_to?.toLowerCase() || '';
    const notes = l.notes?.toLowerCase() || '';
    return name.includes(query) || student.includes(query) || notes.includes(query);
  });

  async function handleConfirmReturn() {
    if (!returningTx || !returningTx.lab_equipment) return;
    setSubmittingReturn(true);

    try {
      const eqId = returningTx.equipment_id;
      const returnQuantity = returningTx.quantity || 1;

      // 1. Obtener la cantidad actual del equipo
      const { data: currentEq, error: fetchErr } = await supabase
        .from('lab_equipment')
        .select('available_quantity, total_quantity')
        .eq('id', eqId)
        .single();

      if (fetchErr) throw fetchErr;

      const newAvailable = Math.min(
        currentEq.total_quantity,
        currentEq.available_quantity + returnQuantity
      );

      // 2. Incrementar stock disponible
      const { error: updateErr } = await supabase
        .from('lab_equipment')
        .update({ available_quantity: newAvailable })
        .eq('id', eqId);

      if (updateErr) throw updateErr;

      // 3. Registrar transacción de devolución
      const operatorName = profile?.full_name || profile?.email || 'Docente';
      const { error: txErr } = await supabase.from('equipment_transactions').insert({
        equipment_id: eqId,
        action: 'DEVOLUCION',
        quantity: returnQuantity,
        assigned_to: returningTx.assigned_to,
        operator: operatorName,
        notes: returnNotes.trim() || `Devolución de préstamo #${returningTx.id}`,
      });

      if (txErr) throw txErr;

      toast.success('Equipo devuelto al inventario disponible', {
        description: `${returnQuantity}x ${returningTx.lab_equipment.name} reintegrado con éxito.`,
      });

      setReturningTx(null);
      setReturnNotes('');
      fetchData();
    } catch (err: any) {
      toast.error('Error al registrar devolución', { description: err.message });
    } finally {
      setSubmittingReturn(false);
    }
  }

  async function handleCreateLoan(e: React.FormEvent) {
    e.preventDefault();
    const currentItem = equipmentList.find((e) => e.id === Number(selectedEqId));
    if (!currentItem) return;

    if (loanQty > currentItem.available_quantity) {
      toast.error('Cantidad no disponible', {
        description: `Solo hay ${currentItem.available_quantity} unidades disponibles.`,
      });
      return;
    }

    setSubmittingLoan(true);
    try {
      const newAvailable = currentItem.available_quantity - loanQty;

      // 1. Descontar disponible
      const { error: updateErr } = await supabase
        .from('lab_equipment')
        .update({ available_quantity: newAvailable })
        .eq('id', currentItem.id);

      if (updateErr) throw updateErr;

      // 2. Insertar préstamo
      const operatorName = profile?.full_name || profile?.email || 'Docente';
      const { error: txErr } = await supabase.from('equipment_transactions').insert({
        equipment_id: currentItem.id,
        action: 'PRESTAMO_CLASE',
        quantity: loanQty,
        assigned_to: assignedTo.trim(),
        operator: operatorName,
        notes: loanNotes.trim() || 'Préstamo para práctica en laboratorio',
      });

      if (txErr) throw txErr;

      toast.success('Préstamo registrado exitosamente');
      setLoanModalOpen(false);
      setAssignedTo('');
      setLoanNotes('');
      setLoanQty(1);
      fetchData();
    } catch (err: any) {
      toast.error('Error al registrar préstamo', { description: err.message });
    } finally {
      setSubmittingLoan(false);
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
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Centro de Préstamos</h1>
            <p className="text-xs text-slate-500">
              Control de hardware y kits didácticos asignados a estudiantes y clases
            </p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={() => setLoanModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Préstamo</span>
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="card p-4 bg-white">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por equipo, estudiante o notas..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="input-field pl-10 text-xs"
          />
        </div>
      </div>

      {/* Tabla 1: Préstamos Activos */}
      <div className="card bg-white overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-blue-50/40">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Préstamos Registrados ({filteredLoans.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">Taller Luban - INATEC</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-left">
                <th className="px-4 py-3">Equipo Técnico</th>
                <th className="px-4 py-3">Cant.</th>
                <th className="px-4 py-3">Asignado a</th>
                <th className="px-4 py-3">Docente Emisor</th>
                <th className="px-4 py-3">Fecha y Hora</th>
                <th className="px-4 py-3">Notas</th>
                {canManage && <th className="px-4 py-3 text-right">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="text-center py-12 text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <p className="font-semibold text-slate-700">Sin préstamos pendientes</p>
                    <p className="text-slate-400 mt-0.5">Todos los equipos están en bodega o no coinciden con la búsqueda.</p>
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div>{loan.lab_equipment?.name || `Equipo #${loan.equipment_id}`}</div>
                      <span className="badge badge-info text-[10px] mt-0.5">
                        {loan.lab_equipment?.category || 'IoT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-700 font-mono">
                      {loan.quantity} u.
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{loan.assigned_to || 'Clase General'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{loan.operator || 'Docente'}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {new Date(loan.timestamp).toLocaleString('es-NI', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                      {loan.notes || '—'}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setReturningTx(loan)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3 text-emerald-600" />
                          <span>Registrar Devolución</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla 2: Historial de Devoluciones Recientes */}
      <div className="card bg-white overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-emerald-50/30">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Historial de Devoluciones Recientes ({returnList.length})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-left">
                <th className="px-4 py-3">Equipo Devuelto</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Entregado Por</th>
                <th className="px-4 py-3">Recibido Por</th>
                <th className="px-4 py-3">Fecha de Retorno</th>
                <th className="px-4 py-3">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returnList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No se han registrado devoluciones aún.
                  </td>
                </tr>
              ) : (
                returnList.slice(0, 10).map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {ret.lab_equipment?.name || `Equipo #${ret.equipment_id}`}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-700 font-mono">
                      {ret.quantity} u.
                    </td>
                    <td className="px-4 py-3 text-slate-700">{ret.assigned_to || 'Estudiante'}</td>
                    <td className="px-4 py-3 text-slate-600">{ret.operator || 'Docente'}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {new Date(ret.timestamp).toLocaleString('es-NI', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{ret.notes || 'Reintegrado a stock'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Devolución */}
      <ActionModal
        isOpen={Boolean(returningTx)}
        onClose={() => setReturningTx(null)}
        onConfirm={handleConfirmReturn}
        title="Confirmar Devolución de Equipo"
        description={
          <span>
            ¿Confirmas la devolución de{' '}
            <strong className="text-slate-900">
              {returningTx?.quantity}x {returningTx?.lab_equipment?.name}
            </strong>{' '}
            prestado a <strong className="text-slate-900">{returningTx?.assigned_to}</strong>?
            El equipo volverá a estar disponible para prácticas.
          </span>
        }
        confirmText="Confirmar Reintegro"
        variant="success"
        loading={submittingReturn}
      >
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Estado de los equipos al recibir / Notas
          </label>
          <input
            type="text"
            placeholder="Ej: Entregado en perfecto estado con todos sus cables."
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
            className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
          />
        </div>
      </ActionModal>

      {/* Modal Nuevo Préstamo */}
      {loanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[95%] sm:max-w-md max-h-[92vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-blue-50/50 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <h3 className="text-sm font-bold text-slate-900">Registrar Préstamo de Laboratorio</h3>
              <button
                onClick={() => setLoanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-md min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Equipo *</label>
                <select
                  value={selectedEqId}
                  onChange={(e) => setSelectedEqId(Number(e.target.value))}
                  className="select-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                  required
                >
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id} disabled={eq.available_quantity <= 0}>
                      {eq.name} ({eq.available_quantity} disp.) · [{eq.category}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad *</label>
                <input
                  type="number"
                  min={1}
                  value={loanQty}
                  onChange={(e) => setLoanQty(Number(e.target.value))}
                  className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estudiante / Grupo Receptivo *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Bryan Morales / Grupo Robótica 3"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notas de Práctica</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Uso en banco de pruebas 1. Entrega 16:00 hrs."
                  value={loanNotes}
                  onChange={(e) => setLoanNotes(e.target.value)}
                  className="input-field text-xs resize-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLoanModalOpen(false)}
                  disabled={submittingLoan}
                  className="btn-secondary text-xs w-full sm:w-auto min-h-[44px] sm:min-h-0 justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingLoan}
                  className="btn-primary text-xs flex items-center justify-center gap-1.5 w-full sm:w-auto min-h-[44px] sm:min-h-0"
                >
                  {submittingLoan && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar Préstamo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
