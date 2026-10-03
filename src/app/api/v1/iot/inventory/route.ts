import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// =============================================================================
// INTERFAZ DE RESPUESTA MINIFICADA PARA MICROCONTROLADORES
// Optimizada para STM32F103 (20KB SRAM) con parsing ligero via strstr() / cJSON
// =============================================================================
export interface IoTInventoryResponseItem {
  id: string; // Identificador conciso (slug alfanumérico)
  qty: number; // Cantidad disponible física inmediata (available_quantity)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9]+/g, '-')     // Reemplazar espacios y símbolos por guiones
    .replace(/^-+|-+$/g, '');        // Limpiar guiones iniciales/finales
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verificación de Seguridad por Hardware API Key
    const apiKey = request.headers.get('x-api-key');
    const secretKey = process.env.IOT_HARDWARE_SECRET || 'luban_iot_sec_2026_dev';

    if (!apiKey || apiKey !== secretKey) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing x-api-key' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 2. Inicialización de cliente Supabase de servidor
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new NextResponse(
        JSON.stringify({ error: 'Server Configuration Error: Missing Supabase credentials' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 3. Procesamiento de Parámetros de Consulta (Filtros opcionales)
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category'); // Ej: "IoT", "Automatización"
    const status = searchParams.get('status');     // Ej: "available"

    // 4. Consulta a la tabla lab_equipment
    let query = supabase
      .from('lab_equipment')
      .select('id, name, available_quantity, condition, category');

    if (category) {
      query = query.ilike('category', category);
    }

    if (status === 'available') {
      // Filtrar activos disponibles (> 0) y que no estén dados de baja
      query = query
        .gt('available_quantity', 0)
        .neq('condition', 'Dañado/Baja');
    }

    const { data, error } = await query.order('id', { ascending: true });

    if (error) {
      return new NextResponse(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Mapeo y Minificación Extrema del Payload
    // Transforma `available_quantity` a `qty` y `name` a un `id` slug conciso
    const minifiedPayload: IoTInventoryResponseItem[] = (data || []).map((item) => ({
      id: slugify(item.name),
      qty: item.available_quantity,
    }));

    // 6. Respuesta HTTP con Headers de Cero Caché (Tiempo Real Garantizado)
    return new NextResponse(JSON.stringify(minifiedPayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err: any) {
    return new NextResponse(
      JSON.stringify({ error: 'Internal IoT Gateway Error', message: err?.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
