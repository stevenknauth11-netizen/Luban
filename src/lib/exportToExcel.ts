// =============================================================================
// SERVICIO DE EXPORTACIÓN INATEC — REPORTES INSTITUCIONALES DE LABORATORIO
// Taller Lúban (Nicaragua - China)
// =============================================================================
import * as XLSX from 'xlsx';
import type { LabEquipment, EquipmentTransaction } from '@/lib/types';

export function exportInatecLabReport(
  equipment: LabEquipment[],
  transactions: EquipmentTransaction[] = []
): void {
  const wb = XLSX.utils.book_new();

  // 1. Hoja 1: "Inventario Activo" (Equipos operativos)
  const activeItems = equipment.filter(
    (item) => item.condition === 'Óptimo' || item.condition === 'Desgaste Menor'
  );

  const activeRows = activeItems.map((item) => ({
    'ID Activo': `LBN-${String(item.id).padStart(4, '0')}`,
    'Equipo Técnico': item.name,
    'Especialidad / Categoría': item.category,
    'Total Físico': item.total_quantity,
    'Disponibles': item.available_quantity,
    'En Préstamo': item.total_quantity - item.available_quantity,
    'Condición Física': item.condition,
    'Ubicación en Taller': item.location || 'Laboratorio General',
    'Ficha Técnica': item.datasheet_url || 'N/A',
  }));

  const wsActive = XLSX.utils.json_to_sheet(activeRows);
  wsActive['!cols'] = [
    { wch: 12 },
    { wch: 32 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 22 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsActive, 'Inventario Activo');

  // 2. Hoja 2: "Equipos en Mantenimiento o Baja"
  const damagedItems = equipment.filter(
    (item) => item.condition === 'Requiere Mantenimiento' || item.condition === 'Dañado/Baja'
  );

  const damagedRows = damagedItems.map((item) => ({
    'ID Activo': `LBN-${String(item.id).padStart(4, '0')}`,
    'Equipo Técnico': item.name,
    'Categoría': item.category,
    'Unidades Totales': item.total_quantity,
    'Disponibles': item.available_quantity,
    'Estado Técnico': item.condition,
    'Ubicación / Mesa': item.location || 'Área de Reparación',
    'Diagnóstico / Descripción': item.description || 'Reportado en práctica',
  }));

  const wsDamaged = XLSX.utils.json_to_sheet(damagedRows);
  wsDamaged['!cols'] = [
    { wch: 12 },
    { wch: 32 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 24 },
    { wch: 24 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDamaged, 'Mantenimiento y Bajas');

  // 3. Hoja 3: "Registro de Uso Mensual" (Trazabilidad educativa)
  const txRows = transactions.map((tx) => ({
    'ID Operación': `#${String(tx.id).padStart(5, '0')}`,
    'Fecha / Hora': new Date(tx.timestamp).toLocaleString('es-NI'),
    'Acción Educativa': tx.action,
    'Equipo Involucrado': tx.lab_equipment?.name || `Activo #${tx.equipment_id}`,
    'Cantidad': tx.quantity,
    'Asignado a / Grupo': tx.assigned_to || 'General',
    'Docente / Operador': tx.operator || 'Docente',
    'Observaciones / Falla': tx.notes || '—',
  }));

  const wsTx = XLSX.utils.json_to_sheet(txRows);
  wsTx['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 20 },
    { wch: 30 },
    { wch: 10 },
    { wch: 26 },
    { wch: 22 },
    { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, 'Registro de Uso Mensual');

  // Descarga con nomenclatura oficial INATEC
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Reporte_Activos_Taller_Luban_INATEC_${dateStr}.xlsx`);
}

// Alias de retrocompatibilidad
export const exportInventoryToExcel = exportInatecLabReport;
