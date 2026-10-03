-- =============================================================================
-- SCRIPT MAESTRO DEFINITIVO (ALL-IN-ONE) — TALLER LÚBAN (INATEC)
-- Sistema de Gestión de Activos de Laboratorio (LIMS / EAM)
-- Copia y pega TODO este archivo en el SQL Editor de Supabase y dale "Run".
-- =============================================================================

-- =============================================================================
-- 1. EXTENSIONES
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 2. TIPOS ENUMERADOS DEL LABORATORIO
-- =============================================================================
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

-- =============================================================================
-- 3. TABLA DE PERFILES Y CONTROL DE ACCESO (RBAC)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'teacher', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Trigger: auto-crear perfil al registrar usuario en Supabase Auth
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

-- Función Helper: obtener rol del usuario autenticado actual
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- 4. TABLA PRINCIPAL: lab_equipment (Activos Técnicos de Laboratorio)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lab_equipment (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
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

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_lab_equipment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lab_equipment_updated_at ON public.lab_equipment;
CREATE TRIGGER trg_lab_equipment_updated_at
  BEFORE UPDATE ON public.lab_equipment
  FOR EACH ROW EXECUTE FUNCTION public.handle_lab_equipment_updated_at();

-- =============================================================================
-- 5. TABLA: equipment_transactions (Trazabilidad, Préstamos y Auditoría IA)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.equipment_transactions (
  id BIGSERIAL PRIMARY KEY,
  equipment_id BIGINT NOT NULL REFERENCES public.lab_equipment(id) ON DELETE CASCADE,
  action public.transaction_action_enum NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  assigned_to TEXT DEFAULT '',
  operator TEXT DEFAULT 'Docente',
  notes TEXT DEFAULT '',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_transactions_eq_id ON public.equipment_transactions(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_transactions_action ON public.equipment_transactions(action);
CREATE INDEX IF NOT EXISTS idx_equipment_transactions_timestamp ON public.equipment_transactions(timestamp DESC);

-- =============================================================================
-- 6. POLÍTICAS DE SEGURIDAD RLS (Row Level Security)
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: Lectura para autenticados, actualización solo admin
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

-- Lab Equipment: Lectura pública/autenticada, modificación docentes/admins, baja solo admin
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

-- Equipment Transactions: Lectura para todos, inserción para docentes y admins
DROP POLICY IF EXISTS "equipment_transactions_select" ON public.equipment_transactions;
CREATE POLICY "equipment_transactions_select" ON public.equipment_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "equipment_transactions_insert" ON public.equipment_transactions;
CREATE POLICY "equipment_transactions_insert" ON public.equipment_transactions FOR INSERT
WITH CHECK (public.get_user_role() IN ('admin', 'teacher'));

-- =============================================================================
-- 7. REPLICACIÓN EN TIEMPO REAL (Supabase Realtime WebSockets)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'lab_equipment') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_equipment;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'equipment_transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_transactions;
  END IF;
END $$;

-- =============================================================================
-- 8. COMPATIBILIDAD CON SERVIDOR LOCAL DE IA (equipment_stock legacy)
-- =============================================================================
-- Si equipment_stock ya existía como TABLA física, la removemos para crear la vista puente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'equipment_stock' 
      AND table_type = 'BASE TABLE'
  ) THEN
    DROP TABLE public.equipment_stock CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.equipment_stock AS
SELECT 
  id, 
  name, 
  total_quantity AS quantity, 
  description, 
  category, 
  datasheet_url, 
  location, 
  updated_at AS last_updated
FROM public.lab_equipment;

-- Si inventory_logs existía como TABLA física, la removemos para crear la vista puente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'inventory_logs' 
      AND table_type = 'BASE TABLE'
  ) THEN
    DROP TABLE public.inventory_logs CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.inventory_logs AS
SELECT 
  id,
  equipment_id,
  CASE 
    WHEN action = 'INGRESO_NUEVO' THEN 'ADD'
    WHEN action = 'PRESTAMO_CLASE' THEN 'REMOVE'
    WHEN action = 'DEVOLUCION' THEN 'ADD'
    ELSE 'ADJUST'
  END AS action,
  timestamp
FROM public.equipment_transactions;

