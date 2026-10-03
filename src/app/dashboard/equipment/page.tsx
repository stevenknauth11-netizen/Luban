'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type {
  LabEquipment,
  Profile,
  EquipmentCondition,
  EquipmentCategoryRecord,
} from '@/lib/types';
import { EQUIPMENT_CONDITIONS, formatEquipmentName } from '@/lib/types';
import { exportInatecLabReport } from '@/lib/exportToExcel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionModal } from '@/components/ui/ActionModal';
import {
  Plus,
  Download,
  Loader2,
  Cpu,
  Search,
  ExternalLink,
  MapPin,
  Package,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Archive,
  Power,
  RotateCcw,
  BookOpen,
  Pencil,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface EquipmentFormData {
  name: string;
  category_id: number | null;
  category: string;
  total_quantity: number;
  available_quantity: number;
  condition: EquipmentCondition;
  location: string;
  description: string;
  short_description: string;
  educational_use: string;
  is_consumable: boolean;
  min_stock_alert: number;
  datasheet_url: string;
}

const EMPTY_FORM: EquipmentFormData = {
  name: '',
  category_id: null,
  category: 'IoT',
  total_quantity: 1,
  available_quantity: 1,
  condition: 'Óptimo',
  location: 'Laboratorio IoT - Mesa 1',
  description: '',
  short_description: '',
  educational_use: '',
  is_consumable: false,
  min_stock_alert: 3,
  datasheet_url: '',
};

export default function EquipmentCatalogPage() {
  const supabase = createClient();
  const [data, setData] = useState<LabEquipment[]>([]);
  const [categories, setCategories] = useState<EquipmentCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Pestaña de estado: 'active' (en servicio) o 'archived' (archivados por soft-delete)
  const [statusTab, setStatusTab] = useState<'active' | 'archived'>('active');

  // Modo de visualización: 'grid' (estudiante/wiki) o 'table' (docente/inventario)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LabEquipment | null>(null);
  const [form, setForm] = useState<EquipmentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Soft-Delete / Archive Target
  const [archiveTarget, setArchiveTarget] = useState<LabEquipment | null>(null);
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);

  const canEdit = profile?.role === 'admin' || profile?.role === 'teacher';
  const canArchive = profile?.role === 'admin';

  // Carga de datos
  const fetchData = useCallback(async () => {
    setLoading(true);

    const [eqRes, catRes, userRes] = await Promise.all([
      supabase
        .from('lab_equipment')
        .select('*, equipment_categories(id, name)')
        .order('name', { ascending: true }),
      supabase
        .from('equipment_categories')
        .select('*')
        .order('name', { ascending: true }),
      supabase.auth.getUser(),
    ]);

    if (userRes.data?.user) {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userRes.data.user.id)
        .single();
      if (p) {
        setProfile(p as Profile);
        if (p.role === 'teacher' || p.role === 'admin') {
          setViewMode('table');
        }
      }
    }

    if (catRes.data) {
      setCategories(catRes.data as EquipmentCategoryRecord[]);
    }

    if (eqRes.data) {
      setData(eqRes.data as LabEquipment[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtrado compuesto (Pestaña Activo vs Archivado + Buscador + Categoría)
  const filteredItems = useMemo(() => {
    return data.filter((item) => {
      // 1. Filtro de Soft-Delete (is_active)
      const isArchived = item.is_active === false;
      if (statusTab === 'active' && isArchived) return false;
      if (statusTab === 'archived' && !isArchived) return false;

      // 2. Filtro de búsqueda
      const catName =
        (item as any).equipment_categories?.name || item.category || '';
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(query) ||
        (item.short_description || '').toLowerCase().includes(query) ||
        (item.educational_use || '').toLowerCase().includes(query) ||
        (item.location || '').toLowerCase().includes(query);

      // 3. Filtro de Categoría
      const matchesCat =
        selectedCategory === 'all' ||
        catName === selectedCategory ||
        item.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [data, statusTab, searchQuery, selectedCategory]);

  const activeCount = data.filter((d) => d.is_active !== false).length;
  const archivedCount = data.filter((d) => d.is_active === false).length;

  function handleOpenCreate() {
    setEditingItem(null);
    const activeCats = categories.filter((c) => c.is_active);
    setForm({
      ...EMPTY_FORM,
      category_id: activeCats[0]?.id || null,
      category: activeCats[0]?.name || 'IoT',
    });
    setModalOpen(true);
  }

  function handleOpenEdit(item: LabEquipment) {
    setEditingItem(item);
    setForm({
      name: item.name,
      category_id: item.category_id || null,
      category: typeof item.category === 'string' ? item.category : 'General',
      total_quantity: item.total_quantity,
      available_quantity: item.available_quantity,
      condition: item.condition,
      location: item.location,
      description: item.description || '',
      short_description: item.short_description || '',
      educational_use: item.educational_use || '',
      is_consumable: item.is_consumable || false,
      min_stock_alert: item.min_stock_alert || 3,
      datasheet_url: item.datasheet_url || '',
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const selectedCat = categories.find((c) => c.id === form.category_id);
      const payload = {
        name: form.name.trim(),
        category_id: form.category_id,
        category: selectedCat ? selectedCat.name : form.category,
        total_quantity: form.total_quantity,
        available_quantity: form.available_quantity,
        condition: form.condition,
        location: form.location.trim(),
        description: form.description.trim(),
        short_description: form.short_description.trim(),
        educational_use: form.educational_use.trim(),
        is_consumable: form.is_consumable,
        min_stock_alert: form.min_stock_alert,
        datasheet_url: form.datasheet_url.trim(),
        is_active: true,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('lab_equipment')
          .update(payload)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Equipo técnico actualizado en la Base de Conocimiento');
      } else {
        const { error } = await supabase.from('lab_equipment').insert([payload]);
        if (error) throw error;
        toast.success('Nuevo activo educativo incorporado al catálogo');
      }

      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error('Error al guardar equipo', {
        description: err.message || 'Verifica que el nombre no esté duplicado.',
      });
    } finally {
      setSaving(false);
    }
  }

  // =========================================================================
  // LÓGICA DE SOFT-DELETE: UPDATE is_active = false
  // En lugar de llamar a supabase.from().delete() (prohibido por auditoría)
  // =========================================================================
  async function handleConfirmSoftDelete() {
    if (!archiveTarget) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('lab_equipment')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', archiveTarget.id);

      if (error) throw error;

      toast.info('Activo archivado mediante Soft-Delete', {
        description: `${archiveTarget.name} fue trasladado a Equipos Archivados (se preserva todo su historial).`,
      });

      setArchiveTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error('Error al archivar equipo', { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  // Reactivar equipo desde la pestaña de archivados
  async function handleReactivate(item: LabEquipment) {
    setReactivatingId(item.id);
    try {
      const { error } = await supabase
        .from('lab_equipment')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Activo reactivado exitosamente', {
        description: `${item.name} vuelve a estar en el catálogo en servicio.`,
      });

      fetchData();
    } catch (err: any) {
      toast.error('Error al reactivar equipo', { description: err.message });
    } finally {
      setReactivatingId(null);
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
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Catálogo y Base de Conocimiento Educativa
            </h1>
            <p className="text-xs text-slate-500">
              Taller Lúban · Recursos didácticos y activos técnicos · Rol:{' '}
              <span className="font-semibold text-slate-700 capitalize">
                {profile?.role || 'viewer'}
              </span>
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Switch Grid vs DataGrid */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Wiki Grid</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>DataGrid</span>
            </button>
          </div>

          <button
            onClick={() =>
              exportInatecLabReport(filteredItems, [], {
                category: selectedCategory,
                searchQuery,
                statusTab,
              })
            }
            className="btn-secondary text-xs flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shadow-2xs"
            title="Descargar inventario filtrado actual en Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar Excel ({filteredItems.length})</span>
          </button>

          {canEdit && (
            <button
              onClick={handleOpenCreate}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Recurso</span>
            </button>
          )}
        </div>
      </div>

      {/* Pestañas de Estado (Activos vs Archivados - Soft Delete) */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setStatusTab('active')}
            className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition-colors ${
              statusTab === 'active'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Equipos en Servicio</span>
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px]">
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setStatusTab('archived')}
            className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition-colors ${
              statusTab === 'archived'
                ? 'border-red-600 text-red-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Equipos Archivados (Soft-Delete)</span>
            <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[10px]">
              {archivedCount}
            </span>
          </button>
        </div>

        {canArchive && (
          <Link
            href="/admin/categories"
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold mb-2"
          >
            ⚙ Administrar Categorías Dinámicas →
          </Link>
        )}
      </div>

      {/* Filtros de Búsqueda y Categorías */}
      <div className="card p-4 bg-white space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, uso educativo o especificaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas ({data.length})
            </button>
            {categories
              .filter((c) => c.is_active)
              .map((cat) => {
                const count = data.filter(
                  (d) =>
                    (d as any).equipment_categories?.name === cat.name ||
                    d.category === cat.name
                ).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                      selectedCategory === cat.name
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* VISTA 1: WIKI GRID (EDUCATIVO) */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.length === 0 ? (
            <div className="col-span-full card p-12 text-center text-slate-400 bg-white">
              <Package className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">
                {statusTab === 'archived'
                  ? 'No hay equipos archivados'
                  : 'No se encontraron equipos en esta categoría'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const catName =
                (item as any).equipment_categories?.name || item.category || 'General';
              const displayName = formatEquipmentName(item.name);
              const isAvailable = (item.available_quantity ?? 0) > 0;
              const percent = Math.round(
                ((item.available_quantity ?? 0) / (item.total_quantity || 1)) * 100
              );

              return (
                <div
                  key={item.id}
                  className={`card p-5 bg-white border hover:shadow-md transition-all flex flex-col justify-between ${
                    item.is_active === false
                      ? 'border-red-200 bg-red-50/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="badge badge-info text-[10px] font-mono font-bold">
                          {catName}
                        </span>
                        {item.is_consumable && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            Fungible
                          </span>
                        )}
                      </div>
                      <StatusBadge status={item.condition} size="sm" />
                    </div>

                    {/* Equipment Name */}
                    <Link
                      href={`/dashboard/equipment/${item.id}`}
                      className="group block"
                    >
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors leading-snug">
                        {displayName}
                      </h3>
                      {displayName !== item.name && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block mt-1">
                          {item.name}
                        </span>
                      )}
                    </Link>

                    {/* Descripción Corta (Qué es) */}
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {item.short_description ||
                        item.description ||
                        'Componente didáctico para prácticas de laboratorio.'}
                    </p>

                    {/* Uso Educativo (Para qué sirve) */}
                    {item.educational_use && (
                      <div className="mt-2.5 p-2 bg-blue-50/50 rounded border border-blue-100 text-[11px] text-blue-900">
                        <span className="font-bold">Uso didáctico:</span>{' '}
                        <span className="line-clamp-2">{item.educational_use}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.location || 'Laboratorio Central'}</span>
                    </div>

                    {/* Disponibilidad */}
                    <div className="mt-3.5 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-600">Disponibilidad en mesa:</span>
                        <span
                          className={
                            isAvailable
                              ? 'text-emerald-700 font-bold'
                              : 'text-red-600 font-bold'
                          }
                        >
                          {item.available_quantity} / {item.total_quantity} u.
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${
                            percent === 0
                              ? 'bg-red-500'
                              : percent < 30
                              ? 'bg-amber-500'
                              : 'bg-emerald-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer con Enlace a Wiki Educativa y Soft-Delete */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href={`/dashboard/equipment/${item.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ver Wiki Educativa</span>
                    </Link>

                    <div className="flex items-center gap-1.5">
                      {canEdit && item.is_active !== false && (
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 rounded text-slate-500 hover:text-slate-800"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canArchive && item.is_active !== false && (
                        <button
                          onClick={() => setArchiveTarget(item)}
                          className="p-1 rounded text-red-500 hover:text-red-700"
                          title="Archivar Equipo (Soft-Delete)"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canArchive && item.is_active === false && (
                        <button
                          onClick={() => handleReactivate(item)}
                          disabled={reactivatingId === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"
                        >
                          {reactivatingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>Reactivar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VISTA 2: DATAGRID DOCENTE / INVENTARIO */}
      {viewMode === 'table' && (
        <div className="card bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[750px] whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-left">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Activo / Equipo Técnico</th>
                  <th className="px-4 py-3">Especialidad</th>
                  <th className="px-4 py-3">Condición</th>
                  <th className="px-4 py-3">Disponibles / Total</th>
                  <th className="px-4 py-3">Ubicación</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const catName =
                    (item as any).equipment_categories?.name || item.category || 'General';
                  const displayName = formatEquipmentName(item.name);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-slate-400 font-bold">
                        #{String(item.id).padStart(4, '0')}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <Link
                          href={`/dashboard/equipment/${item.id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <span>{displayName}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                        {displayName !== item.name && (
                          <span className="text-[10px] font-mono text-slate-400 block font-normal">
                            {item.name}
                          </span>
                        )}
                        {item.short_description && (
                          <p className="text-[11px] text-slate-500 font-normal truncate max-w-xs">
                            {item.short_description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <span className="badge badge-info text-[10px]">{catName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.condition} size="sm" />
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className="font-bold text-slate-900">
                          {item.available_quantity}
                        </span>{' '}
                        / {item.total_quantity} u.
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.location}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/equipment/${item.id}`}
                            className="p-1 rounded text-slate-600 hover:text-slate-900"
                            title="Ver Wiki"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {canEdit && item.is_active !== false && (
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1 rounded text-slate-600 hover:text-slate-900"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canArchive && item.is_active !== false && (
                            <button
                              onClick={() => setArchiveTarget(item)}
                              className="p-1 rounded text-red-500 hover:text-red-700"
                              title="Archivar Equipo (Soft-Delete)"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canArchive && item.is_active === false && (
                            <button
                              onClick={() => handleReactivate(item)}
                              className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded border border-emerald-200"
                            >
                              Reactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR RECURSO EDUCATIVO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[95%] sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
              <h3 className="text-sm font-bold text-slate-900">
                {editingItem
                  ? 'Editar Recurso de la Base de Conocimiento'
                  : 'Registrar Nuevo Equipo y Recurso Educativo'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-md min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Activo Técnico *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Kit STM32F103VET6 NEWLab IoT"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Especialidad / Categoría Dinámica *
                  </label>
                  <select
                    value={form.category_id ?? ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const cat = categories.find((c) => c.id === id);
                      setForm({
                        ...form,
                        category_id: id,
                        category: cat ? cat.name : 'General',
                      });
                    }}
                    className="select-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                    required
                  >
                    <option value="" disabled>
                      Seleccionar categoría...
                    </option>
                    {categories
                      .filter((c) => c.is_active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado Físico Inicial *
                  </label>
                  <select
                    value={form.condition}
                    onChange={(e) =>
                      setForm({ ...form, condition: e.target.value as EquipmentCondition })
                    }
                    className="select-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                  >
                    {EQUIPMENT_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Campos Educativos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción General (¿Qué es?) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explica de forma concisa qué es este componente o instrumento..."
                  value={form.short_description}
                  onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                  className="input-field text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Aplicación Práctica Educativa (¿Para qué sirve en clases?) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detalla cómo los estudiantes de INATEC lo utilizan en sus proyectos y prácticas de taller..."
                  value={form.educational_use}
                  onChange={(e) => setForm({ ...form, educational_use: e.target.value })}
                  className="input-field text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cantidad Total *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.total_quantity}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setForm({
                        ...form,
                        total_quantity: val,
                        available_quantity: Math.min(val, form.available_quantity),
                      });
                    }}
                    className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cantidad Disponible *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={form.total_quantity}
                    required
                    value={form.available_quantity}
                    onChange={(e) =>
                      setForm({ ...form, available_quantity: Number(e.target.value) })
                    }
                    className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ubicación en Taller *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Mesa IoT 3 / Gaveta A-12"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alerta de Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.min_stock_alert}
                    onChange={(e) =>
                      setForm({ ...form, min_stock_alert: Number(e.target.value) })
                    }
                    className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                  />
                </div>
              </div>

              {/* Checkbox Consumible */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    ¿Es Material Consumible / Fungible?
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Marca esta opción si es estaño, filamento o resistencias que no se retornan.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={form.is_consumable}
                  onChange={(e) => setForm({ ...form, is_consumable: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 min-h-[20px] min-w-[20px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  URL del Datasheet o Documentación Técnica Oficial
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.datasheet_url}
                  onChange={(e) => setForm({ ...form, datasheet_url: e.target.value })}
                  className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="btn-secondary text-xs w-full sm:w-auto min-h-[44px] sm:min-h-0 justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs flex items-center justify-center gap-1.5 w-full sm:w-auto min-h-[44px] sm:min-h-0"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? 'Guardar Cambios' : 'Registrar Equipo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE SOFT-DELETE (ARCHIVAR) */}
      <ActionModal
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleConfirmSoftDelete}
        title="Archivar Equipo (Soft-Delete)"
        description={
          <span>
            ¿Confirmas que deseas archivar{' '}
            <strong className="text-slate-900">{archiveTarget?.name}</strong>? El registro no
            será eliminado de la base de datos para preservar la trazabilidad histórica de
            préstamos y auditoría INATEC. Podrás reactivarlo en cualquier momento.
          </span>
        }
        confirmText="Confirmar Archivo (Soft-Delete)"
        variant="warning"
        loading={saving}
      />
    </div>
  );
}
