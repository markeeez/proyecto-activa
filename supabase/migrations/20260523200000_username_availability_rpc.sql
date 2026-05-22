-- Función pública para comprobar disponibilidad de username sin autenticación.
-- SECURITY DEFINER permite saltarse RLS de forma controlada.
CREATE OR REPLACE FUNCTION public.username_disponible(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE username = p_username
  );
$$;

-- Accesible por usuarios anónimos (necesario en la pantalla de registro)
GRANT EXECUTE ON FUNCTION public.username_disponible(text) TO anon;
GRANT EXECUTE ON FUNCTION public.username_disponible(text) TO authenticated;
