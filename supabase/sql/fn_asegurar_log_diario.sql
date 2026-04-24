-- Fix 8B: RPC SECURITY DEFINER que colapsa asegurarLogDiario + asegurarComidasPredeterminadasSiVacias
-- en un único round-trip desde el cliente.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor

CREATE OR REPLACE FUNCTION public.asegurar_log_diario(
  p_user_id uuid,
  p_fecha    date
)
RETURNS TABLE (
  id                      uuid,
  user_id                 uuid,
  fecha                   date,
  created_at              timestamptz,
  excluded_meal_type_ids  uuid[],
  inserto_predeterminadas boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log   nutrition_logs%ROWTYPE;
  v_count integer;
  v_inserto boolean := false;
BEGIN
  -- 1. Upsert atómico: crea el log si no existe, o devuelve el existente.
  INSERT INTO nutrition_logs (user_id, fecha)
  VALUES (p_user_id, p_fecha)
  ON CONFLICT (user_id, fecha) DO UPDATE
    SET user_id = EXCLUDED.user_id  -- no-op; solo para que RETURNING funcione en ambos casos
  RETURNING * INTO v_log;

  -- 2. Solo en hoy/futuro: insertar las 4 comidas predeterminadas si el log está vacío.
  IF p_fecha >= CURRENT_DATE THEN
    SELECT COUNT(*) INTO v_count
    FROM nutrition_log_meals
    WHERE log_id = v_log.id;

    IF v_count = 0 THEN
      INSERT INTO nutrition_log_meals (log_id, nombre, orden, is_default, meal_type_id)
      VALUES
        (v_log.id, 'Desayuno', 1, true, null),
        (v_log.id, 'Almuerzo', 2, true, null),
        (v_log.id, 'Merienda', 3, true, null),
        (v_log.id, 'Cena',     4, true, null);
      v_inserto := true;
    END IF;
  END IF;

  RETURN QUERY
    SELECT
      v_log.id,
      v_log.user_id,
      v_log.fecha,
      v_log.created_at,
      v_log.excluded_meal_type_ids,
      v_inserto;
END;
$$;

-- Solo usuarios autenticados pueden llamar esta función.
REVOKE EXECUTE ON FUNCTION public.asegurar_log_diario(uuid, date) FROM public;
GRANT  EXECUTE ON FUNCTION public.asegurar_log_diario(uuid, date) TO authenticated;
