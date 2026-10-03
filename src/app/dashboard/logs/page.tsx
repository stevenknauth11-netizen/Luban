'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EquipmentTransaction, TransactionAction } from '@/lib/types';
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
  ClipboardList,
  Loader2,
  Calendar,
  RotateCcw,
  Bot,
  User,
  Clock,
  Filter,
  BookOpen,
  RotateCcw as DevolucionIcon,
  AlertOctagon,
  Sparkles,
  PlusCircle,
  Users,
} from 'lucide-react';

const TRANSACTION_CONFIG: Record<
  TransactionAction,
  { label: string; badge: string; icon: typeof PlusCircle }
> = {
  PRESTAMO_CLASE: { label: 'Préstamo a Clase', badge: 'badge-info', icon: BookOpen },
  DEVOLUCION: { label: 'Devolución', badge: 'badge-success', icon: DevolucionIcon },
  REPORTE_DANO: { label: 'Reporte de Daño', badge: 'badge-danger', icon: AlertOctagon },
  AUDITORIA_IA: { label: 'Auditoría IA', badge: 'badge-warning', icon: Sparkles },
  INGRESO_NUEVO: { label: 'Ingreso Nuevo', badge: 'badge-success', icon: PlusCircle },
};

export default function LogsPage() {
  const supabase = createClient();
  const [data, setData] = useState<EquipmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de ordenamiento y filtrado
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'timestamp', desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);

      const { data: txs, error } = await supabase
        .from('equipment_transactions')
        .select('*, lab_equipment(name, category, location)')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (txs && txs.length > 0) {
        setData(txs as EquipmentTransaction[]);
      } else {
        // Fallback a inventory_logs si aún no se migraron
        const { data: legacy } = await supabase
          .from('inventory_logs')
          .select('*, equipment_stock(name, category)')
          .order('timestamp', { ascending: false })
          .limit(500);

        if (legacy) {
          setData(
            legacy.map((l) => ({
              id: l.id,
              equipment_id: l.equipment_id,
              action: (l.action === 'ADD' ? 'INGRESO_NUEVO' : 'AUDITORIA_IA') as TransactionAction,
              quantity: 1,
              assigned_to: 'Taller Lúban',
              operator: 'IA Server (NEWLab)',
              notes: 'Movimiento detectado por cámara',
              timestamp: l.timestamp,
              lab_equipment: {
                name: (l.equipment_stock as any)?.name || `Activo #${l.equipment_id}`,
                category: (l.equipment_stock as any)?.category || 'IoT',
                location: 'Mesa 1',
              },
            }))
          );
        }
      }

      setLoading(false);
    }
    fetchLogs();
  }, [supabase]);

  // Filtrado compuesto
  const filteredData = useMemo(() => {
    return data.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;

      const logTime = new Date(log.timestamp).getTime();
      if (startDate) {
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        if (logTime < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        if (logTime > end) return false;
      }

      return true;
    });
  }, [data, actionFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const total = filteredData.length;
    const prestamos = filteredData.filter((l) => l.action === 'PRESTAMO_CLASE').length;
    const devoluciones = filteredData.filter((l) => l.action === 'DEVOLUCION').length;
    const danos = filteredData.filter((l) => l.action === 'REPORTE_DANO').length;
    const ia = filteredData.filter((l) => l.action === 'AUDITORIA_IA').length;
    return { total, prestamos, devoluciones, danos, ia };
  }, [filteredData]);

  function resetFilters() {
    setActionFilter('all');
    setStartDate('');
    setEndDate('');
    setGlobalFilter('');
  }

  const columns = useMemo<ColumnDef<EquipmentTransaction>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 70,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-slate-400 font-semibold">
            #{String(getValue()).padStart(5, '0')}
          </span>
        ),
      },
      {
        accessorKey: 'timestamp',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-slate-900"
            onClick={() => column.toggleSorting()}
          >
            Fecha y Hora <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        size: 170,
        cell: ({ getValue }) => {
          const d = new Date(getValue() as string);
          return (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-800 tabular-nums">
                  {d.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {d.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'action',
        header: 'Acción Educativa',
        size: 160,
        cell: ({ getValue }) => {
          const action = getValue() as TransactionAction;
          const config = TRANSACTION_CONFIG[action] ?? {
            label: action,
            badge: 'badge-info',
            icon: ClipboardList,
          };
          return (
            <span className={`badge ${config.badge} gap-1.5 text-[11px]`}>
              <config.icon className="w-3 h-3" />
              {config.label}
            </span>
          );
        },
      },
      {
        id: 'equipment_name',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-slate-900"
            onClick={() => column.toggleSorting()}
          >
            Activo Involucrado <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        accessorFn: (row) => row.lab_equipment?.name ?? `Activo #${row.equipment_id}`,
        size: 220,
        cell: ({ getValue, row }) => (
          <div>
            <p className="font-semibold text-slate-900 text-sm">{getValue() as string}</p>
            <p className="text-xs text-slate-400 font-mono">
              Cantidad: <span className="font-bold text-slate-700">{row.original.quantity} ud(s)</span> · ID: #{row.original.equipment_id}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'assigned_to',
        header: 'Asignado a / Grupo',
        size: 180,
        cell: ({ getValue }) => (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
            <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{(getValue() as string) || 'Sin asignar'}</span>
          </div>
        ),
      },
      {
        accessorKey: 'notes',
        header: 'Observaciones / Falla Técnica',
        size: 240,
        cell: ({ getValue }) => {
          const notes = getValue() as string;
          return notes ? (
            <p className="text-xs text-slate-600 italic line-clamp-2" title={notes}>
              &quot;{notes}&quot;
            </p>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          );
        },
      },
      {
        accessorKey: 'operator',
        header: 'Operador / Origen',
        size: 150,
        cell: ({ getValue }) => {
          const op = (getValue() as string) || 'Docente';
          const isAi = op.includes('IA') || op.includes('NEWLab');
          return (
            <div className="flex items-center gap-1.5 text-xs">
              {isAi ? <Bot className="w-3.5 h-3.5 text-indigo-600" /> : <User className="w-3.5 h-3.5 text-slate-600" />}
              <span className={isAi ? 'text-indigo-700 font-bold' : 'text-slate-700'}>{op}</span>
            </div>
          );
        },
      },
    ],
    []
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
    initialState: { pagination: { pageSize: 25 } },
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-2" />
        <p className="text-sm">Cargando libro de movimientos de laboratorio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="badge badge-info text-[10px] font-mono font-bold">
            TRAZABILIDAD INSTITUCIONAL
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
          Historial de Movimientos y Préstamos
        </h1>
        <p className="text-xs text-slate-500">
          Registro inmutable de préstamos a estudiantes, devoluciones, reportes de daño y conteos de IA
        </p>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="card p-3 bg-white">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Registros</p>
          <p className="text-lg font-black text-slate-900 mt-0.5">{stats.total}</p>
        </div>
        <div className="card p-3 bg-blue-50/50 border-blue-100">
          <p className="text-[10px] text-blue-700 font-bold uppercase">Préstamos</p>
          <p className="text-lg font-black text-blue-800 mt-0.5">{stats.prestamos}</p>
        </div>
        <div className="card p-3 bg-emerald-50/50 border-emerald-100">
          <p className="text-[10px] text-emerald-700 font-bold uppercase">Devoluciones</p>
          <p className="text-lg font-black text-emerald-800 mt-0.5">{stats.devoluciones}</p>
        </div>
        <div className="card p-3 bg-red-50/50 border-red-100">
          <p className="text-[10px] text-red-700 font-bold uppercase">Reportes Daño</p>
          <p className="text-lg font-black text-red-800 mt-0.5">{stats.danos}</p>
        </div>
        <div className="card p-3 bg-amber-50/50 border-amber-100 col-span-2 sm:col-span-1">
          <p className="text-[10px] text-amber-700 font-bold uppercase">Auditoría IA</p>
          <p className="text-lg font-black text-amber-800 mt-0.5">{stats.ia}</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="card p-3 sm:p-4 space-y-3 bg-white">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          Filtros de Trazabilidad Educativa
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Buscar Activo o Grupo
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Equipo, grupo, notas..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="input-field pl-9 text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Acción Educativa
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="select-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
            >
              <option value="all">Todas las Acciones</option>
              <option value="PRESTAMO_CLASE">Préstamo a Clase</option>
              <option value="DEVOLUCION">Devolución</option>
              <option value="REPORTE_DANO">Reporte de Daño</option>
              <option value="AUDITORIA_IA">Auditoría IA</option>
              <option value="INGRESO_NUEVO">Ingreso Nuevo</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Fecha Desde
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Fecha Hasta
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field text-xs py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
              />
            </div>
            <button
              onClick={resetFilters}
              title="Restablecer Filtros"
              className="btn btn-secondary text-xs p-2.5 mt-5 flex-shrink-0 min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 flex items-center justify-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px] whitespace-nowrap">
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
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium">Sin movimientos registrados</p>
                    <p className="text-xs mt-1">Ajusta los filtros temporales para ampliar la búsqueda.</p>
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
              {filteredData.length} registros
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
    </div>
  );
}