-- =============================================================================
-- 9. DATOS SEMILLA (INSERTS INICIALES DEL TALLER LÚBAN · INATEC)
-- =============================================================================
INSERT INTO public.lab_equipment (name, category, total_quantity, available_quantity, condition, location, description, datasheet_url, min_threshold)
VALUES
  (
    'Kit de Desarrollo STM32F103VET6 (NEWLab)', 
    'IoT', 
    15, 
    12, 
    'Óptimo', 
    'Mesa 1 - Banco IoT', 
    'Microcontrolador ARM Cortex-M3 72MHz con interfaz para cámara OV7725 y Wi-Fi ESP8266.', 
    'https://www.st.com/resource/en/datasheet/stm32f103ve.pdf', 
    3
  ),
  (
    'Sensor de Temperatura y Humedad DHT22', 
    'IoT', 
    25, 
    20, 
    'Óptimo', 
    'Gabinete A - Gaveta 3', 
    'Sensor digital calibrado de alta precisión con bus unifilar (1-Wire).', 
    'https://www.sparkfun.com/datasheets/Sensors/Temperature/DHT22.pdf', 
    5
  ),
  (
    'Sensor Ultrasónico HC-SR04', 
    'IoT', 
    30, 
    24, 
    'Desgaste Menor', 
    'Gabinete A - Gaveta 4', 
    'Transductor de ultrasonido para medición de distancia (2cm - 400cm).', 
    'https://www.alldatasheet.com/datasheet-pdf/pdf/1132203/ETC2/HC-SR04.html', 
    5
  ),
  (
    'Módulo Wi-Fi ESP8266 NodeMCU V3', 
    'IoT', 
    20, 
    18, 
    'Óptimo', 
    'Mesa 2 - Banco IoT', 
    'SoC con pila TCP/IP integrada para conectividad perimetral de nodos NEWLab.', 
    'https://www.espressif.com/sites/default/files/documentation/0a-esp8266ex_datasheet_en.pdf', 
    4
  ),
  (
    'PLC Siemens SIMATIC S7-1200 (CPU 1214C)', 
    'Automatización', 
    6, 
    6, 
    'Óptimo', 
    'Banco de Automatización 1', 
    'Controlador lógico programable industrial con 14 DI / 10 DO / 2 AI.', 
    'https://support.industry.siemens.com', 
    2
  ),
  (
    'Servomotor Industrial MG996R Torque Alto', 
    'Mecatrónica', 
    18, 
    14, 
    'Óptimo', 
    'Mesa Mecatrónica - Gaveta 2', 
    'Servomotor con piñonería metálica de 180 grados y torque de 11 kg/cm.', 
    'https://components101.com/motors/mg996r-servo-motor-datasheet', 
    3
  ),
  (
    'Estación de Soldadura Digital Yihua 858D', 
    'Herramienta', 
    8, 
    7, 
    'Desgaste Menor', 
    'Mesa de Soldadura 1', 
    'Pistola de aire caliente con control microprocesado de temperatura para SMD.', 
    'https://yihua-soldering.com', 
    2
  ),
  (
    'Osciloscopio Digital Rigol DS1054Z (50MHz)', 
    'Instrumentación', 
    5, 
    3, 
    'Requiere Mantenimiento', 
    'Área de Diagnóstico', 
    'Osciloscopio digital de 4 canales. Canal 2 con conector BNC flojo.', 
    'https://www.rigolna.com/products/digital-oscilloscopes/1000z/', 
    2
  ),
  (
    'Kit Arduino Nano V3.0 (Atmega328P)', 
    'IoT', 
    22, 
    0, 
    'Dañado/Baja', 
    'Caja de Bajas / Reparación', 
    'Regulador de voltaje quemado por conexión a 12V en pin 5V durante práctica.', 
    'https://docs.arduino.cc/hardware/nano/', 
    4
  )
ON CONFLICT (name) DO UPDATE SET
  total_quantity = EXCLUDED.total_quantity,
  available_quantity = EXCLUDED.available_quantity,
  condition = EXCLUDED.condition,
  location = EXCLUDED.location;

-- =============================================================================
-- 10. TRANSACCIONES SEMILLA (BITÁCORA INICIAL DE PRÁCTICAS)
-- =============================================================================
INSERT INTO public.equipment_transactions (equipment_id, action, quantity, assigned_to, operator, notes)
SELECT 
  id, 
  'INGRESO_NUEVO'::public.transaction_action_enum, 
  total_quantity, 
  'Patrimonio Taller Lúban', 
  'Coordinador del Taller', 
  'Dotación institucional de laboratorio INATEC'
FROM public.lab_equipment
ON CONFLICT DO NOTHING;

-- Registrar préstamos de clase de ejemplo
INSERT INTO public.equipment_transactions (equipment_id, action, quantity, assigned_to, operator, notes)
SELECT 
  id, 
  'PRESTAMO_CLASE'::public.transaction_action_enum, 
  3, 
  'Grupo 2 - Turno Matutino (Clase IoT)', 
  'Instructor INATEC', 
  'Práctica de adquisición de variables climáticas'
FROM public.lab_equipment
WHERE name = 'Kit de Desarrollo STM32F103VET6 (NEWLab)'
LIMIT 1;

-- Registrar reporte de daño de ejemplo
INSERT INTO public.equipment_transactions (equipment_id, action, quantity, assigned_to, operator, notes)
SELECT 
  id, 
  'REPORTE_DANO'::public.transaction_action_enum, 
  1, 
  'Práctica de Mediciones RF', 
  'Instructor INATEC', 
  'Conector BNC del Canal 2 presenta falso contacto mecánico'
FROM public.lab_equipment
WHERE name = 'Osciloscopio Digital Rigol DS1054Z (50MHz)'
LIMIT 1;

-- Registrar auditoría por IA (nodo NEWLab) de ejemplo
INSERT INTO public.equipment_transactions (equipment_id, action, quantity, assigned_to, operator, notes)
SELECT 
  id, 
  'AUDITORIA_IA'::public.transaction_action_enum, 
  1, 
  'Mesa 1 - Cámara OV7725', 
  'IA Server (NEWLab)', 
  'Verificación automática: componente detectado en mesa de trabajo'
FROM public.lab_equipment
WHERE name = 'Kit de Desarrollo STM32F103VET6 (NEWLab)'
LIMIT 1;

-- =============================================================================
-- FIN DEL SCRIPT MAESTRO
-- =============================================================================
