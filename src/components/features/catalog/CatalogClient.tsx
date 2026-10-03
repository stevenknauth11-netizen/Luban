'use client';

import React, { useState, useMemo } from 'react';
import type { LabEquipment, EquipmentCategoryRecord } from '@/lib/types';
import { EquipmentCard } from './EquipmentCard';
import { exportInatecLabReport } from '@/lib/exportToExcel';
import {
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Package,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Download,
} from 'lucide-react';

interface CatalogClientProps {
  initialEquipment: LabEquipment[];
  categories: EquipmentCategoryRecord[];
}

export function CatalogClient({
  initialEquipment,
  categories,
}: CatalogClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'available' | 'alert'>('all');

  // Filtrado reactivo en memoria
  const filteredEquipment = useMemo(() => {
    return initialEquipment.filter((item) => {
      // 1. Filtro de Categoría
      const catName =
        (item as any).equipment_categories?.name ||
        (typeof item.category === 'string' ? item.category : '');
      const matchesCategory =
        selectedCategory === 'all' || catName === selectedCategory || item.category === selectedCategory;

      if (!matchesCategory) return false;

      // 2. Filtro de Disponibilidad
      const available = item.available_quantity ?? 0;
      const minAlert = item.min_stock_alert ?? 3;
      if (filterAvailability === 'available' && available === 0) {
        return false;
      }
      if (filterAvailability === 'alert' && (available === 0 || available > minAlert)) {
        return false;
      }

      // 3. Filtro de Búsqueda
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const name = item.name.toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const shortDesc = (item.short_description || '').toLowerCase();
      const educational = (item.educational_use || '').toLowerCase();
      const location = (item.location || '').toLowerCase();

      return (
        name.includes(query) ||
        desc.includes(query) ||
        shortDesc.includes(query) ||
        educational.includes(query) ||
        location.includes(query)
      );
    });
  }, [initialEquipment, selectedCategory, filterAvailability, searchQuery]);

  // Conteo por categoría
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    initialEquipment.forEach((item) => {
      const catName =
        (item as any).equipment_categories?.name ||
        (typeof item.category === 'string' ? item.category : 'General');
      map[catName] = (map[catName] || 0) + 1;
    });
    return map;
  }, [initialEquipment]);

  const activeCategories = categories.filter((c) => c.is_active);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* SECCIÓN A: Cabecera y Buscador */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge badge-info text-xs font-mono font-bold">
                INATEC · Taller Lúban
              </span>
              <span className="text-xs text-slate-400 font-mono">Vitrina Tecnológica</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              Catálogo de Equipos y Componentes
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Explora los microcontroladores, sensores, instrumental y recursos disponibles para prácticas
            </p>
          </div>

          {/* Toggle de Vistas y Descarga Excel */}
          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() =>
                exportInatecLabReport(filteredEquipment, [], {
                  category: selectedCategory,
                  searchQuery,
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shadow-2xs"
              title="Descargar reporte oficial en formato Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Exportar Excel{' '}
                {selectedCategory !== 'all' ? `(${filteredEquipment.length})` : `(${filteredEquipment.length})`}
              </span>
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Vista Cuadrícula"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cuadrícula</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Vista Lista"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Búsqueda Amplia */}
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, sensor, microcontrolador, aplicación o ubicación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro Rápido de Disponibilidad */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setFilterAvailability('all')}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                filterAvailability === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({initialEquipment.length})
            </button>
            <button
              onClick={() => setFilterAvailability('available')}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                filterAvailability === 'available'
                  ? 'bg-white text-emerald-800 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Disponibles
            </button>
            <button
              onClick={() => setFilterAvailability('alert')}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                filterAvailability === 'alert'
                  ? 'bg-white text-amber-800 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              Poco Stock
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN B: Sistema de Filtrado de Categorías (Pills Horizontales) */}
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="flex items-center gap-2 min-w-max">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            Todas las Especialidades ({initialEquipment.length})
          </button>

          {activeCategories.map((cat) => {
            const count = categoryCounts[cat.name] || 0;
            const isSelected = selectedCategory === cat.name;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN C: Cuadrícula de Equipos (Grid Showcase) */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono mb-4">
          <span>Mostrando {filteredEquipment.length} equipos</span>
          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="text-red-600 hover:underline font-sans font-semibold"
            >
              Limpiar filtro de categoría
            </button>
          )}
        </div>

        {filteredEquipment.length === 0 ? (
          <div className="card p-12 text-center bg-white border border-slate-200">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">
              No se encontraron componentes en la vitrina
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No hay equipos que coincidan con la búsqueda "{searchQuery}" o con los filtros activos.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setFilterAvailability('all');
              }}
              className="mt-4 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-4.5">
            {filteredEquipment.map((item) => (
              <EquipmentCard key={item.id} item={item} viewMode="grid" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEquipment.map((item) => (
              <EquipmentCard key={item.id} item={item} viewMode="list" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
