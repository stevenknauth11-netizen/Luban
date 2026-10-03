import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { LabEquipment, EquipmentCategoryRecord } from '@/lib/types';
import { CatalogClient } from '@/components/features/catalog/CatalogClient';

export const metadata = {
  title: 'Catálogo Visual de Equipos | Taller Luban - INATEC',
  description: 'Vitrina interactiva y educativa de componentes, microcontroladores y sensores para el laboratorio.',
};

export default async function CatalogPage() {
  const supabase = await createServerSupabaseClient();

  // 1. Consultar Activos Activos de Laboratorio (excluye soft-deletes is_active === false)
  const { data: equipmentData, error: eqErr } = await supabase
    .from('lab_equipment')
    .select('*, equipment_categories(id, name, description)')
    .neq('is_active', false)
    .order('name', { ascending: true });

  // 2. Consultar Categorías Activas Dinámicas
  const { data: categoriesData, error: catErr } = await supabase
    .from('equipment_categories')
    .select('*')
    .eq('is_active', true)
    .order('id', { ascending: true });

  const items = (equipmentData as LabEquipment[]) ?? [];
  const categories = (categoriesData as EquipmentCategoryRecord[]) ?? [];

  return (
    <CatalogClient
      initialEquipment={items}
      categories={categories}
    />
  );
}
