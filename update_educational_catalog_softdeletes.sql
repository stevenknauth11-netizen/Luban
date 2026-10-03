-- =============================================================================
-- DIRECTIVA DE BASE DE DATOS: CATÁLOGO EDUCATIVO, SOFT-DELETES Y KITS
-- Taller Lúban (Centro de Capacitación Tecnológica Nicaragua-China)
-- =============================================================================

-- 1. TABLA DINÁMICA DE CATEGORÍAS (equipment_categories)
CREATE TABLE IF NOT EXISTS public.equipment_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_categories_active ON public.equipment_categories(is_active);

-- Seed inicial de categorías oficiales del Taller Luban
INSERT INTO public.equipment_categories (name, description, is_active)
VALUES 
  ('IoT', 'Microcontroladores, gateways perimetrales, conectividad Wi-Fi y protocolos de comunicación.', true),
  ('Automatización', 'Autómatas programables (PLC), contactores industriales, relevadores y módulos de potencia.', true),
  ('Mecatrónica', 'Servomotores, motores a pasos, actuadores lineales, drivers y sistemas electromecánicos.', true),
  ('Interfaces HMI', 'Pantallas gráficas LCD, teclados matriciales, displays táctiles y paneles de interfaz hombre-máquina.', true),
  ('Sensores y Biometría', 'Lectores biométricos dactilares, sensores de temperatura, humedad, distancia y variables físicas.', true),
  ('Comunicaciones y Red', 'Módulos de red Ethernet, transceptores bus CAN, RS485 y enlaces de comunicación industrial.', true),
  ('Módulos de Expansión', 'Placas de expansión de funciones I/O, shields periféricos y adaptadores didácticos de señales.', true),
  ('Diseño CAD', 'Kits de modelado 3D, impresión de filamento, escaneo tridimensional y piezas estructurales.', true),
  ('Herramienta', 'Estaciones de soldadura, multímetros portátiles, pinzas de precisión y herramienta manual de banco.', true),
  ('Instrumentación', 'Osciloscopios de banco, generadores de funciones, fuentes DC reguladas y analizadores lógicos.', true),
  ('Consumibles y Fungibles', 'Estaño de soldadura, filamento PLA, resistencias, jumpers, pasta térmica y componentes no retornables.', true),
  ('General', 'Accesorios de laboratorio, fuentes de alimentación universales y adaptadores didácticos.', true)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_active = true;

-- Liberar constraint restrictivo de categorías para permitir dinámicas
ALTER TABLE public.lab_equipment DROP CONSTRAINT IF EXISTS lab_equipment_category_check;

-- 2. EVOLUCIÓN DE LA TABLA lab_equipment HACIA CATÁLOGO EDUCATIVO
DO $$
BEGIN
  -- Agregar columna category_id (Foreign Key)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lab_equipment' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.lab_equipment ADD COLUMN category_id BIGINT REFERENCES public.equipment_categories(id) ON DELETE RESTRICT;
  END IF;

  -- Agregar campos educativos y de especificaciones
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lab_equipment' AND column_name = 'short_description'
  ) THEN
    ALTER TABLE public.lab_equipment ADD COLUMN short_description TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lab_equipment' AND column_name = 'educational_use'
  ) THEN
    ALTER TABLE public.lab_equipment ADD COLUMN educational_use TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lab_equipment' AND column_name = 'technical_specs'
  ) THEN
    ALTER TABLE public.lab_equipment ADD COLUMN technical_specs JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Agregar campos de control y logística (Soft-Delete y Consumibles)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lab_equipment' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.lab_equipment ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lab_equipment' AND column_name = 'is_consumable'
  ) THEN
    ALTER TABLE public.lab_equipment ADD COLUMN is_consumable BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lab_equipment' AND column_name = 'min_stock_alert'
  ) THEN
    ALTER TABLE public.lab_equipment ADD COLUMN min_stock_alert INTEGER NOT NULL DEFAULT 3;
  END IF;
END $$;

