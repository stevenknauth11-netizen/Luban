'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { EquipmentCategoryRecord } from '@/lib/types';
import {
  Tag,
  Plus,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Pencil,
  Power,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCategoriesPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<EquipmentCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EquipmentCategoryRecord | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('equipment_categories')
      .select('*')
      .order('id', { ascending: true });

    if (data) {
      setCategories(data as EquipmentCategoryRecord[]);
    } else if (error) {
      console.warn('Error loading categories:', error.message);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handleOpenCreate() {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setModalOpen(true);
  }

  function handleOpenEdit(cat: EquipmentCategoryRecord) {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('equipment_categories')
          .update({
            name: name.trim(),
            description: description.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Categoría actualizada con éxito');
      } else {
        const { error } = await supabase.from('equipment_categories').insert([
          {
            name: name.trim(),
            description: description.trim(),
            is_active: true,
          },
        ]);

        if (error) throw error;
        toast.success('Nueva categoría creada en el sistema');
      }

      setModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      toast.error('Error al guardar categoría', {
        description: err.message || 'Verifica que el nombre no esté duplicado.',
      });
    } finally {
      setSaving(false);
    }
  }

  // Toggle de Soft-Delete / Desactivación (En lugar de eliminar físicamente)
  async function handleToggleStatus(cat: EquipmentCategoryRecord) {
    setTogglingId(cat.id);
    const newStatus = !cat.is_active;

    try {
      const { error } = await supabase
        .from('equipment_categories')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cat.id);

      if (error) throw error;

      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, is_active: newStatus } : c))
      );

      toast.info(
        newStatus
          ? `Categoría "${cat.name}" reactivada para nuevos equipos`
          : `Categoría "${cat.name}" desactivada (oculta de selectores pero preservada para auditoría)`
      );
    } catch (err: any) {
      toast.error('Error al cambiar estado', { description: err.message });
    } finally {
      setTogglingId(null);
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
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Administración de Categorías de Laboratorio
            </h1>
            <p className="text-xs text-slate-500">
              Especialidades técnicas dinámicas con protección de integridad (Soft-Deletes)
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="btn-primary text-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Categoría</span>
        </button>
      </div>

      {/* Buscador */}
      <div className="card p-4 bg-white">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar categoría por nombre o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 text-xs"
          />
        </div>
      </div>

      {/* Tabla de Categorías */}
      <div className="card bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-left">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Nombre de Especialidad</th>
                <th className="px-4 py-3">Descripción Didáctica</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No hay categorías registradas</p>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr
                    key={cat.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      !cat.is_active ? 'bg-slate-50/50 opacity-75' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-slate-400 font-bold">
                      #{String(cat.id).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-blue-500" />
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-md">
                      {cat.description || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {cat.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          <XCircle className="w-3 h-3 text-slate-400" />
                          Desactivada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Editar Categoría"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(cat)}
                          disabled={togglingId === cat.id}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                            cat.is_active
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                          title={cat.is_active ? 'Desactivar Categoría' : 'Reactivar Categoría'}
                        >
                          {togglingId === cat.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Power className="w-3 h-3" />
                          )}
                          <span>{cat.is_active ? 'Desactivar' : 'Reactivar'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scaleUp">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCategory ? 'Editar Categoría' : 'Nueva Especialidad Técnica'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Robótica Submarina / Drones"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción del Ámbito Didáctico
                </label>
                <textarea
                  rows={3}
                  placeholder="Define qué tipo de activos y equipos cubre esta categoría en los cursos de INATEC..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
