-- =============================================================================
-- SEED: alimentos básicos ACTIVA (api_source = 'builtin')
-- Coincide con ALIMENTOS_BASICOS + slugify() en services/alimentos.service.ts
--
-- Ejecutar en: Supabase → SQL Editor (una vez por proyecto, o al ampliar lista)
--
-- Prerrequisito recomendado: índice único para upsert idempotente.
-- Si ya existe otro índice único en (api_source, api_id), puedes omitir la línea.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS foods_api_source_api_id_unique
ON public.foods (api_source, api_id);

INSERT INTO public.foods (
  nombre,
  api_source,
  api_id,
  calorias,
  proteinas,
  carbohidratos,
  grasas,
  fibra,
  azucar,
  is_custom,
  created_by,
  food_tier,
  source_kind,
  verified_basic
) VALUES
  ('Pechuga de pollo (cruda)', 'builtin', 'pechuga_de_pollo_cruda', 120, 22.5, 0, 2.6, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Pechuga de pollo (cocida)', 'builtin', 'pechuga_de_pollo_cocida', 165, 31, 0, 3.6, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Muslo de pollo (crudo)', 'builtin', 'muslo_de_pollo_crudo', 177, 17.5, 0, 12, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Pechuga de pavo (cruda)', 'builtin', 'pechuga_de_pavo_cruda', 104, 22, 0, 1.7, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Carne molida de res 80/20 (cruda)', 'builtin', 'carne_molida_de_res_80_20_cruda', 254, 17, 0, 20, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Filete de res (crudo)', 'builtin', 'filete_de_res_crudo', 158, 26, 0, 5.4, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Lomo de cerdo (crudo)', 'builtin', 'lomo_de_cerdo_crudo', 143, 21, 0, 6, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Tocino (cocido)', 'builtin', 'tocino_cocido', 458, 35, 0, 35, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Salmón (crudo)', 'builtin', 'salmon_crudo', 208, 20, 0, 13, 0, NULL, false, NULL, 'master', 'builtin', true),
  ('Atún en agua', 'builtin', 'atun_en_agua', 84, 20, 0, 0.5, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Tilapia (cruda)', 'builtin', 'tilapia_cruda', 96, 20, 0, 1.7, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Camarones (crudos)', 'builtin', 'camarones_crudos', 85, 20, 0, 0.9, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Huevo entero', 'builtin', 'huevo_entero', 143, 13, 0.7, 9.5, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Clara de huevo', 'builtin', 'clara_de_huevo', 52, 11, 0.7, 0.2, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Yema de huevo', 'builtin', 'yema_de_huevo', 322, 16, 3.6, 27, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Leche entera', 'builtin', 'leche_entera', 61, 3.2, 4.8, 3.3, NULL, 5.1, false, NULL, 'master', 'builtin', true),
  ('Leche descremada', 'builtin', 'leche_descremada', 34, 3.4, 5, 0.1, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Yogur natural', 'builtin', 'yogur_natural', 59, 3.5, 4.7, 3.3, NULL, 4.7, false, NULL, 'master', 'builtin', true),
  ('Queso cottage', 'builtin', 'queso_cottage', 98, 11, 3.4, 4.3, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Queso cheddar', 'builtin', 'queso_cheddar', 403, 25, 1.3, 33, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Mantequilla', 'builtin', 'mantequilla', 717, 0.9, 0.1, 81, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Arroz blanco (cocido)', 'builtin', 'arroz_blanco_cocido', 130, 2.7, 28, 0.3, 0.4, NULL, false, NULL, 'master', 'builtin', true),
  ('Arroz integral (cocido)', 'builtin', 'arroz_integral_cocido', 123, 2.7, 26, 1, 1.8, NULL, false, NULL, 'master', 'builtin', true),
  ('Avena (seca)', 'builtin', 'avena_seca', 389, 17, 66, 7, 10.6, 0, false, NULL, 'master', 'builtin', true),
  ('Pan integral', 'builtin', 'pan_integral', 247, 13, 41, 4.2, 6, NULL, false, NULL, 'master', 'builtin', true),
  ('Pan blanco', 'builtin', 'pan_blanco', 267, 9, 51, 3.2, 2.3, NULL, false, NULL, 'master', 'builtin', true),
  ('Pasta (cocida)', 'builtin', 'pasta_cocida', 158, 5.8, 31, 0.9, 1.8, NULL, false, NULL, 'master', 'builtin', true),
  ('Quinoa (cocida)', 'builtin', 'quinoa_cocida', 120, 4.4, 21, 1.9, 2.8, NULL, false, NULL, 'master', 'builtin', true),
  ('Tortilla de maíz', 'builtin', 'tortilla_de_maiz', 218, 5.7, 45, 2.9, 6.3, NULL, false, NULL, 'master', 'builtin', true),
  ('Brócoli (crudo)', 'builtin', 'brocoli_crudo', 34, 2.8, 7, 0.4, 2.6, NULL, false, NULL, 'master', 'builtin', true),
  ('Espinaca (cruda)', 'builtin', 'espinaca_cruda', 23, 2.9, 3.6, 0.4, 2.2, NULL, false, NULL, 'master', 'builtin', true),
  ('Zanahoria (cruda)', 'builtin', 'zanahoria_cruda', 41, 0.9, 10, 0.2, 2.8, NULL, false, NULL, 'master', 'builtin', true),
  ('Papa / Patata (cocida)', 'builtin', 'papa_patata_cocida', 87, 1.9, 20, 0.1, 1.8, NULL, false, NULL, 'master', 'builtin', true),
  ('Camote / Batata (cocido)', 'builtin', 'camote_batata_cocido', 86, 1.6, 20, 0.1, 3, NULL, false, NULL, 'master', 'builtin', true),
  ('Aguacate', 'builtin', 'aguacate', 160, 2, 9, 15, 6.7, NULL, false, NULL, 'master', 'builtin', true),
  ('Tomate (crudo)', 'builtin', 'tomate_crudo', 18, 0.9, 3.9, 0.2, 1.2, NULL, false, NULL, 'master', 'builtin', true),
  ('Plátano / Banana', 'builtin', 'platano_banana', 89, 1.1, 23, 0.3, 2.6, 12, false, NULL, 'master', 'builtin', true),
  ('Manzana', 'builtin', 'manzana', 52, 0.3, 14, 0.2, 2.4, 10, false, NULL, 'master', 'builtin', true),
  ('Fresa', 'builtin', 'fresa', 32, 0.7, 7.7, 0.3, 2, 4.9, false, NULL, 'master', 'builtin', true),
  ('Naranja', 'builtin', 'naranja', 47, 0.9, 12, 0.1, 2.4, 9.4, false, NULL, 'master', 'builtin', true),
  ('Mango', 'builtin', 'mango', 60, 0.8, 15, 0.4, 1.6, 13.7, false, NULL, 'master', 'builtin', true),
  ('Frijoles negros (cocidos)', 'builtin', 'frijoles_negros_cocidos', 132, 8.9, 24, 0.5, 8.7, NULL, false, NULL, 'master', 'builtin', true),
  ('Lentejas (cocidas)', 'builtin', 'lentejas_cocidas', 116, 9, 20, 0.4, 7.9, NULL, false, NULL, 'master', 'builtin', true),
  ('Garbanzos (cocidos)', 'builtin', 'garbanzos_cocidos', 164, 8.9, 27, 2.6, 7.6, NULL, false, NULL, 'master', 'builtin', true),
  ('Tofu', 'builtin', 'tofu', 76, 8, 1.9, 4.8, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Almendras', 'builtin', 'almendras', 579, 21, 22, 50, 12.5, NULL, false, NULL, 'master', 'builtin', true),
  ('Mantequilla de maní', 'builtin', 'mantequilla_de_mani', 588, 25, 20, 50, 6, NULL, false, NULL, 'master', 'builtin', true),
  ('Maní / Cacahuate', 'builtin', 'mani_cacahuate', 567, 26, 16, 49, 8.5, NULL, false, NULL, 'master', 'builtin', true),
  ('Semillas de chía', 'builtin', 'semillas_de_chia', 486, 17, 42, 31, 34, NULL, false, NULL, 'master', 'builtin', true),
  ('Aceite de oliva', 'builtin', 'aceite_de_oliva', 884, 0, 0, 100, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Aceite de coco', 'builtin', 'aceite_de_coco', 862, 0, 0, 100, NULL, NULL, false, NULL, 'master', 'builtin', true),
  ('Proteína whey (suero)', 'builtin', 'proteina_whey_suero', 400, 80, 8, 7, NULL, NULL, false, NULL)
ON CONFLICT (api_source, api_id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  calorias = EXCLUDED.calorias,
  proteinas = EXCLUDED.proteinas,
  carbohidratos = EXCLUDED.carbohidratos,
  grasas = EXCLUDED.grasas,
  fibra = EXCLUDED.fibra,
  azucar = EXCLUDED.azucar,
  is_custom = EXCLUDED.is_custom,
  created_by = EXCLUDED.created_by,
  food_tier = EXCLUDED.food_tier,
  source_kind = EXCLUDED.source_kind,
  verified_basic = EXCLUDED.verified_basic;

-- Nota: si CREATE UNIQUE INDEX falla por filas duplicadas previas, limpia duplicados
-- en foods con el mismo (api_source, api_id) y vuelve a ejecutar.
