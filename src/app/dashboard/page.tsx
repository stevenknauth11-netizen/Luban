import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  Layers,
  GraduationCap,
  Wrench,
  PackageCheck,
  ShieldAlert,
  Cpu,
} from 'lucide-react';
import type { LabEquipment, EquipmentTransaction, Profile, UserRole } from '@/lib/types';
import { formatEquipmentName } from '@/lib/types';
import { ActivityFeed } from '@/components/features/ActivityFeed';
import { DashboardQuickActions } from '@/components/features/DashboardQuickActions';
import { ConditionDamageChart, type CategoryWearStats } from '@/components/charts/ConditionDamageChart';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';

async function getDashboardData() {
  const supabase = await createServerSupabaseClient();

  // 1. Obtener usuario actual y perfil
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userProfile: Profile | null = null;
  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (prof) userProfile = prof as Profile;
  }

  // 2. Consultar Activos del Laboratorio (con fallback a equipment_stock)
  let { data: equipmentData, error: eqErr } = await supabase
    .from('lab_equipment')
    .select('*')
    .order('name', { ascending: true });

  if (eqErr || !equipmentData) {
    const { data: legacyStock } = await supabase
      .from('equipment_stock')
      .select('*')
      .order('name', { ascending: true });

    equipmentData = (legacyStock || []).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category === 'Sensor' || item.category === 'Microcontrolador' ? 'IoT' : 'General',
      total_quantity: item.quantity,
      available_quantity: item.quantity,
      condition: 'Óptimo',
      location: item.location || 'Laboratorio Central',
      description: item.description || '',
      datasheet_url: item.datasheet_url || '',
      min_threshold: 3,
    }));
  }

  // 3. Consultar Transacciones para el Feed (últimos 15 movimientos)
  let { data: txData, error: txErr } = await supabase
    .from('equipment_transactions')
    .select('*, lab_equipment(name, category, location)')
    .order('timestamp', { ascending: false })
    .limit(15);

  if (txErr || !txData) {
    const { data: legacyLogs } = await supabase
      .from('inventory_logs')
      .select('*, equipment_stock(name, category)')
      .order('timestamp', { ascending: false })
      .limit(15);

    txData = (legacyLogs || []).map((log) => ({
      id: log.id,
      equipment_id: log.equipment_id,
      action: (log.action === 'ADD' ? 'INGRESO_NUEVO' : 'AUDITORIA_IA') as any,
      quantity: 1,
      assigned_to: 'Taller Lúban',
      operator: 'IA Server',
      notes: 'Registro detectado automáticamente',
      timestamp: log.timestamp,
      lab_equipment: {
        name: (log.equipment_stock as any)?.name || `Activo #${log.equipment_id}`,
        category: (log.equipment_stock as any)?.category || 'IoT',
        location: 'Laboratorio',
      },
    }));
  }

  const items = (equipmentData as LabEquipment[]) ?? [];
  const transactions = (txData as EquipmentTransaction[]) ?? [];

  // 4. Cálculo de KPIs
  const totalActivos = items.reduce((sum, item) => sum + (item.total_quantity || 0), 0);
  const totalDisponibles = items.reduce((sum, item) => sum + (item.available_quantity || 0), 0);
  const equiposEnPrestamo = Math.max(0, totalActivos - totalDisponibles);

  // Equipos con condición 'Requiere Mantenimiento' o 'Dañado/Baja'
  const mantenimientoList = items.filter(
    (item) => item.condition === 'Requiere Mantenimiento' || item.condition === 'Dañado/Baja'
  );
  const totalEnMantenimiento = mantenimientoList.length;

  // 5. Estadísticas de Desgaste por Categoría
  const categoryStatsMap: Record<string, CategoryWearStats> = {};
  items.forEach((item) => {
    const cat = item.category || 'General';
    if (!categoryStatsMap[cat]) {
      categoryStatsMap[cat] = { category: cat, enUso: 0, danados: 0, disponibles: 0 };
    }
    categoryStatsMap[cat].disponibles += item.available_quantity;
    categoryStatsMap[cat].enUso += Math.max(0, item.total_quantity - item.available_quantity);
    if (item.condition === 'Requiere Mantenimiento' || item.condition === 'Dañado/Baja') {
      categoryStatsMap[cat].danados += 1;
    }
  });

  return {
    items,
    transactions,
    userProfile,
    kpis: {
      totalActivos,
      totalDisponibles,
      equiposEnPrestamo,
      totalEnMantenimiento,
      tiposEquipos: items.length,
    },
    categoryStats: Object.values(categoryStatsMap),
    mantenimientoList,
  };
}

