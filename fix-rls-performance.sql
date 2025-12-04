-- ============================================
-- OPTIMIZACIÓN DE POLÍTICAS RLS
-- Solución para: "RLS policies are being unnecessarily re-evaluated for each row"
-- ============================================

-- Primero, eliminar todas las políticas existentes que causan el problema
DROP POLICY IF EXISTS "Users can view own data" ON public.gastos;
DROP POLICY IF EXISTS "Users can insert own data" ON public.gastos;
DROP POLICY IF EXISTS "Users can update own data" ON public.gastos;
DROP POLICY IF EXISTS "Users can delete own data" ON public.gastos;

DROP POLICY IF EXISTS "Users can view own data" ON public.ingresos;
DROP POLICY IF EXISTS "Users can insert own data" ON public.ingresos;
DROP POLICY IF EXISTS "Users can update own data" ON public.ingresos;
DROP POLICY IF EXISTS "Users can delete own data" ON public.ingresos;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.categorias;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.metodos_pago;

-- ============================================
-- POLÍTICAS OPTIMIZADAS PARA GASTOS
-- ============================================

-- SELECT: Optimizado con índice
CREATE POLICY "gastos_select_policy" ON public.gastos
FOR SELECT
USING (
  CASE 
    WHEN (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' THEN true
    ELSE usuario_id = auth.uid()
  END
);

-- INSERT: Solo usuarios autenticados
CREATE POLICY "gastos_insert_policy" ON public.gastos
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  usuario_id = auth.uid()
);

-- UPDATE: Solo admin o propio usuario
CREATE POLICY "gastos_update_policy" ON public.gastos
FOR UPDATE
USING (
  CASE 
    WHEN (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' THEN true
    ELSE usuario_id = auth.uid()
  END
);

-- DELETE: Solo admin
CREATE POLICY "gastos_delete_policy" ON public.gastos
FOR DELETE
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- ============================================
-- POLÍTICAS OPTIMIZADAS PARA INGRESOS
-- ============================================

-- SELECT: Optimizado con índice
CREATE POLICY "ingresos_select_policy" ON public.ingresos
FOR SELECT
USING (
  CASE 
    WHEN (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' THEN true
    ELSE usuario_id = auth.uid()
  END
);

-- INSERT: Solo usuarios autenticados
CREATE POLICY "ingresos_insert_policy" ON public.ingresos
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  usuario_id = auth.uid()
);

-- UPDATE: Solo admin o propio usuario
CREATE POLICY "ingresos_update_policy" ON public.ingresos
FOR UPDATE
USING (
  CASE 
    WHEN (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' THEN true
    ELSE usuario_id = auth.uid()
  END
);

-- DELETE: Solo admin
CREATE POLICY "ingresos_delete_policy" ON public.ingresos
FOR DELETE
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- ============================================
-- POLÍTICAS OPTIMIZADAS PARA CATEGORIAS
-- ============================================

-- SELECT: Todos pueden leer
CREATE POLICY "categorias_select_policy" ON public.categorias
FOR SELECT
USING (true);

-- INSERT/UPDATE/DELETE: Solo admin
CREATE POLICY "categorias_modify_policy" ON public.categorias
FOR ALL
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- ============================================
-- POLÍTICAS OPTIMIZADAS PARA METODOS_PAGO
-- ============================================

-- SELECT: Todos pueden leer
CREATE POLICY "metodos_pago_select_policy" ON public.metodos_pago
FOR SELECT
USING (true);

-- INSERT/UPDATE/DELETE: Solo admin
CREATE POLICY "metodos_pago_modify_policy" ON public.metodos_pago
FOR ALL
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- ============================================
-- ÍNDICES PARA OPTIMIZAR CONSULTAS RLS
-- ============================================

-- Índice en users.id para acelerar lookups de role
CREATE INDEX IF NOT EXISTS idx_users_id_role ON public.users(id, role);

-- Índices en usuario_id para acelerar filtros
CREATE INDEX IF NOT EXISTS idx_gastos_usuario_id ON public.gastos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_usuario_id ON public.ingresos(usuario_id);

-- Índices en fecha para acelerar consultas de rango
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON public.gastos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON public.ingresos(fecha DESC);

-- Índice compuesto para consultas comunes
CREATE INDEX IF NOT EXISTS idx_gastos_usuario_fecha ON public.gastos(usuario_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ingresos_usuario_fecha ON public.ingresos(usuario_id, fecha DESC);

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Ver políticas activas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Ver índices
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
