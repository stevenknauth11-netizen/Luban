-- =============================================================================
-- MIGRACIÓN V2: ERP & DASHBOARD WEB - TALLER LUBAN
-- Sistema de Inventariado Inteligente de Equipos Electrónicos e IoT (NEWLab)
-- Supabase PostgreSQL Cloud
-- =============================================================================

-- =============================================
-- 1. EXTENSIONES REQUERIDAS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 2. AMPLIACIÓN DE equipment_stock
-- =============================================
ALTER TABLE public.equipment_stock
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General'
    CHECK (category IN ('Microcontrolador','Sensor','Actuador','Herramienta','Módulo','Conector','Pasivo','General')),
  ADD COLUMN IF NOT EXISTS datasheet_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';

-- Índice para filtrado rápido por categoría
CREATE INDEX IF NOT EXISTS idx_equipment_stock_category ON public.equipment_stock(category);

-- =============================================
-- 3. SISTEMA DE PERFILES Y RBAC
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin','teacher','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- =============================================
-- 4. TRIGGER: AUTO-CREAR PERFIL AL REGISTRAR USUARIO
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'viewer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 5. FUNCIÓN HELPER: OBTENER ROL DEL USUARIO ACTUAL
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================
-- 6. ROW LEVEL SECURITY (RLS) - EQUIPMENT_STOCK
-- =============================================
ALTER TABLE public.equipment_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipment_stock_select" ON public.equipment_stock;
CREATE POLICY "equipment_stock_select"
  ON public.equipment_stock FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "equipment_stock_insert" ON public.equipment_stock;
CREATE POLICY "equipment_stock_insert"
  ON public.equipment_stock FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin','teacher'));

DROP POLICY IF EXISTS "equipment_stock_update" ON public.equipment_stock;
CREATE POLICY "equipment_stock_update"
  ON public.equipment_stock FOR UPDATE
  USING (public.get_user_role() IN ('admin','teacher'))
  WITH CHECK (public.get_user_role() IN ('admin','teacher'));

DROP POLICY IF EXISTS "equipment_stock_delete" ON public.equipment_stock;
CREATE POLICY "equipment_stock_delete"
  ON public.equipment_stock FOR DELETE
  USING (public.get_user_role() = 'admin');

-- =============================================
-- 7. ROW LEVEL SECURITY (RLS) - INVENTORY_LOGS
-- =============================================
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_logs_select" ON public.inventory_logs;
CREATE POLICY "inventory_logs_select"
  ON public.inventory_logs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "inventory_logs_insert" ON public.inventory_logs;
CREATE POLICY "inventory_logs_insert"
  ON public.inventory_logs FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin','teacher'));

-- =============================================
-- 8. ROW LEVEL SECURITY (RLS) - PROFILES
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- =============================================
-- 9. REALTIME (PARA ACTUALIZACIONES EN VIVO)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'equipment_stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_stock;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_logs;
  END IF;
END $$;
