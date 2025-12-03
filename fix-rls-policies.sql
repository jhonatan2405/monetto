-- SCRIPT DE CORRECCIÓN PARA POLÍTICAS RLS
-- Ejecuta este script en el SQL Editor de Supabase para corregir los errores 500

-- ============================================
-- PASO 1: Eliminar políticas problemáticas
-- ============================================

drop policy if exists "Users can view their own profile" on public.users;
drop policy if exists "Admins can view all profiles" on public.users;
drop policy if exists "Admins can update profiles" on public.users;

-- ============================================
-- PASO 2: Crear nueva política permisiva para SELECT
-- ============================================

-- Permitir que todos los usuarios autenticados vean información básica de otros usuarios
-- Esto es necesario para que los JOINs en gastos/ingresos funcionen correctamente
create policy "Authenticated users can view user profiles" on public.users
  for select using (auth.uid() is not null);

-- ============================================
-- PASO 3: Crear política de UPDATE para admins
-- ============================================

-- Solo admins pueden actualizar perfiles
create policy "Admins can update profiles" on public.users
  for update using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- PASO 4: Verificar políticas creadas
-- ============================================

-- Ejecuta esto para ver las políticas actuales:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies 
-- WHERE tablename = 'users';

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- Esta política permite que cualquier usuario autenticado vea los perfiles de otros usuarios.
-- Esto es seguro porque:
-- 1. Solo usuarios autenticados pueden acceder
-- 2. Solo se expone información básica (email, role, status)
-- 3. Es necesario para mostrar "Responsable" en las tablas de gastos/ingresos
-- 4. La política de UPDATE sigue restringida solo a admins

-- Si prefieres una política más restrictiva, puedes usar esta alternativa:
-- create policy "Users can view profiles in their transactions" on public.users
--   for select using (
--     auth.uid() = id OR
--     exists (
--       select 1 from public.gastos where usuario_id = public.users.id
--     ) OR
--     exists (
--       select 1 from public.ingresos where usuario_id = public.users.id
--     ) OR
--     exists (
--       select 1 from public.users where id = auth.uid() and role = 'admin'
--     )
--   );
