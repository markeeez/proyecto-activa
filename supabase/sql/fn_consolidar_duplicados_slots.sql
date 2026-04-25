-- PERF-05: consolidarDuplicadosSlots en un solo RPC atómico
--
-- Antes: 4 queries secuenciales sin transacción (SELECT + UPDATE items +
--        DELETE meal + UPDATE keeper). Si fallaba entre pasos → estado
--        inconsistente (items movidos pero loser no borrado, etc.)
--
-- Ahora: todo en una sola función PL/pgSQL con transacción implícita.
--        Una sola llamada de red, rollback automático si algo falla.
--
-- Ejecutar en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.consolidar_duplicados_slots(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  slot_rec   record;
  loser_rec  record;
  v_keeper   uuid;
BEGIN
  -- Itera sobre los 4 slots predeterminados (mismos que COMIDAS_PREDETERMINADAS en app)
  FOR slot_rec IN
    SELECT *
    FROM (VALUES (1, 'Desayuno'),
                 (2, 'Almuerzo'),
                 (3, 'Merienda'),
                 (4, 'Cena')) AS s(orden, nombre)
  LOOP
    -- Elige el keeper: candidato con más ítems; empate → id más pequeño
    SELECT m.id INTO v_keeper
    FROM nutrition_log_meals m
    LEFT JOIN nutrition_log_items i ON i.meal_id = m.id
    WHERE m.log_id = p_log_id
      AND m.orden  = slot_rec.orden
      AND (
        m.is_default = true
        OR m.nombre IS NULL
        OR trim(m.nombre) = ''
        OR lower(trim(m.nombre)) = 'comida'
        OR lower(trim(m.nombre)) = lower(slot_rec.nombre::text)
      )
    GROUP BY m.id
    ORDER BY COUNT(i.id) DESC, m.id ASC
    LIMIT 1;

    -- Sin candidatos o solo uno → nada que consolidar
    IF v_keeper IS NULL THEN
      CONTINUE;
    END IF;

    -- Procesa los losers (candidatos del mismo slot excepto el keeper)
    FOR loser_rec IN
      SELECT m.id
      FROM nutrition_log_meals m
      WHERE m.log_id = p_log_id
        AND m.orden  = slot_rec.orden
        AND m.id    <> v_keeper
        AND (
          m.is_default = true
          OR m.nombre IS NULL
          OR trim(m.nombre) = ''
          OR lower(trim(m.nombre)) = 'comida'
          OR lower(trim(m.nombre)) = lower(slot_rec.nombre::text)
        )
    LOOP
      -- Mueve ítems al keeper
      UPDATE nutrition_log_items
      SET    meal_id = v_keeper
      WHERE  meal_id = loser_rec.id;

      -- Borra el loser (ya sin ítems)
      DELETE FROM nutrition_log_meals WHERE id = loser_rec.id;
    END LOOP;

    -- Normaliza el keeper (nombre canónico, is_default = true)
    UPDATE nutrition_log_meals
    SET    nombre     = slot_rec.nombre,
           orden      = slot_rec.orden,
           is_default = true
    WHERE  id = v_keeper;

  END LOOP;
END;
$$;
