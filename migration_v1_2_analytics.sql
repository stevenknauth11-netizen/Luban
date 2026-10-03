-- =============================================================================
-- MIGRACIÓN COMPLEMENTARIA V1.2: ANALÍTICA Y AUDITORÍA AVANZADA
-- Taller Luban ERP Dashboard
-- =============================================================================

-- 1. Añadir umbral mínimo personalizado de alerta por componente (por defecto: 5)
ALTER TABLE public.equipment_stock
  ADD COLUMN IF NOT EXISTS min_threshold INTEGER DEFAULT 5;

-- 2. Añadir operador / origen de la transacción en los logs de inventario
ALTER TABLE public.inventory_logs
  ADD COLUMN IF NOT EXISTS operator TEXT DEFAULT 'IA Server (NEWLab)';

-- 3. Índice para acelerar filtros temporales en el Visualizador de Auditoría
CREATE INDEX IF NOT EXISTS idx_inventory_logs_timestamp ON public.inventory_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_action ON public.inventory_logs(action);
