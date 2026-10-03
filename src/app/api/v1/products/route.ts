// =============================================================================
// REST API — GET /api/v1/products (o activos de laboratorio)
// Endpoint JSON institucional para integraciones satélite y nodos perimetrales
// =============================================================================
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category');
  const condition = searchParams.get('condition');
  const search = searchParams.get('search');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  // Intentar consultar lab_equipment primero
  let query = supabase
    .from('lab_equipment')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }
  if (condition) {
    query = query.eq('condition', condition);
  }
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  let { data, error, count } = await query;

  // Fallback si no existe aún la tabla lab_equipment
  if (error) {
    let legacyQuery = supabase
      .from('equipment_stock')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) {
      legacyQuery = legacyQuery.ilike('name', `%${search}%`);
    }

    const legacyRes = await legacyQuery;
    if (legacyRes.error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    data = (legacyRes.data || []).map((item) => ({
      id: item.id,
      name: item.name,
      category: 'IoT',
      total_quantity: item.quantity,
      available_quantity: item.quantity,
      condition: 'Óptimo',
      location: item.location || 'Laboratorio General',
      description: item.description || '',
      datasheet_url: item.datasheet_url || '',
    }));
    count = legacyRes.count;
  }

  return NextResponse.json({
    institution: 'INATEC - Taller Lúban (Nicaragua-China)',
    data,
    meta: {
      total: count,
      limit,
      offset,
      returned: data?.length ?? 0,
    },
  });
}
