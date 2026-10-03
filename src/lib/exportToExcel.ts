// =============================================================================
// SERVICIO DE EXPORTACIÓN INATEC — REPORTES INSTITUCIONALES DE LABORATORIO
// Taller Lúban (Nicaragua - China) · Centro Tecnológico Nacional
// =============================================================================
import * as XLSX from 'xlsx';
import type { LabEquipment, EquipmentTransaction } from '@/lib/types';
import { formatEquipmentName } from '@/lib/types';

export interface ExportFilterOptions {
  category?: string;
  searchQuery?: string;
  statusTab?: string;
  reportTitle?: string;
}

/**
 * Genera y descarga un reporte institucional Excel (.xlsx) estructurado
 * con soporte para filtrado dinámico por especialidad, búsqueda y estado.
 */
export function exportInatecLabReport(
  equipment: LabEquipment[],
  transactions: EquipmentTransaction[] = [],
  options?: ExportFilterOptions
): void {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filterCat = options?.category && options.category !== 'all' ? options.category : null;
  const isFiltered = Boolean(filterCat || options?.searchQuery || options?.statusTab);

  // ---------------------------------------------------------------------------
  // HOJA 1: Inventario Principal (Filtrado o General)
  // ---------------------------------------------------------------------------
  const sheetTitle = filterCat ? `Inv - ${filterCat}`.slice(0, 31) : 'Inventario de Equipos';

  const inventoryRows = equipment.map((item) => {
    const formattedName = formatEquipmentName(item.name);
    const categoryName =
      (item as any).equipment_categories?.name ||
      (typeof item.category === 'string' ? item.category : 'General');
    const inLoan = Math.max(0, (item.total_quantity || 0) - (item.available_quantity || 0));

    return {
      'Código Patrimonial': `LBN-${String(item.id).padStart(4, '0')}`,
      'Equipo / Módulo Técnico': formattedName,
      'Clase IA / Código': item.name,
      'Especialidad': categoryName,
      'Stock Total': item.total_quantity,
      'Disponibles': item.available_quantity,
      'En Préstamo': inLoan,
      'Condición Física': item.condition || 'Óptimo',
      'Ubicación en Taller': item.location || 'Laboratorio General',
      'Uso Didáctico / Aplicación': item.educational_use || item.short_description || item.description || 'Prácticas de laboratorio',
      'Fungible': item.is_consumable ? 'Sí' : 'No',
      'Ficha Técnica': item.datasheet_url || 'N/A',
    };
  });

  const wsInventory = XLSX.utils.json_to_sheet(inventoryRows);
  wsInventory['!cols'] = [
    { wch: 18 }, // Código Patrimonial
    { wch: 36 }, // Equipo / Módulo Técnico
    { wch: 28 }, // Clase IA / Código
    { wch: 22 }, // Especialidad
    { wch: 12 }, // Stock Total
    { wch: 14 }, // Disponibles
    { wch: 14 }, // En Préstamo
    { wch: 22 }, // Condición Física
    { wch: 25 }, // Ubicación en Taller
    { wch: 45 }, // Uso Didáctico / Aplicación
    { wch: 10 }, // Fungible
    { wch: 35 }, // Ficha Técnica
  ];
  XLSX.utils.book_append_sheet(wb, wsInventory, sheetTitle);

  // ---------------------------------------------------------------------------
  // HOJA 2: Resumen Consolidado por Especialidad / Categoría
  // ---------------------------------------------------------------------------
  const categoryStats: Record<
    string,
    { models: number; total: number; available: number; inLoan: number }
  > = {};

  equipment.forEach((item) => {
    const cat =
      (item as any).equipment_categories?.name ||
      (typeof item.category === 'string' ? item.category : 'General');
    if (!categoryStats[cat]) {
      categoryStats[cat] = { models: 0, total: 0, available: 0, inLoan: 0 };
    }
    categoryStats[cat].models += 1;
    categoryStats[cat].total += item.total_quantity || 0;
    categoryStats[cat].available += item.available_quantity || 0;
    categoryStats[cat].inLoan += Math.max(0, (item.total_quantity || 0) - (item.available_quantity || 0));
  });

  const summaryRows = Object.entries(categoryStats).map(([cat, stats]) => ({
    'Especialidad Técnica': cat,
    'Modelos / Líneas': stats.models,
    'Unidades Totales': stats.total,
    'Unidades Disponibles': stats.available,
    'Unidades en Préstamo': stats.inLoan,
    'Tasa de Disponibilidad': stats.total > 0 ? `${Math.round((stats.available / stats.total) * 100)}%` : '0%',
  }));

  if (summaryRows.length > 0) {
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [
      { wch: 26 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen por Especialidad');
  }

  // ---------------------------------------------------------------------------
  // HOJA 3: Equipos que Requieren Mantenimiento o Bajas
  // ---------------------------------------------------------------------------
  const attentionItems = equipment.filter(
    (item) => item.condition === 'Requiere Mantenimiento' || item.condition === 'Dañado/Baja'
  );

  if (attentionItems.length > 0) {
    const attentionRows = attentionItems.map((item) => ({
      'Código Patrimonial': `LBN-${String(item.id).padStart(4, '0')}`,
      'Equipo / Módulo Técnico': formatEquipmentName(item.name),
      'Especialidad':
        (item as any).equipment_categories?.name ||
        (typeof item.category === 'string' ? item.category : 'General'),
      'Stock Total': item.total_quantity,
      'Disponibles': item.available_quantity,
      'Condición': item.condition,
      'Ubicación': item.location || 'Área de Reparación',
      'Diagnóstico / Observación': item.description || 'Reportado en práctica',
    }));

    const wsAttention = XLSX.utils.json_to_sheet(attentionRows);
    wsAttention['!cols'] = [
      { wch: 18 },
      { wch: 34 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 24 },
      { wch: 25 },
      { wch: 45 },
    ];
    XLSX.utils.book_append_sheet(wb, wsAttention, 'Mantenimiento y Bajas');
  }

  // ---------------------------------------------------------------------------
  // HOJA 4: Trazabilidad y Préstamos (si se proporcionaron transacciones)
  // ---------------------------------------------------------------------------
  if (transactions && transactions.length > 0) {
    const txRows = transactions.map((tx) => ({
      'ID Operación': `#${String(tx.id).padStart(5, '0')}`,
      'Fecha / Hora': new Date(tx.timestamp).toLocaleString('es-NI'),
      'Acción Educativa': tx.action,
      'Equipo Involucrado': formatEquipmentName(tx.lab_equipment?.name) || `Activo #${tx.equipment_id}`,
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
      { wch: 34 },
      { wch: 10 },
      { wch: 26 },
      { wch: 22 },
      { wch: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTx, 'Trazabilidad de Uso');
  }

  // ---------------------------------------------------------------------------
  // Nomenclatura del Archivo Descargado
  // ---------------------------------------------------------------------------
  let fileCategorySuffix = '';
  if (filterCat) {
    fileCategorySuffix = `_${filterCat.replace(/[^\w\d]/g, '_')}`;
  } else if (options?.statusTab === 'archived') {
    fileCategorySuffix = '_Archivados';
  }

  const fileName = `Reporte_Inventario_Taller_Luban_INATEC${fileCategorySuffix}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// Alias de retrocompatibilidad
export const exportInventoryToExcel = exportInatecLabReport;
