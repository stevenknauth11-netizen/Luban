'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/lib/types';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Shield,
  Search,
  Loader2,
  ArrowUpDown,
  Key,
  Users,
  Plus,
  Trash2,
  Copy,
  Check,
  Cpu,
  Radio,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

const ROLE_LABELS: Record<UserRole, { label: string; badge: string }> = {
  admin: { label: 'Admin', badge: 'badge-danger' },
  teacher: { label: 'Docente', badge: 'badge-warning' },
  viewer: { label: 'Visor', badge: 'badge-info' },
};

interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  deviceType: 'STM32 NEWLab' | 'ESP8266 / ESP32' | 'Estación IA' | 'Gateway';
  created_at: string;
  status: 'Activo' | 'Revocado';
}

export default function AdminPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'users' | 'api-keys'>('users');

  // RBAC Users State
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // IoT API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([
    {
      id: 'key-1',
      name: 'Estación Edge AI Mesa 1',
      key: 'luban_iot_live_a89f928e1c2b4d5e',
      deviceType: 'Estación IA',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      status: 'Activo',
    },
    {
      id: 'key-2',
      name: 'Kit STM32 NEWLab Gateway',
      key: 'luban_iot_live_f710c83a99e21b50',
      deviceType: 'STM32 NEWLab',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      status: 'Activo',
    },
    {
      id: 'key-3',
      name: 'ESP8266 Monitor de Ambiente',
      key: 'luban_iot_live_0b3e6481cf78912d',
      deviceType: 'ESP8266 / ESP32',
      created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
      status: 'Activo',
    },
  ]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newKeyModal, setNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDevice, setNewKeyDevice] = useState<ApiKeyItem['deviceType']>('STM32 NEWLab');

  useEffect(() => {
    async function fetchProfiles() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });
      if (data) setProfiles(data as Profile[]);
      setLoading(false);
    }
    fetchProfiles();
  }, [supabase]);

  async function updateRole(userId: string, newRole: UserRole) {
    setUpdatingId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
      );
      toast.success('Rol de usuario actualizado');
    } else {
      toast.error('Error al actualizar rol', { description: error.message });
    }
    setUpdatingId(null);
  }

  function handleCreateApiKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const randomHex = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const generatedKey = `luban_iot_live_${randomHex}`;

    const newEntry: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      key: generatedKey,
      deviceType: newKeyDevice,
      created_at: new Date().toISOString(),
      status: 'Activo',
    };

    setApiKeys((prev) => [newEntry, ...prev]);
    setNewKeyModal(false);
    setNewKeyName('');
    toast.success('Nueva API Key IoT Generada', {
      description: `Dispositivo: ${newKeyDevice}. Recuerda copiar el token.`,
    });
  }

  function handleRevokeKey(id: string) {
    setApiKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: 'Revocado' } : k))
    );
    toast.warning('Token IoT revocado permanentemente');
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    toast.info('API Key copiada al portapapeles');
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const columns = useMemo<ColumnDef<Profile>[]>(
    () => [
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-slate-900"
            onClick={() => column.toggleSorting()}
          >
            Email Institucional <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        size: 240,
        cell: ({ getValue }) => (
          <span className="font-medium text-slate-900">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'full_name',
        header: 'Nombre Docente / Alumno',
        size: 200,
        cell: ({ getValue }) => (
          <span className="text-slate-700 font-semibold">{(getValue() as string) || '—'}</span>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Rol RBAC',
        size: 130,
        cell: ({ getValue }) => {
          const role = getValue() as UserRole;
          const config = ROLE_LABELS[role] || { label: role, badge: 'badge-info' };
          return <span className={`badge ${config.badge}`}>{config.label}</span>;
        },
      },
      {
        id: 'change_role',
        header: 'Modificar Permisos',
        size: 200,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <select
              value={row.original.role}
              onChange={(e) =>
                updateRole(row.original.id, e.target.value as UserRole)
              }
              className="select-field w-auto text-xs py-1"
              disabled={updatingId === row.original.id}
            >
              <option value="admin">Administrador</option>
              <option value="teacher">Docente</option>
              <option value="viewer">Visor (Estudiante)</option>
            </select>
            {updatingId === row.original.id && (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            )}
          </div>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Fecha Registro',
        size: 160,
        cell: ({ getValue }) => (
          <time className="text-xs text-slate-500 font-mono">
            {new Date(getValue() as string).toLocaleDateString('es-NI', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </time>
        ),
      },
    ],
    [updatingId]
  );

  const table = useReactTable({
    data: profiles,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

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
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Panel de Administración</h1>
            <p className="text-xs text-slate-500">
              Control de acceso RBAC institucional y credenciales de dispositivos IoT
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'users'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Usuarios y Roles</span>
          </button>
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'api-keys'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys IoT</span>
          </button>
        </div>
      </div>

      {/* TAB 1: USUARIOS Y ROLES (RBAC) */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="card p-4 bg-white">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por email o nombre..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="input-field pl-10 text-xs"
              />
            </div>
          </div>

          <div className="card overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider"
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
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5 bg-white">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Matriz de Permisos (RBAC)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-red-50/40 rounded-lg border border-red-100">
                <span className="badge badge-danger">Admin</span>
                <p className="text-slate-600 mt-2">
                  Gestión completa de usuarios, generación de API Keys IoT y baja de activos.
                </p>
              </div>
              <div className="p-3 bg-amber-50/40 rounded-lg border border-amber-100">
                <span className="badge badge-warning">Docente</span>
                <p className="text-slate-600 mt-2">
                  Registro de préstamos, reportes de avería y mantenimiento de inventario.
                </p>
              </div>
              <div className="p-3 bg-blue-50/40 rounded-lg border border-blue-100">
                <span className="badge badge-info">Visor (Estudiante)</span>
                <p className="text-slate-600 mt-2">
                  Acceso de solo lectura al catálogo técnico de equipos y fichas técnicas.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GESTIÓN DE API KEYS (IOT) */}
      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between card p-5 bg-white">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Tokens de Comunicación IoT (x-api-key)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Utilizados por microcontroladores STM32, ESP8266 y cámaras Edge AI para enviar conteos de stock
              </p>
            </div>
            <button
              onClick={() => setNewKeyModal(true)}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Generar Nuevo Token</span>
            </button>
          </div>

          <div className="card bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-left">
                    <th className="px-4 py-3">Dispositivo / Estación</th>
                    <th className="px-4 py-3">Tipo de Hardware</th>
                    <th className="px-4 py-3">Token (x-api-key)</th>
                    <th className="px-4 py-3">Fecha Generación</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apiKeys.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                      <td className="px-4 py-3">
                        <span className="badge badge-info text-[10px]">{item.deviceType}</span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-100 px-2 py-1 rounded text-slate-700">
                            {item.status === 'Revocado' ? '••••••••••••••••••••' : item.key}
                          </span>
                          {item.status === 'Activo' && (
                            <button
                              onClick={() => copyToClipboard(item.key)}
                              className="text-slate-400 hover:text-slate-600 p-1"
                              title="Copiar Token"
                            >
                              {copiedKey === item.key ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono">
                        {new Date(item.created_at).toLocaleDateString('es-NI', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`badge ${
                            item.status === 'Activo' ? 'badge-success' : 'badge-danger'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.status === 'Activo' ? (
                          <button
                            onClick={() => handleRevokeKey(item.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
                          >
                            Revocar
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Inactivo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear API Key */}
      {newKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scaleUp">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Generar Token de Hardware IoT</h3>
              <button
                onClick={() => setNewKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateApiKey} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de la Estación o Dispositivo *
                </label>
                <input
                  type="text"
                  placeholder="Ej: STM32 NEWLab Mesa Robótica 2"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="input-field text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Dispositivo
                </label>
                <select
                  value={newKeyDevice}
                  onChange={(e) => setNewKeyDevice(e.target.value as any)}
                  className="select-field text-xs"
                >
                  <option value="STM32 NEWLab">STM32 NEWLab (Módulo Principal)</option>
                  <option value="ESP8266 / ESP32">ESP8266 / ESP32 (Sensor Node)</option>
                  <option value="Estación IA">Estación IA (Visión Artificial / Edge)</option>
                  <option value="Gateway">Gateway General de Red</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                <p className="font-semibold">Instrucciones de Cabecera:</p>
                <p className="font-mono text-[11px] mt-1 bg-white/70 p-1.5 rounded">
                  x-api-key: luban_iot_live_...
                </p>
                <p className="mt-1 text-[11px]">
                  El microcontrolador debe incluir esta clave en todas las solicitudes POST a la API.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewKeyModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Generar y Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