-- Migrar category_id basado en los nombres de categoría existentes
UPDATE public.lab_equipment le
SET category_id = ec.id
FROM public.equipment_categories ec
WHERE le.category = ec.name AND le.category_id IS NULL;

-- Asignar categoría 'General' como fallback para registros sin enlace
UPDATE public.lab_equipment
SET category_id = (SELECT id FROM public.equipment_categories WHERE name = 'General' LIMIT 1)
WHERE category_id IS NULL;

-- Índices de alto rendimiento para el catálogo educativo
CREATE INDEX IF NOT EXISTS idx_lab_equipment_category_id ON public.lab_equipment(category_id);
CREATE INDEX IF NOT EXISTS idx_lab_equipment_is_active ON public.lab_equipment(is_active);
CREATE INDEX IF NOT EXISTS idx_lab_equipment_is_consumable ON public.lab_equipment(is_consumable);
CREATE INDEX IF NOT EXISTS idx_lab_equipment_specs ON public.lab_equipment USING GIN (technical_specs);

-- 3. GESTIÓN DE KITS EDUCATIVOS (BUNDLES / PAQUETES DIDÁCTICOS)
CREATE TABLE IF NOT EXISTS public.equipment_kits (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.equipment_kit_items (
  id BIGSERIAL PRIMARY KEY,
  kit_id BIGINT NOT NULL REFERENCES public.equipment_kits(id) ON DELETE CASCADE,
  equipment_id BIGINT NOT NULL REFERENCES public.lab_equipment(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (kit_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_kit_items_kit_id ON public.equipment_kit_items(kit_id);

-- Función para prestar un kit completo de forma atómica
CREATE OR REPLACE FUNCTION public.loan_equipment_kit(
  p_kit_id BIGINT,
  p_assigned_to TEXT,
  p_operator TEXT,
  p_notes TEXT DEFAULT 'Préstamo de kit didáctico consolidado'
)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_avail INTEGER;
BEGIN
  -- Validar disponibilidad de todos los componentes antes de descontar
  FOR v_item IN (SELECT equipment_id, quantity FROM public.equipment_kit_items WHERE kit_id = p_kit_id) LOOP
    SELECT available_quantity INTO v_avail FROM public.lab_equipment WHERE id = v_item.equipment_id;
    IF v_avail < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para el componente ID % del kit. Disponible: %, Requerido: %',
        v_item.equipment_id, v_avail, v_item.quantity;
    END IF;
  END LOOP;

  -- Descontar stock y registrar transacciones
  FOR v_item IN (SELECT equipment_id, quantity FROM public.equipment_kit_items WHERE kit_id = p_kit_id) LOOP
    UPDATE public.lab_equipment 
    SET available_quantity = available_quantity - v_item.quantity
    WHERE id = v_item.equipment_id;

    INSERT INTO public.equipment_transactions (equipment_id, action, quantity, assigned_to, operator, notes)
    VALUES (
      v_item.equipment_id,
      'PRESTAMO_CLASE',
      v_item.quantity,
      p_assigned_to,
      p_operator,
      CONCAT('[Kit #', p_kit_id, '] ', p_notes)
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. BLOQUEO ESTRICTO CONTRA HARD-DELETE (PREVENCIÓN DE BORRADO FÍSICO)
-- En cumplimiento con auditorías INATEC, el borrado físico (DELETE) queda revocado.
-- Se exige el uso exclusivo de Soft-Deletes (UPDATE is_active = false).

REVOKE DELETE ON public.lab_equipment FROM public, anon, authenticated;
REVOKE DELETE ON public.equipment_categories FROM public, anon, authenticated;
REVOKE DELETE ON public.equipment_transactions FROM public, anon, authenticated;
REVOKE DELETE ON public.equipment_kits FROM public, anon, authenticated;
REVOKE DELETE ON public.equipment_kit_items FROM public, anon, authenticated;

-- Políticas de RLS (Row Level Security) para blindar el DELETE
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lab_equipment_delete" ON public.lab_equipment;
DROP POLICY IF EXISTS "no_hard_delete_lab_equipment" ON public.lab_equipment;
CREATE POLICY "no_hard_delete_lab_equipment" ON public.lab_equipment
FOR DELETE USING (false);

DROP POLICY IF EXISTS "no_hard_delete_equipment_categories" ON public.equipment_categories;
CREATE POLICY "no_hard_delete_equipment_categories" ON public.equipment_categories
FOR DELETE USING (false);

-- Políticas RLS para equipment_categories (Lectura pública, creación/edición docentes y admins)
DROP POLICY IF EXISTS "equipment_categories_select" ON public.equipment_categories;
CREATE POLICY "equipment_categories_select" ON public.equipment_categories
FOR SELECT USING (true);

DROP POLICY IF EXISTS "equipment_categories_insert" ON public.equipment_categories;
CREATE POLICY "equipment_categories_insert" ON public.equipment_categories
FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "equipment_categories_update" ON public.equipment_categories;
CREATE POLICY "equipment_categories_update" ON public.equipment_categories
FOR UPDATE USING (public.get_user_role() IN ('admin', 'teacher'))
WITH CHECK (public.get_user_role() IN ('admin', 'teacher'));

-- 5. SEMILLA DE DATOS EDUCATIVOS Y ESPECIFICACIONES TÉCNICAS (JSONB)
UPDATE public.lab_equipment
SET 
  short_description = 'Placa de desarrollo embebida de alto rendimiento con arquitectura ARM Cortex-M3 de 32 bits.',
  educational_use = 'Se utiliza en el módulo de Sistemas Embebidos e IoT para prácticas de protocolos UART/I2C/SPI, control PWM y conectividad industrial.',
  technical_specs = '{
    "Núcleo": "ARM Cortex-M3 (72 MHz)",
    "Voltaje de Operación": "3.3V DC (Entrada USB 5V)",
    "Memoria Flash": "512 KB",
    "SRAM": "64 KB",
    "Periféricos": "FSMC, CAN, USB, 8x Temporizadores, 3x ADC 12-bit",
    "Pines I/O": "80 GPIOs tolerantes a 5V",
    "Fabricante": "STMicroelectronics / NEWLab"
  }'::jsonb,
  is_consumable = false,
  min_stock_alert = 4
WHERE name ILIKE '%STM32%';

UPDATE public.lab_equipment
SET 
  short_description = 'Osciloscopio digital de 4 canales con ancho de banda de 50 MHz y tasa de muestreo de 1 GSa/s.',
  educational_use = 'Instrumento fundamental para visualización y análisis de formas de onda analógicas y digitales, decodificación de buses serie y medición de armónicos.',
  technical_specs = '{
    "Ancho de Banda": "50 MHz (4 canales analógicos)",
    "Tasa de Muestreo": "1 GSa/s en tiempo real",
    "Profundidad de Memoria": "12 Mpts estándar (hasta 24 Mpts)",
    "Pantalla": "7 pulgadas WVGA TFT a color (800x480)",
    "Conectividad": "USB Host & Device, LAN (LXI)",
    "Alimentación": "100V - 240V AC, 50/60 Hz"
  }'::jsonb,
  is_consumable = false,
  min_stock_alert = 2
WHERE name ILIKE '%Osciloscopio%';

UPDATE public.lab_equipment
SET 
  short_description = 'Sensor digital calibrado de temperatura y humedad relativa con bus digital de un solo hilo.',
  educational_use = 'Prácticas de telemetría ambiental, adquisición de datos de estaciones climáticas y monitoreo de cuartos fríos en automatización.',
  technical_specs = '{
    "Rango Temperatura": "-40°C a +80°C (Precisión ±0.5°C)",
    "Rango Humedad": "0% a 100% RH (Precisión ±2%)",
    "Voltaje": "3.3V a 5.5V DC",
    "Consumo": "1.5 mA en medición / 50 uA en reposo",
    "Protocolo": "Digital One-Wire propietario"
  }'::jsonb,
  is_consumable = false,
  min_stock_alert = 5
WHERE name ILIKE '%DHT22%';

-- Replicar categorías en tiempo real
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'equipment_categories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_categories;
  END IF;
END $$;
