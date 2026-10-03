-- =============================================================================
-- REFACTORIZACIÓN DDL INSTITUCIONAL: SISTEMA DE GESTIÓN DE ACTIVOS DE LABORATORIO
-- Taller Lúban (Cooperación Nicaragua-China / INATEC)
-- Plataforma: Supabase PostgreSQL Cloud
-- =============================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. TIPOS ENUMERADOS DEL LABORATORIO
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_condition_enum') THEN
    CREATE TYPE public.equipment_condition_enum AS ENUM (
      'Óptimo',
      'Desgaste Menor',
      'Requiere Mantenimiento',
      'Dañado/Baja'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_action_enum') THEN
    CREATE TYPE public.transaction_action_enum AS ENUM (
      'INGRESO_NUEVO',
      'PRESTAMO_CLASE',
      'DEVOLUCION',
      'REPORTE_DANO',
      'AUDITORIA_IA'
    );
  END IF;
END $$;

-- =============================================
-- 2. TABLA PRINCIPAL: lab_equipment (Activos de Laboratorio)
-- =============================================
CREATE TABLE IF NOT EXISTS public.lab_equipment (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('IoT', 'Automatización', 'Mecatrónica', 'Diseño CAD', 'Herramienta', 'Instrumentación', 'General')
  ),
  total_quantity INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0 AND available_quantity <= total_quantity),
  condition public.equipment_condition_enum NOT NULL DEFAULT 'Óptimo',
  location TEXT NOT NULL DEFAULT 'Mesa General',
  description TEXT DEFAULT '',
  datasheet_url TEXT DEFAULT '',
  min_threshold INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_equipment_category ON public.lab_equipment(category);
CREATE INDEX IF NOT EXISTS idx_lab_equipment_condition ON public.lab_equipment(condition);
CREATE INDEX IF NOT EXISTS idx_lab_equipment_location ON public.lab_equipment(location);

-- =============================================
-- 3. MIGRACIÓN / COPIA DE DATOS LEGACY (Si existía equipment_stock)
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipment_stock') THEN
    INSERT INTO public.lab_equipment (id, name, category, total_quantity, available_quantity, location, description, datasheet_url, updated_at)
    SELECT 
      id, 
      name, 
      CASE 
        WHEN category IN ('Sensor', 'Módulo', 'Microcontrolador') THEN 'IoT'
        WHEN category IN ('Actuador') THEN 'Mecatrónica'
        WHEN category IN ('Herramienta') THEN 'Herramienta'
        ELSE 'General'
      END,
      quantity, 
      quantity, 
      COALESCE(NULLIF(location, ''), 'Almacén Central'),
      COALESCE(description, ''),
      COALESCE(datasheet_url, ''),
      COALESCE(last_updated, NOW())
    FROM public.equipment_stock
    ON CONFLICT (id) DO UPDATE SET
      total_quantity = EXCLUDED.total_quantity,
      available_quantity = EXCLUDED.available_quantity;

    -- Ajustar la secuencia de ID al valor máximo
    PERFORM setval('public.lab_equipment_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.lab_equipment));
  END IF;
END $$;

-- =============================================
-- 4. TABLA: equipment_transactions (Trazabilidad Educativa y Operaciones)
-- =============================================
CREATE TABLE IF NOT EXISTS public.equipment_transactions (
  id BIGSERIAL PRIMARY KEY,
  equipment_id BIGINT NOT NULL REFERENCES public.lab_equipment(id) ON DELETE CASCADE,
  action public.transaction_action_enum NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  assigned_to TEXT DEFAULT '',       -- Ej. 'Grupo 3 - Práctica Sensores IoT', 'Prof. Roberto'
  operator TEXT DEFAULT 'Docente',   -- Usuario o 'IA Server (NEWLab)'
  notes TEXT DEFAULT '',              -- Ej. 'Pin GND con falso contacto', 'Mesa 2 - Detección automática'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_transactions_eq_id ON public.equipment_transactions(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_transactions_action ON public.equipment_transactions(action);
CREATE INDEX IF NOT EXISTS idx_equipment_transactions_timestamp ON public.equipment_transactions(timestamp DESC);

-- =============================================
-- 5. TRIGGER: ACTUALIZACIÓN AUTOMÁTICA DE updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lab_equipment_updated_at ON public.lab_equipment;
CREATE TRIGGER trg_lab_equipment_updated_at
  BEFORE UPDATE ON public.lab_equipment
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- 6. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE public.lab_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_transactions ENABLE ROW LEVEL SECURITY;

-- lab_equipment: Todos leen; Docentes y Admins modifican; Solo Admins borran
DROP POLICY IF EXISTS "lab_equipment_select" ON public.lab_equipment;
CREATE POLICY "lab_equipment_select" ON public.lab_equipment FOR SELECT USING (true);

DROP POLICY IF EXISTS "lab_equipment_insert" ON public.lab_equipment;
CREATE POLICY "lab_equipment_insert" ON public.lab_equipment FOR INSERT
WITH CHECK (public.get_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "lab_equipment_update" ON public.lab_equipment;
CREATE POLICY "lab_equipment_update" ON public.lab_equipment FOR UPDATE
USING (public.get_user_role() IN ('admin', 'teacher'))
WITH CHECK (public.get_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "lab_equipment_delete" ON public.lab_equipment;
CREATE POLICY "lab_equipment_delete" ON public.lab_equipment FOR DELETE
USING (public.get_user_role() = 'admin');

-- equipment_transactions: Todos leen; Docentes y Admins registran transacciones
DROP POLICY IF EXISTS "equipment_transactions_select" ON public.equipment_transactions;
CREATE POLICY "equipment_transactions_select" ON public.equipment_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "equipment_transactions_insert" ON public.equipment_transactions;
CREATE POLICY "equipment_transactions_insert" ON public.equipment_transactions FOR INSERT
WITH CHECK (public.get_user_role() IN ('admin', 'teacher'));

-- =============================================
-- 7. REPLICACIÓN EN TIEMPO REAL (Supabase Realtime)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'lab_equipment'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_equipment;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'equipment_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_transactions;
  END IF;
END $$;
