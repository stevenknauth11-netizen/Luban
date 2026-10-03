'use client';

import { useMemo, useState } from 'react';
import type { LabEquipment, LabCategory, EquipmentCondition, Profile } from '@/lib/types';
import { LAB_CATEGORIES, EQUIPMENT_CONDITIONS, formatEquipmentName } from '@/lib/types';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Search,
  ArrowUpDown,
  Pencil,
  Trash2,
  ExternalLink,
  QrCode,
  PackageCheck,
  AlertOctagon,
  CheckCircle2,
  Clock,
  MapPin,
  Cpu,
} from 'lucide-react';
import { EquipmentOperationsModal, type OperationType } from './EquipmentOperationsModal';
import { EquipmentQrModal } from './EquipmentQrModal';

interface EquipmentTableProps {
  data: LabEquipment[];
  profile: Profile | null;
  onRefresh: () => void;
  onEdit: (item: LabEquipment) => void;
  onDelete: (item: LabEquipment) => void;
}

export function EquipmentTable({
  data,
  profile,
  onRefresh,
  onEdit,
  onDelete,
}: EquipmentTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');

  // Modales
  const [operationsItem, setOperationsItem] = useState<LabEquipment | null>(null);
  const [operationsType, setOperationsType] = useState<OperationType>('PRESTAMO');
  const [qrItem, setQrItem] = useState<LabEquipment | null>(null);

  const canOperate = profile?.role === 'admin' || profile?.role === 'teacher';
  const canDelete = profile?.role === 'admin';

  // Filtro compuesto
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (conditionFilter !== 'all' && item.condition !== conditionFilter) return false;
      return true;
    });
  }, [data, categoryFilter, conditionFilter]);

  function openOperation(item: LabEquipment, type: OperationType) {
    setOperationsItem(item);
    setOperationsType(type);
  }

  // Definición de Columnas
  const columns = useMemo<ColumnDef<LabEquipment>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 70,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-slate-400 font-bold">
            #{String(getValue()).padStart(4, '0')}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-slate-900"
            onClick={() => column.toggleSorting()}
          >
            Activo / Equipo Técnico <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        size: 260,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-sm">{formatEquipmentName(item.name)}</span>
                {item.name !== formatEquipmentName(item.name) && (
                  <span className="font-mono text-[9px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                    {item.name}
                  </span>
                )}
                <span className="badge badge-info text-[10px] py-0.5">{item.category}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>{item.location || 'Laboratorio Central'}</span>
                {item.description && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[180px]">{item.description}</span>
                  </>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: 'status_indicator',
        header: 'Estado Lógico',
        size: 140,
        cell: ({ row }) => {
          const item = row.original;
          const isDamaged = item.condition === 'Requiere Mantenimiento' || item.condition === 'Dañado/Baja';
          const isPartiallyInUse = item.available_quantity < item.total_quantity;
          const isFullyAvailable = item.available_quantity === item.total_quantity && !isDamaged;

          if (isDamaged) {
            return (
              <span className="badge badge-danger gap-1 text-[11px]">
                <AlertOctagon className="w-3 h-3" />
                {item.condition}
              </span>
            );
          }

          if (isPartiallyInUse) {
            return (
              <span className="badge badge-warning gap-1 text-[11px]">
                <Clock className="w-3 h-3" />
                En Uso / Préstamo
              </span>
            );
          }

          return (
            <span className="badge badge-success gap-1 text-[11px]">
              <CheckCircle2 className="w-3 h-3" />
              Disponible ({item.condition})
            </span>
          );
        },
      },
      {
        accessorKey: 'available_quantity',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-slate-900"
            onClick={() => column.toggleSorting()}
          >
            Disponibles / Total <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        size: 160,
        cell: ({ row }) => {
          const item = row.original;
          const inUse = item.total_quantity - item.available_quantity;
          return (
            <div>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span
                  className={`text-base font-extrabold ${
                    item.available_quantity === 0
                      ? 'text-red-600'
                      : item.available_quantity <= (item.min_threshold ?? 3)
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {item.available_quantity}
                </span>
                <span className="text-xs text-slate-400">/ {item.total_quantity} uds.</span>
              </div>
              {inUse > 0 && (
                <p className="text-[11px] text-amber-600 font-medium">
                  {inUse} ud(s) en clase
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'datasheet_url',
        header: 'Manual / Ficha',
        size: 110,
        cell: ({ getValue }) => {
          const url = getValue() as string;
          return url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs font-semibold"
            >
              Ficha <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Operaciones',
        size: 180,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-1">
              {/* Acciones Rápidas Educativas */}
              {canOperate && (
                <>
                  <button
                    onClick={() => openOperation(item, 'PRESTAMO')}
                    disabled={item.available_quantity === 0}
                    className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-30 disabled:pointer-events-none"
                    title="Prestar a Clase / Práctica"
                  >
                    <PackageCheck className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => openOperation(item, 'DANO')}
                    className="p-1.5 rounded hover:bg-red-50 text-red-600"
                    title="Reportar Daño o Mantenimiento"
                  >
                    <AlertOctagon className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Código QR e Impresión */}
              <button
                onClick={() => setQrItem(item)}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                title="Generar Etiqueta QR / Imprimir"
              >
                <QrCode className="w-4 h-4" />
              </button>

              {/* Edición institucional */}
              {canOperate && (
                <button
                  onClick={() => onEdit(item)}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                  title="Editar Ficha Técnica"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Eliminación restringida a Admin */}
              {canDelete && (
                <button
                  onClick={() => onDelete(item)}
                  className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                  title="Dar de Baja Definitiva"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [canOperate, canDelete, onEdit, onDelete]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Institucionales */}
      <div className="card p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 bg-white">
        <div className="relative flex-1 w-full sm:min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por equipo técnico, mesa o descripción..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="input-field pl-10 text-xs py-2.5 sm:py-2 w-full min-h-[44px] sm:min-h-0"
          />
        </div>

        {/* Filtro por Categoría */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="select-field w-full sm:w-auto sm:min-w-[170px] text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
        >
          <option value="all">Todas las Categorías</option>
          {LAB_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Filtro por Condición Física */}
        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="select-field w-full sm:w-auto sm:min-w-[190px] text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
        >
          <option value="all">Todas las Condiciones</option>
          {EQUIPMENT_CONDITIONS.map((cond) => (
            <option key={cond} value={cond}>
              {cond}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla TanStack */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px] whitespace-nowrap">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-16 text-slate-400">
                    <Cpu className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium">Sin equipos técnicos coincidentes</p>
                    <p className="text-xs mt-1">Verifica los filtros seleccionados o registra un nuevo activo.</p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="table-row-striped hover:bg-slate-50/80 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {table.getPageCount() > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-4 py-3 border-t border-slate-200 bg-slate-50/50">
            <p className="text-xs text-slate-500 text-center sm:text-left">
              Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()} ·{' '}
              {filteredData.length} activos en catálogo
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost text-xs px-3 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Anterior
              </button>
              <button
                className="btn btn-ghost text-xs px-3 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Operaciones Rápidas (Préstamo / Devolución / Daño) */}
      <EquipmentOperationsModal
        item={operationsItem}
        initialType={operationsType}
        isOpen={Boolean(operationsItem)}
        profile={profile}
        onClose={() => setOperationsItem(null)}
        onSuccess={() => {
          onRefresh();
          setOperationsItem(null);
        }}
      />

      {/* Modal de Código QR e Impresión */}
      <EquipmentQrModal
        item={qrItem as any}
        isOpen={Boolean(qrItem)}
        onClose={() => setQrItem(null)}
      />
    </div>
  );
}
