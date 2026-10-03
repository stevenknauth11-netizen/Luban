// =============================================================================
// TALLER LÚBAN (INATEC) - Sistema de Gestión de Activos y Equipos de Laboratorio
// Definiciones TypeScript Estrictas (Modelo Institucional)
// =============================================================================

export type UserRole = 'admin' | 'teacher' | 'viewer';

export type LabCategory =
  | 'IoT'
  | 'Automatización'
  | 'Mecatrónica'
  | 'Diseño CAD'
  | 'Herramienta'
  | 'Instrumentación'
  | 'General';

export type EquipmentCondition =
  | 'Óptimo'
  | 'Desgaste Menor'
  | 'Requiere Mantenimiento'
  | 'Dañado/Baja';

export type TransactionAction =
  | 'INGRESO_NUEVO'
  | 'PRESTAMO_CLASE'
  | 'DEVOLUCION'
  | 'REPORTE_DANO'
  | 'AUDITORIA_IA';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface EquipmentCategoryRecord {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
}

export interface LabEquipment {
  id: number;
  name: string;
  category: LabCategory | string;
  category_id?: number | null;
  equipment_categories?: EquipmentCategoryRecord;
  total_quantity: number;
  available_quantity: number;
  condition: EquipmentCondition;
  location: string;
  description: string;
  short_description?: string;
  educational_use?: string;
  technical_specs?: Record<string, string>;
  is_active?: boolean;
  is_consumable?: boolean;
  min_stock_alert?: number;
  datasheet_url: string;
  min_threshold?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EquipmentKit {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  items?: EquipmentKitItem[];
}

export interface EquipmentKitItem {
  id: number;
  kit_id: number;
  equipment_id: number;
  quantity: number;
  lab_equipment?: LabEquipment;
}

export interface EquipmentTransaction {
  id: number;
  equipment_id: number;
  action: TransactionAction;
  quantity: number;
  assigned_to: string;
  operator: string;
  notes: string;
  timestamp: string;
  lab_equipment?: {
    name: string;
    category?: LabCategory;
    location?: string;
  };
}

export interface LabEquipmentFormData {
  name: string;
  category: LabCategory;
  total_quantity: number;
  available_quantity: number;
  condition: EquipmentCondition;
  location: string;
  description: string;
  datasheet_url: string;
}

export interface LoanFormData {
  equipment_id: number;
  action: 'PRESTAMO_CLASE' | 'DEVOLUCION';
  quantity: number;
  assigned_to: string;
  notes: string;
}

export interface DamageReportFormData {
  equipment_id: number;
  quantity: number;
  new_condition: 'Requiere Mantenimiento' | 'Dañado/Baja';
  notes: string;
}

export interface DailyActivityPoint {
  date: string;
  total: number;
  adds: number;
  removes: number;
}

export interface TopStockItem {
  name: string;
  quantity: number;
  category: string;
}

// =============================================
// COMPATIBILIDAD RETROACTIVA (LEGACY / TRANSICIÓN)
// =============================================
export type EquipmentCategory = LabCategory | 'Microcontrolador' | 'Sensor' | 'Actuador' | 'Módulo' | 'Conector' | 'Pasivo';
export type LogAction = 'ADD' | 'REMOVE' | 'ADJUST' | 'UPDATE';

export interface EquipmentStock {
  id: number;
  name: string;
  quantity: number;
  description: string;
  category: string;
  datasheet_url: string;
  location: string;
  min_threshold?: number;
  last_updated?: string;
  total_quantity?: number;
  available_quantity?: number;
  condition?: EquipmentCondition;
}

export interface InventoryLog {
  id: number;
  equipment_id: number;
  action: LogAction;
  timestamp: string;
  operator?: string;
  equipment_stock?: {
    name: string;
    category?: string;
  };
}

export interface EquipmentFormData {
  name: string;
  quantity: number;
  description: string;
  category: string;
  datasheet_url: string;
  location: string;
  min_threshold?: number;
}

export const LAB_CATEGORIES: LabCategory[] = [
  'IoT',
  'Automatización',
  'Mecatrónica',
  'Diseño CAD',
  'Herramienta',
  'Instrumentación',
  'General',
];

export const EQUIPMENT_CONDITIONS: EquipmentCondition[] = [
  'Óptimo',
  'Desgaste Menor',
  'Requiere Mantenimiento',
  'Dañado/Baja',
];

export const EQUIPMENT_CATEGORIES: string[] = [
  ...LAB_CATEGORIES,
  'Sensor',
  'Microcontrolador',
  'Actuador',
  'Módulo',
];

export const CLASS_FORMATTED_NAMES: Record<string, string> = {
  pantalla_lcd: 'Pantalla LCD Gráfica (128x64)',
  teclado_matricial: 'Teclado Matricial 4x4',
  modulo_dos_reles: 'Módulo de 2 Relés 5V',
  modulo_huella_biometrica: 'Módulo Sensor de Huella Dactilar',
  modulo_function_expansion: 'Módulo de Expansión de Funciones',
  modulo_red_ethernet: 'Módulo de Red Ethernet',
  area_vacia: 'Área Vacía / Fondo',
};

export function formatEquipmentName(rawName?: string | null): string {
  if (!rawName) return 'Activo No Identificado';
  const clean = rawName.trim();
  if (CLASS_FORMATTED_NAMES[clean]) {
    return CLASS_FORMATTED_NAMES[clean];
  }
  if (clean.includes('_') && !clean.includes(' ')) {
    return clean
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return clean;
}