export default async function DashboardPage() {
  const { items, transactions, userProfile, kpis, categoryStats, mantenimientoList } =
    await getDashboardData();

  const userRole: UserRole = userProfile?.role || 'viewer';
  const operatorName = userProfile?.full_name || userProfile?.email || 'Docente';

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Header con Branding Institucional y Accesos Rápidos (Quick Actions) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-xs font-mono font-bold">
              INATEC · Taller Lúban
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Centro de Innovación Tecnológica Nicaragua-China
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Panel de Control del Laboratorio
          </h1>
          <p className="text-xs text-slate-500">
            Supervisión integral de activos técnicos, préstamos a clases y auditoría de eventos
          </p>
        </div>

        {/* Quick Actions (Solo teacher y admin) */}
        <DashboardQuickActions
          equipmentList={items}
          userRole={userRole}
          operatorName={operatorName}
        />
      </div>

      {/* 2. KPIs Superiores Mandatorios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total de Activos */}
        <div className="card p-5 bg-white border-l-4 border-l-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total de Activos
              </p>
              <p className="text-3xl font-black text-slate-900 mt-1">
                {kpis.totalActivos.toLocaleString('es-NI')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {kpis.tiposEquipos} tipos en catálogo
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI 2: Disponibles para Clase */}
        <div className="card p-5 bg-white border-l-4 border-l-emerald-600 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Disponibles para Clase
              </p>
              <p className="text-3xl font-black text-emerald-800 mt-1">
                {kpis.totalDisponibles.toLocaleString('es-NI')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Listos para prácticas
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI 3: Equipos en Préstamo */}
        <div className="card p-5 bg-white border-l-4 border-l-blue-600 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                Equipos en Préstamo
              </p>
              <p className="text-3xl font-black text-blue-900 mt-1">
                {kpis.equiposEnPrestamo.toLocaleString('es-NI')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                En mesas de prácticas activas
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI 4: Equipos en Mantenimiento */}
        <div className="card p-5 bg-white border-l-4 border-l-red-600 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
                En Mantenimiento
              </p>
              <p className="text-3xl font-black text-red-800 mt-1">
                {kpis.totalEnMantenimiento}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Requieren revisión técnica
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-red-50 text-red-700 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sección Principal: Registro Global de Eventos + Analítica de Laboratorio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Registro Global de Eventos (Supabase Realtime - 15 últimos movimientos) */}
        <div className="lg:col-span-7 h-full">
          <ActivityFeed initialEvents={transactions} limit={15} />
        </div>

        {/* Columna Derecha: Métricas de Distribución y Alertas de Taller */}
        <div className="lg:col-span-5 space-y-6">
          {/* Gráfico de Condición y Disponibilidad */}
          <div className="card p-5 bg-white shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Estado y Desgaste por Especialidad
                </h3>
                <p className="text-xs text-slate-400">
                  Disponibles vs. En Uso y En Mantenimiento
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                INATEC LAB
              </span>
            </div>
            <ConditionDamageChart data={categoryStats} />
          </div>

          {/* Cola Rápida de Mantenimiento */}
          <div className="card bg-white shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-red-50/40">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Atención de Mantenimiento ({mantenimientoList.length})
                </h3>
              </div>
              <Link
                href="/dashboard/maintenance"
                className="text-xs font-semibold text-red-700 hover:text-red-900 hover:underline"
              >
                Ir al Taller →
              </Link>
            </div>

            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {mantenimientoList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  <p className="font-semibold text-emerald-700">✓ Todos los equipos están en óptimas condiciones</p>
                  <p className="mt-0.5 text-slate-400">No hay averías pendientes de reparación.</p>
                </div>
              ) : (
                mantenimientoList.map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{formatEquipmentName(item.name)}</p>
                      <p className="text-[11px] text-slate-500">
                        {item.location} · {item.category}
                      </p>
                    </div>
                    <StatusBadge status={item.condition} size="sm" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
