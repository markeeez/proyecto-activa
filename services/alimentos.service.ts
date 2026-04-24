/**
 * SERVICIO DE ALIMENTOS
 *
 * Flujo de búsqueda:
 *   1. Opcional: ALIMENTOS_BASICOS (`INCLUIR_BASICOS_EN_BUSQUEDA`).
 *   2. Hasta 5 slots: `foods` con api_source `generic` (semilla SQL), ordenados por relevancia.
 *   3. 5 slots: USDA Foundation (query EN vía LibreTranslate; EN→ES en nombres).
 *   4. 10 slots: Open Food Facts España (término ES; token en nombre).
 *   5. Tras ellos: personalizados del usuario hasta `MAX_RESULTADOS_BUSQUEDA`.
 *   Upsert USDA/OFF vía `foods-upsert-global`; ranking por capa + texto + popularidad dentro de cada tramo.
 *
 * Escritura globales: Edge Functions + service_role (RLS modelo B). Custom: INSERT cliente.
 */

import {
    FATSECRET_API_SOURCE,
    FOOD_API_SOURCE,
    USDA_FDC_API_KEY,
} from '@/constants/config';
import { libreTranslate } from '@/lib/libretranslate';
import { supabase } from '@/lib/supabase';
import {
    normalizarTexto,
    nombreContieneTodasLasPalabras,
    palabrasBusqueda,
    sanitizarFragmentoIlike,
    elegirAnclajeBusqueda,
} from '@/lib/texto';
import type {
    Food,
    FoodSourceKind,
    FoodTier,
} from '@/types/database.types';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// DICCIONARIO DE ALIMENTOS BÁSICOS
// Valores por 100g según USDA FoodData Central (Foundation / SR Legacy).
// Estos alimentos siempre aparecen primero cuando coinciden con la búsqueda.
// ---------------------------------------------------------------------------
interface AlimentoBasico {
  nombre: string;
  keywords: string[]; // términos que activan este alimento (ES y EN)
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  fibra?: number;
  azucar?: number;
}

const ALIMENTOS_BASICOS: AlimentoBasico[] = [
  // ── Aves ──────────────────────────────────────────────────────────────────
  { nombre: 'Pechuga de pollo (cruda)', keywords: ['pollo', 'chicken', 'pechuga pollo', 'pechuga de pollo', 'chicken breast'], calorias: 120, proteinas: 22.5, carbohidratos: 0, grasas: 2.6 },
  { nombre: 'Pechuga de pollo (cocida)', keywords: ['pollo cocido', 'pollo asado', 'chicken cooked', 'pechuga cocida'], calorias: 165, proteinas: 31, carbohidratos: 0, grasas: 3.6 },
  { nombre: 'Muslo de pollo (crudo)', keywords: ['muslo pollo', 'muslo de pollo', 'chicken thigh'], calorias: 177, proteinas: 17.5, carbohidratos: 0, grasas: 12 },
  { nombre: 'Pechuga de pavo (cruda)', keywords: ['pavo', 'turkey', 'pechuga pavo', 'turkey breast'], calorias: 104, proteinas: 22, carbohidratos: 0, grasas: 1.7 },

  // ── Res y cerdo ───────────────────────────────────────────────────────────
  { nombre: 'Carne molida de res 80/20 (cruda)', keywords: ['carne molida', 'carne res', 'res', 'beef', 'ground beef', 'carne picada'], calorias: 254, proteinas: 17, carbohidratos: 0, grasas: 20 },
  { nombre: 'Filete de res (crudo)', keywords: ['filete', 'steak', 'sirloin', 'lomo res'], calorias: 158, proteinas: 26, carbohidratos: 0, grasas: 5.4 },
  { nombre: 'Lomo de cerdo (crudo)', keywords: ['cerdo', 'pork', 'lomo cerdo', 'lomo de cerdo', 'pork loin'], calorias: 143, proteinas: 21, carbohidratos: 0, grasas: 6 },
  { nombre: 'Tocino (cocido)', keywords: ['tocino', 'bacon'], calorias: 458, proteinas: 35, carbohidratos: 0, grasas: 35 },

  // ── Pescados y mariscos ───────────────────────────────────────────────────
  { nombre: 'Salmón (crudo)', keywords: ['salmon', 'salmón'], calorias: 208, proteinas: 20, carbohidratos: 0, grasas: 13, fibra: 0 },
  { nombre: 'Atún en agua', keywords: ['atun', 'atún', 'tuna', 'atun en agua'], calorias: 84, proteinas: 20, carbohidratos: 0, grasas: 0.5 },
  { nombre: 'Tilapia (cruda)', keywords: ['tilapia'], calorias: 96, proteinas: 20, carbohidratos: 0, grasas: 1.7 },
  { nombre: 'Camarones (crudos)', keywords: ['camaron', 'camarón', 'camarones', 'shrimp'], calorias: 85, proteinas: 20, carbohidratos: 0, grasas: 0.9 },

  // ── Huevo ─────────────────────────────────────────────────────────────────
  { nombre: 'Huevo entero', keywords: ['huevo', 'egg', 'huevos', 'eggs'], calorias: 143, proteinas: 13, carbohidratos: 0.7, grasas: 9.5 },
  { nombre: 'Clara de huevo', keywords: ['clara', 'clara de huevo', 'egg white'], calorias: 52, proteinas: 11, carbohidratos: 0.7, grasas: 0.2 },
  { nombre: 'Yema de huevo', keywords: ['yema', 'yema de huevo', 'egg yolk'], calorias: 322, proteinas: 16, carbohidratos: 3.6, grasas: 27 },

  // ── Lácteos ───────────────────────────────────────────────────────────────
  { nombre: 'Leche entera', keywords: ['leche', 'milk', 'leche entera', 'whole milk'], calorias: 61, proteinas: 3.2, carbohidratos: 4.8, grasas: 3.3, azucar: 5.1 },
  { nombre: 'Leche descremada', keywords: ['leche descremada', 'leche light', 'skim milk'], calorias: 34, proteinas: 3.4, carbohidratos: 5, grasas: 0.1 },
  { nombre: 'Yogur natural', keywords: ['yogur', 'yogurt', 'yogur natural'], calorias: 59, proteinas: 3.5, carbohidratos: 4.7, grasas: 3.3, azucar: 4.7 },
  { nombre: 'Queso cottage', keywords: ['queso cottage', 'cottage cheese', 'cottage'], calorias: 98, proteinas: 11, carbohidratos: 3.4, grasas: 4.3 },
  { nombre: 'Queso cheddar', keywords: ['queso cheddar', 'cheddar', 'queso'], calorias: 403, proteinas: 25, carbohidratos: 1.3, grasas: 33 },
  { nombre: 'Mantequilla', keywords: ['mantequilla', 'butter'], calorias: 717, proteinas: 0.9, carbohidratos: 0.1, grasas: 81 },

  // ── Granos y cereales ─────────────────────────────────────────────────────
  { nombre: 'Arroz blanco (cocido)', keywords: ['arroz', 'rice', 'arroz blanco', 'white rice', 'arroz cocido'], calorias: 130, proteinas: 2.7, carbohidratos: 28, grasas: 0.3, fibra: 0.4 },
  { nombre: 'Arroz integral (cocido)', keywords: ['arroz integral', 'brown rice'], calorias: 123, proteinas: 2.7, carbohidratos: 26, grasas: 1, fibra: 1.8 },
  { nombre: 'Avena (seca)', keywords: ['avena', 'oatmeal', 'oats', 'avena cocida'], calorias: 389, proteinas: 17, carbohidratos: 66, grasas: 7, fibra: 10.6, azucar: 0 },
  { nombre: 'Pan integral', keywords: ['pan integral', 'pan', 'bread', 'whole wheat bread'], calorias: 247, proteinas: 13, carbohidratos: 41, grasas: 4.2, fibra: 6 },
  { nombre: 'Pan blanco', keywords: ['pan blanco', 'white bread'], calorias: 267, proteinas: 9, carbohidratos: 51, grasas: 3.2, fibra: 2.3 },
  { nombre: 'Pasta (cocida)', keywords: ['pasta', 'espagueti', 'fideos', 'spaghetti', 'macarron'], calorias: 158, proteinas: 5.8, carbohidratos: 31, grasas: 0.9, fibra: 1.8 },
  { nombre: 'Quinoa (cocida)', keywords: ['quinoa', 'quinua'], calorias: 120, proteinas: 4.4, carbohidratos: 21, grasas: 1.9, fibra: 2.8 },
  { nombre: 'Tortilla de maíz', keywords: ['tortilla', 'tortilla maiz', 'corn tortilla'], calorias: 218, proteinas: 5.7, carbohidratos: 45, grasas: 2.9, fibra: 6.3 },

  // ── Verduras ──────────────────────────────────────────────────────────────
  { nombre: 'Brócoli (crudo)', keywords: ['brocoli', 'brócoli', 'broccoli'], calorias: 34, proteinas: 2.8, carbohidratos: 7, grasas: 0.4, fibra: 2.6 },
  { nombre: 'Espinaca (cruda)', keywords: ['espinaca', 'spinach'], calorias: 23, proteinas: 2.9, carbohidratos: 3.6, grasas: 0.4, fibra: 2.2 },
  { nombre: 'Zanahoria (cruda)', keywords: ['zanahoria', 'carrot'], calorias: 41, proteinas: 0.9, carbohidratos: 10, grasas: 0.2, fibra: 2.8 },
  { nombre: 'Papa / Patata (cocida)', keywords: ['papa', 'patata', 'potato', 'papas'], calorias: 87, proteinas: 1.9, carbohidratos: 20, grasas: 0.1, fibra: 1.8 },
  { nombre: 'Camote / Batata (cocido)', keywords: ['camote', 'batata', 'sweet potato'], calorias: 86, proteinas: 1.6, carbohidratos: 20, grasas: 0.1, fibra: 3 },
  { nombre: 'Aguacate', keywords: ['aguacate', 'palta', 'avocado'], calorias: 160, proteinas: 2, carbohidratos: 9, grasas: 15, fibra: 6.7 },
  { nombre: 'Tomate (crudo)', keywords: ['tomate', 'jitomate', 'tomato'], calorias: 18, proteinas: 0.9, carbohidratos: 3.9, grasas: 0.2, fibra: 1.2 },

  // ── Frutas ────────────────────────────────────────────────────────────────
  { nombre: 'Plátano / Banana', keywords: ['platano', 'plátano', 'banana', 'banano'], calorias: 89, proteinas: 1.1, carbohidratos: 23, grasas: 0.3, fibra: 2.6, azucar: 12 },
  { nombre: 'Manzana', keywords: ['manzana', 'apple'], calorias: 52, proteinas: 0.3, carbohidratos: 14, grasas: 0.2, fibra: 2.4, azucar: 10 },
  { nombre: 'Fresa', keywords: ['fresa', 'fresas', 'strawberry', 'strawberries'], calorias: 32, proteinas: 0.7, carbohidratos: 7.7, grasas: 0.3, fibra: 2, azucar: 4.9 },
  { nombre: 'Naranja', keywords: ['naranja', 'orange'], calorias: 47, proteinas: 0.9, carbohidratos: 12, grasas: 0.1, fibra: 2.4, azucar: 9.4 },
  { nombre: 'Mango', keywords: ['mango'], calorias: 60, proteinas: 0.8, carbohidratos: 15, grasas: 0.4, fibra: 1.6, azucar: 13.7 },

  // ── Leguminosas ───────────────────────────────────────────────────────────
  { nombre: 'Frijoles negros (cocidos)', keywords: ['frijol', 'frijoles', 'frijoles negros', 'black beans'], calorias: 132, proteinas: 8.9, carbohidratos: 24, grasas: 0.5, fibra: 8.7 },
  { nombre: 'Lentejas (cocidas)', keywords: ['lenteja', 'lentejas', 'lentils'], calorias: 116, proteinas: 9, carbohidratos: 20, grasas: 0.4, fibra: 7.9 },
  { nombre: 'Garbanzos (cocidos)', keywords: ['garbanzo', 'garbanzos', 'chickpea', 'chickpeas'], calorias: 164, proteinas: 8.9, carbohidratos: 27, grasas: 2.6, fibra: 7.6 },
  { nombre: 'Tofu', keywords: ['tofu'], calorias: 76, proteinas: 8, carbohidratos: 1.9, grasas: 4.8 },

  // ── Nueces y semillas ──────────────────────────────────────────────────────
  { nombre: 'Almendras', keywords: ['almendra', 'almendras', 'almond', 'almonds'], calorias: 579, proteinas: 21, carbohidratos: 22, grasas: 50, fibra: 12.5 },
  { nombre: 'Mantequilla de maní', keywords: ['mantequilla mani', 'mantequilla de mani', 'mantequilla cacahuate', 'peanut butter'], calorias: 588, proteinas: 25, carbohidratos: 20, grasas: 50, fibra: 6 },
  { nombre: 'Maní / Cacahuate', keywords: ['mani', 'maní', 'cacahuate', 'peanut', 'peanuts'], calorias: 567, proteinas: 26, carbohidratos: 16, grasas: 49, fibra: 8.5 },
  { nombre: 'Semillas de chía', keywords: ['chia', 'chía', 'chia seeds'], calorias: 486, proteinas: 17, carbohidratos: 42, grasas: 31, fibra: 34 },

  // ── Aceites ───────────────────────────────────────────────────────────────
  { nombre: 'Aceite de oliva', keywords: ['aceite oliva', 'aceite de oliva', 'olive oil'], calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100 },
  { nombre: 'Aceite de coco', keywords: ['aceite coco', 'aceite de coco', 'coconut oil'], calorias: 862, proteinas: 0, carbohidratos: 0, grasas: 100 },

  // ── Proteína en polvo ─────────────────────────────────────────────────────
  { nombre: 'Proteína whey (suero)', keywords: ['proteina', 'proteína', 'whey', 'suero', 'protein powder'], calorias: 400, proteinas: 80, carbohidratos: 8, grasas: 7 },
];

const EDGE_FUNCTION_UPSERT_GLOBAL = 'foods-upsert-global';
const USDA_API_SOURCE = 'usda_fdc';

/**
 * Filas del seed genérico (`foods_seed.sql`): `api_source = 'generic'`.
 * Primeros slots de la lista de búsqueda.
 */
const GENERIC_DB_API_SOURCE = 'generic';

const BUSQUEDA_SLOT_GENERICOS_BD = 5;
const BUSQUEDA_SLOT_USDA = 5;
const BUSQUEDA_SLOT_OFF = 10;

/** Máximo de filas devueltas (tramos generic+USDA+OFF + personalizados). */
const MAX_RESULTADOS_BUSQUEDA = 24;

/**
 * Si es false, el diccionario ALIMENTOS_BASICOS no entra en la búsqueda (no upsert en esa ruta).
 * Sigue disponible al registrar un alimento builtin desde el diario vía `asegurarFoodParaLog`.
 * Para quitar filas `builtin` en BD: `supabase/delete_builtin_foods.sql`.
 */
const INCLUIR_BASICOS_EN_BUSQUEDA = false;

/** Logs visibles en Metro/Expo (`npx expo run:android`); las Edge Functions loguean solo en el dashboard de Supabase. */
function dbgAlimentos(...args: unknown[]): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[Activa/alimentos]', ...args);
  }
}

// Caché de traducciones en sesión — evita llamar a LibreTranslate/MyMemory
// repetidamente para los mismos términos dentro de la misma sesión.
const _traduccionCache = new Map<string, string>();

type PayloadUpsertGlobal = {
  nombre: string;
  api_source: 'builtin' | 'fatsecret' | 'openfoodfacts' | 'usda_fdc';
  api_id: string;
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  fibra: number | null;
  azucar: number | null;
  food_tier?: FoodTier | null;
  source_kind?: FoodSourceKind | null;
  verified_basic?: boolean | null;
};

async function logEdgeFunctionError(name: string, err: unknown): Promise<void> {
  if (err instanceof FunctionsHttpError && err.context instanceof Response) {
    const res = err.context;
    let body = '';
    try {
      body = (await res.clone().text()).slice(0, 600);
    } catch {
      body = '';
    }
    console.warn(`[alimentos] ${name} HTTP ${res.status}`, body || err.message);
    return;
  }
  console.warn(`[alimentos] ${name}:`, err instanceof Error ? err.message : String(err));
}

async function refreshSessionIfNeeded(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.expires_at) return;
  const expMs = session.expires_at * 1000;
  if (expMs < Date.now() + 120_000) {
    await supabase.auth.refreshSession();
  }
}

/**
 * Insert/update filas globales vía Edge Function (service_role). Necesario con RLS modelo B.
 */
async function upsertGlobalFoodsViaEdge(
  items: PayloadUpsertGlobal[],
): Promise<(Food | null)[]> {
  if (items.length === 0) return [];
  await refreshSessionIfNeeded();
  const { data, error } = await supabase.functions.invoke<{
    results: (Food | null)[];
  }>(EDGE_FUNCTION_UPSERT_GLOBAL, {
    body: { items },
    timeout: 55_000,
  });
  if (error) {
    await logEdgeFunctionError('foods-upsert-global', error);
    return items.map(() => null);
  }
  const results = data?.results;
  if (!Array.isArray(results) || results.length !== items.length) {
    return items.map(() => null);
  }
  return results;
}

function aplicarIlikeNombreAndFoods(q: any, palabras: string[]): any {
  let out = q;
  for (const w of palabras) {
    const s = sanitizarFragmentoIlike(w);
    if (!s) continue;
    out = out.ilike('nombre', `%${s}%`);
  }
  return out;
}

/**
 * Búsqueda por nombre en `foods`: palabras (AND) + tildes vía filtro en cliente.
 * `aplicarPrefiltro` recibe la query base (`select('*')`) ya encadenada con eq/is/order si aplica.
 */
async function buscarFoodsPorTextoLibre(
  texto: string,
  limite: number,
  aplicarPrefiltro: (q: any) => any,
): Promise<Food[]> {
  const term = texto.trim();
  if (!term) return [];

  const palabrasNorm = palabrasBusqueda(normalizarTexto(term))
    .map(sanitizarFragmentoIlike)
    .filter((w) => w.length > 0);
  const palabrasSplit = palabrasBusqueda(term);
  const palabrasRaw = palabrasSplit.map(sanitizarFragmentoIlike).filter((w) => w.length > 0);

  if (palabrasNorm.length === 0) {
    const { data, error } = await aplicarPrefiltro(supabase.from('foods').select('*'))
      .ilike('nombre', `%${sanitizarFragmentoIlike(term)}%`)
      .limit(limite);
    if (error) throw error;
    return (data ?? []) as Food[];
  }

  const busquedaRawEquivNorm =
    palabrasRaw.length === palabrasNorm.length &&
    palabrasRaw.every(
      (_, i) => sanitizarFragmentoIlike(normalizarTexto(palabrasSplit[i] ?? '')) === palabrasNorm[i],
    );

  const ancla = elegirAnclajeBusqueda(palabrasNorm);
  const anclaSafe = ancla ? sanitizarFragmentoIlike(ancla) : '';
  const limiteAncla = Math.min(Math.max(limite * 8, 120), 800);

  const ejecutar = async (words: string[], maxRows: number) => {
    let qq = aplicarPrefiltro(supabase.from('foods').select('*'));
    qq = aplicarIlikeNombreAndFoods(qq, words);
    const { data, error } = await qq.limit(maxRows);
    if (error) throw error;
    return (data ?? []) as Food[];
  };

  const [rNorm, rRaw, rAncla] = await Promise.all([
    ejecutar(palabrasNorm, limite),
    !busquedaRawEquivNorm && palabrasRaw.length > 0 ? ejecutar(palabrasRaw, limite) : Promise.resolve([] as Food[]),
    anclaSafe ? ejecutar([anclaSafe], limiteAncla) : Promise.resolve([] as Food[]),
  ]);

  const porId = new Map<string, Food>();
  for (const f of [...rNorm, ...rRaw, ...rAncla]) {
    porId.set(f.id, f);
  }

  const merged = [...porId.values()].filter((f) => nombreContieneTodasLasPalabras(f.nombre, palabrasNorm));
  return merged.slice(0, limite);
}

/** Contexto de puntuación compartido entre tramos (generic / USDA / OFF / custom). */
type SearchScoreCtx = {
  queryVariants: string[];
  queryTokens: string[];
  singleTokenQuery: boolean;
  apiOrderByKey: Map<string, number>;
  popularidad: Map<string, number>;
};

// ---------------------------------------------------------------------------

export const alimentosService = {
  /**
   * Suma un uso al alimento al registrarlo en el diario (popularidad en ranking).
   * Ignora errores si la migración o RPC aún no existen.
   */
  async registrarSeleccionPopularity(foodId: string): Promise<void> {
    if (!esUuidPostgres(foodId)) return;
    try {
      await supabase.rpc('increment_food_popularity', { p_food_id: foodId });
    } catch {
      /* noop */
    }
  },

  async obtenerAlimentosPorIds(ids: string[]): Promise<Food[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .in('id', ids);
    if (error) throw error;
    return (data ?? []) as Food[];
  },

  async obtenerAlimentosCreados(userId: string, query = ''): Promise<Food[]> {
    if (!query.trim()) {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('created_by', userId)
        .eq('is_custom', true)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Food[];
    }

    return buscarFoodsPorTextoLibre(query, 30, (q) =>
      q.eq('created_by', userId).eq('is_custom', true).order('created_at', { ascending: false }),
    );
  },

  /**
   * Favoritos en BD (tabla user_favorite_foods). Si la tabla no existe o RLS falla, devuelve [].
   */
  async obtenerFavoritosUsuario(userId: string): Promise<Food[]> {
    const { data, error } = await supabase
      .from('user_favorite_foods')
      .select('food_id, foods (*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data ?? [])
      .map((row) => {
        const f = row.foods as Food | Food[] | null | undefined;
        const food = Array.isArray(f) ? f[0] : f;
        return food ?? null;
      })
      .filter(Boolean) as Food[];
  },

  /**
   * Marca o desmarca favorito. Devuelve false si la tabla no está disponible (usar fallback local).
   */
  async setFavoritoUsuario(
    userId: string,
    foodId: string,
    activo: boolean,
  ): Promise<boolean> {
    if (!esUuidPostgres(foodId)) return false;

    if (activo) {
      const { error } = await supabase.from('user_favorite_foods').upsert(
        { user_id: userId, food_id: foodId },
        { onConflict: 'user_id,food_id', ignoreDuplicates: true },
      );
      return !error;
    }
    const { error } = await supabase
      .from('user_favorite_foods')
      .delete()
      .eq('user_id', userId)
      .eq('food_id', foodId);
    return !error;
  },

  async obtenerRecientes(userId: string): Promise<Food[]> {
    const { data, error } = await supabase
      .from('nutrition_log_items')
      .select(`
        id,
        meal_id,
        foods (*),
        nutrition_log_meals!inner (
          id,
          nutrition_logs!inner (user_id, fecha)
        )
      `)
      .eq('nutrition_log_meals.nutrition_logs.user_id', userId)
      .order('id', { ascending: false })
      .limit(80);

    if (error) throw error;

    const seen = new Set<string>();
    const recentFoods: Food[] = [];

    for (const row of data ?? []) {
      const food = (row as any).foods as Food | null;
      if (!food || seen.has(food.id)) continue;
      seen.add(food.id);
      recentFoods.push(food);
      if (recentFoods.length >= 20) break;
    }
    return recentFoods;
  },

  /**
   * Busca alimentos por nombre.
   * 1. Opcional: ALIMENTOS_BASICOS — comparten el tramo de genéricos BD.
   * 2. Hasta 5: `foods` con api_source `generic` (semilla local).
   * 3. 5: USDA Foundation; 10: Open Food Facts (ES). Siempre se consultan las APIs.
   * 4. Tras el bloque 20: personalizados del usuario hasta el máximo.
   */
  async buscarAlimento(query: string, userId?: string | null): Promise<Food[]> {
    const term = query.trim();
    if (!term) return [];

    const termLimpio = limpiarRuidoBusqueda(term) || term;
    const normalizedQuery = normalizeText(termLimpio);
    const queryVariants = variantesNombreParaScoring(normalizedQuery, termLimpio);
    const queryTokens = tokensForMatchingExpanded(normalizedQuery, termLimpio);
    const nTerm = normalizeText(termLimpio);
    const singleTokenQuery = nTerm.length > 0 && !nTerm.includes(' ');

    let basicFoods: Food[] = [];
    if (INCLUIR_BASICOS_EN_BUSQUEDA) {
      const basicMatches = buscarEnBasicos(
        normalizedQuery,
        queryTokens,
        queryVariants,
      );
      basicFoods = await this._upsertBasicos(basicMatches);
    }

    // Lanzar en paralelo: BD genérica, BD personalizada, traducción ES→EN y OFF.
    // OFF no depende de la traducción (usa término ES directamente).
    // USDA sí depende de qEn, por eso arranca después.
    const [genericBd, personalizados, qEn, offPartials] = await Promise.all([
      buscarFoodsPorTextoLibre(termLimpio, 80, (q) =>
        q.eq('api_source', GENERIC_DB_API_SOURCE).eq('is_custom', false).is('created_by', null),
      ).catch((): Food[] => []),
      userId
        ? buscarFoodsPorTextoLibre(termLimpio, 12, (q) =>
            q.eq('is_custom', true).eq('created_by', userId),
          ).catch((): Food[] => [])
        : Promise.resolve([] as Food[]),
      terminoInglesParaUsda(termLimpio),
      this._buscarOpenFoodFacts(termLimpio, BUSQUEDA_SLOT_OFF).catch(
        (): Partial<Food>[] => [],
      ),
    ]);

    dbgAlimentos('USDA query EN', qEn);

    // USDA arranca una vez que tenemos la traducción
    let usdaPartials: Partial<Food>[] = [];
    try {
      usdaPartials = await this._buscarUsdaFoundation(qEn, BUSQUEDA_SLOT_USDA);
    } catch (e) {
      dbgAlimentos('USDA excepción', e);
    }

    dbgAlimentos('USDA Foundation candidatos', usdaPartials.length);
    dbgAlimentos('OpenFoodFacts (ES) candidatos', offPartials.length);

    const apiCandidates = [...usdaPartials, ...offPartials];
    const apiOrderByKey = new Map<string, number>();
    let apiOrderIdx = 0;
    for (const c of apiCandidates) {
      if (!c.api_source || c.api_id == null || String(c.api_id).length === 0) continue;
      const key = `${c.api_source}:${c.api_id}`;
      if (!apiOrderByKey.has(key)) apiOrderByKey.set(key, apiOrderIdx++);
    }

    let cachedApiFoods: Food[] = [];
    if (apiCandidates.length > 0) {
      try {
        cachedApiFoods = await this._guardarEnCache(apiCandidates);
      } catch (e) {
        dbgAlimentos('_guardarEnCache error', e);
        cachedApiFoods = [];
      }
      if (cachedApiFoods.length === 0) {
        cachedApiFoods = await this._cargarDesdeCachePorCandidatos(apiCandidates);
        dbgAlimentos(
          'relectura cache por candidatos',
          cachedApiFoods.length,
          'de',
          apiCandidates.length,
        );
      }
    }

    const usdaCached = cachedApiFoods.filter((f) => f.api_source === USDA_API_SOURCE);
    const offCached = cachedApiFoods.filter(
      (f) => f.api_source === FOOD_API_SOURCE || f.api_source === 'openfoodfacts',
    );

    dbgAlimentos('buscar', {
      term: termLimpio,
      basicos: basicFoods.length,
      genericosBd: genericBd.length,
      usdaCached: usdaCached.length,
      offCached: offCached.length,
    });

    const genericPool = [...basicFoods, ...genericBd];

    const popularityIds = [
      ...genericPool.map((x) => x.id),
      ...cachedApiFoods.map((x) => x.id),
      ...personalizados.map((x) => x.id),
    ].filter(esUuidPostgres);
    const popularidad = await cargarPopularidadPorIds(popularityIds);

    const scoreCtx: SearchScoreCtx = {
      queryVariants,
      queryTokens,
      singleTokenQuery,
      apiOrderByKey,
      popularidad,
    };

    const rankedGeneric = rankFoodsForBucket(genericPool, scoreCtx);
    const rankedUsda = rankFoodsForBucket(usdaCached, scoreCtx);
    const rankedOff = rankFoodsForBucket(offCached, scoreCtx);
    const rankedPers = rankFoodsForBucket(personalizados, scoreCtx);

    const seenKeys = new Set<string>();
    const seenNames = new Set<string>();
    const merged: Food[] = [];

    pickSearchSlots(rankedGeneric, BUSQUEDA_SLOT_GENERICOS_BD, merged, seenKeys, seenNames);
    pickSearchSlots(rankedUsda, BUSQUEDA_SLOT_USDA, merged, seenKeys, seenNames);
    pickSearchSlots(rankedOff, BUSQUEDA_SLOT_OFF, merged, seenKeys, seenNames);
    pickSearchSlots(
      rankedPers,
      Math.max(0, MAX_RESULTADOS_BUSQUEDA - merged.length),
      merged,
      seenKeys,
      seenNames,
    );

    dbgAlimentos('resultado', { total: merged.length });
    return merged;
  },

  /**
   * Devuelve un Food con id UUID válido para `nutrition_log_items.food_id`.
   */
  async asegurarFoodParaLog(food: Food): Promise<Food> {
    if (esUuidPostgres(food.id)) return food;

    const src = food.api_source ?? null;
    const extId = food.api_id ?? null;

    if (src && extId) {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('api_source', src)
        .eq('api_id', extId)
        .maybeSingle();
      if (!error && data) return data as Food;
    }

    if (
      (src === FATSECRET_API_SOURCE ||
        src === FOOD_API_SOURCE ||
        src === USDA_API_SOURCE) &&
      extId &&
      food.nombre
    ) {
      const apiSrc =
        src === FATSECRET_API_SOURCE
          ? 'fatsecret'
          : src === USDA_API_SOURCE
            ? 'usda_fdc'
            : ('openfoodfacts' as const);
      const [saved] = await upsertGlobalFoodsViaEdge([
        {
          nombre: food.nombre,
          api_source: apiSrc,
          api_id: extId,
          calorias: Number(food.calorias ?? 0),
          proteinas: Number(food.proteinas ?? 0),
          carbohidratos: Number(food.carbohidratos ?? 0),
          grasas: Number(food.grasas ?? 0),
          fibra: food.fibra ?? null,
          azucar: food.azucar ?? null,
          food_tier: food.food_tier ?? inferTierFromPartial(food),
          source_kind: food.source_kind ?? inferSourceKindFromPartial(food),
          verified_basic: food.verified_basic ?? false,
        },
      ]);
      if (saved && esUuidPostgres(String(saved.id))) return saved as Food;
    }

    if (src === 'builtin' && extId) {
      const basico = ALIMENTOS_BASICOS.find((b) => slugify(b.nombre) === extId);
      if (basico) {
        const [row] = await this._upsertBasicos([basico]);
        if (row && esUuidPostgres(row.id)) return row;
      }
    }

    throw new Error(
      'No se pudo guardar el alimento en la base de datos. Revisa conexión y políticas RLS en foods.',
    );
  },

  /**
   * Obtiene un alimento por su ID.
   */
  async obtenerAlimento(id: string): Promise<Food | null> {
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as Food | null) ?? null;
  },

  /**
   * Crea un alimento personalizado del usuario.
   */
  async crearAlimentoPersonalizado(
    userId: string,
    datos: Omit<Food, 'id' | 'api_source' | 'api_id' | 'is_custom' | 'created_by' | 'created_at'>
  ) {
    const { data, error } = await supabase
      .from('foods')
      .insert({
        ...datos,
        api_source: null,
        api_id: null,
        is_custom: true,
        created_by: userId,
        food_tier: 'reference',
        source_kind: 'custom',
        verified_basic: false,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as Food;
  },

  /**
   * Guarda (upsert) los alimentos básicos en Supabase para tener IDs reales.
   * Usa api_source='builtin' y api_id=slug generado del nombre.
   */
  async _upsertBasicos(basicos: AlimentoBasico[]): Promise<Food[]> {
    if (basicos.length === 0) return [];

    const apiIds = basicos.map((b) => slugify(b.nombre));
    const byApiId = new Map<string, Food>();

    try {
      const { data: existingRows } = await supabase
        .from('foods')
        .select('*')
        .eq('api_source', 'builtin')
        .in('api_id', apiIds);
      for (const row of existingRows ?? []) {
        if (row.api_id) byApiId.set(row.api_id, row as Food);
      }
    } catch {
      /* seguimos; intentaremos crear vía Edge */
    }

    const missing = basicos.filter((b) => !byApiId.has(slugify(b.nombre)));
    if (missing.length > 0) {
      const items: PayloadUpsertGlobal[] = missing.map((b) => ({
        nombre: b.nombre,
        api_source: 'builtin',
        api_id: slugify(b.nombre),
        calorias: b.calorias,
        proteinas: b.proteinas,
        carbohidratos: b.carbohidratos,
        grasas: b.grasas,
        fibra: b.fibra ?? null,
        azucar: b.azucar ?? null,
        food_tier: 'master',
        source_kind: 'builtin',
        verified_basic: true,
      }));
      const upserted = await upsertGlobalFoodsViaEdge(items);
      for (let i = 0; i < missing.length; i++) {
        const row = upserted[i];
        const apiId = slugify(missing[i].nombre);
        if (row && esUuidPostgres(String(row.id))) {
          byApiId.set(apiId, row as Food);
        } else {
          byApiId.set(apiId, {
            id: `builtin_${apiId}`,
            nombre: missing[i].nombre,
            api_source: 'builtin',
            api_id: apiId,
            calorias: missing[i].calorias,
            proteinas: missing[i].proteinas,
            carbohidratos: missing[i].carbohidratos,
            grasas: missing[i].grasas,
            fibra: missing[i].fibra ?? null,
            azucar: missing[i].azucar ?? null,
            is_custom: false,
            created_by: null,
            created_at: new Date().toISOString(),
            food_tier: 'master',
            source_kind: 'builtin',
            verified_basic: true,
          });
        }
      }
    }

    return basicos.map((b) => {
      const apiId = slugify(b.nombre);
      const f = byApiId.get(apiId);
      if (f) return f;
      return {
        id: `builtin_${apiId}`,
        nombre: b.nombre,
        api_source: 'builtin',
        api_id: apiId,
        calorias: b.calorias,
        proteinas: b.proteinas,
        carbohidratos: b.carbohidratos,
        grasas: b.grasas,
        fibra: b.fibra ?? null,
        azucar: b.azucar ?? null,
        is_custom: false,
        created_by: null,
        created_at: new Date().toISOString(),
        food_tier: 'master',
        source_kind: 'builtin',
        verified_basic: true,
      };
    });
  },

  async _cargarDesdeCachePorCandidatos(
    candidatos: Partial<Food>[],
  ): Promise<Food[]> {
    const bySrc = new Map<string, Set<string>>();
    for (const c of candidatos) {
      const src = c.api_source;
      const id = c.api_id;
      if (!src || !id) continue;
      if (!bySrc.has(src)) bySrc.set(src, new Set());
      bySrc.get(src)!.add(id);
    }
    const out: Food[] = [];
    for (const [src, ids] of bySrc) {
      const list = [...ids];
      for (let i = 0; i < list.length; i += 25) {
        const chunk = list.slice(i, i + 25);
        const { data } = await supabase
          .from('foods')
          .select('*')
          .eq('api_source', src)
          .in('api_id', chunk);
        out.push(...((data ?? []) as Food[]));
      }
    }
    return out;
  },

  async _buscarUsdaFoundation(
    queryEn: string,
    maxResults = BUSQUEDA_SLOT_USDA,
  ): Promise<Partial<Food>[]> {
    const key = USDA_FDC_API_KEY.trim();
    if (!key) {
      dbgAlimentos('USDA omitido: falta EXPO_PUBLIC_USDA_FDC_API_KEY');
      return [];
    }
    const q = queryEn.trim().slice(0, 200);
    if (q.replace(/\s/g, '').length < 2) return [];

    const n = Math.min(50, Math.max(1, maxResults));
    const url =
      'https://api.nal.usda.gov/fdc/v1/foods/search?' +
      new URLSearchParams({
        api_key: key,
        query: q,
        dataType: 'Foundation',
        pageSize: String(n),
      }).toString();

    const res = await fetch(url);
    if (!res.ok) {
      dbgAlimentos('USDA search HTTP', res.status);
      return [];
    }

    const data = (await res.json()) as { foods?: unknown[] };
    const foods = Array.isArray(data.foods) ? data.foods : [];
    type Raw = {
      fdcId?: number;
      description?: string;
      foodNutrients?: unknown[];
    };
    const rows: Raw[] = foods
      .map((f) => f as Raw)
      .filter((x) => typeof x.fdcId === 'number');

    const enriched = await Promise.all(
      rows.map(async (row) => {
        let nutrientRows: unknown[] | undefined = Array.isArray(row.foodNutrients)
          ? row.foodNutrients
          : undefined;
        let macros = macrosFromFdcNutrientRows(nutrientRows);
        const sinDatosUtiles =
          macros.calorias <= 0 &&
          macros.proteinas <= 0 &&
          macros.carbohidratos <= 0 &&
          macros.grasas <= 0;
        if ((macros.calorias <= 0 || sinDatosUtiles) && row.fdcId != null) {
          const detail = await fetchFdcFoodNutrientRows(row.fdcId, key);
          if (detail?.length) {
            nutrientRows = detail;
            macros = macrosFromFdcNutrientRows(detail);
          }
        }
        return { row, macros };
      }),
    );

    const descEn = enriched.map((e) => {
      const d = String(e.row.description ?? '').trim();
      return d.length > 0 ? d : `FDC ${e.row.fdcId}`;
    });
    const descEs = await traducirListaEnAEs(descEn);

    const out: Partial<Food>[] = [];
    for (let i = 0; i < enriched.length; i++) {
      const { row, macros } = enriched[i];
      const fdcId = row.fdcId as number;
      out.push({
        nombre: descEs[i] ?? descEn[i],
        api_source: USDA_API_SOURCE,
        api_id: String(fdcId),
        calorias: macros.calorias,
        proteinas: macros.proteinas,
        carbohidratos: macros.carbohidratos,
        grasas: macros.grasas,
        fibra: macros.fibra,
        azucar: macros.azucar,
        is_custom: false,
        created_by: null,
        food_tier: 'reference',
        source_kind: 'usda_foundation',
        verified_basic: false,
      });
    }
    return out;
  },

  /**
   * Open Food Facts — solo productos con país España (tag en search.pl o filtro en v2).
   */
  async _buscarOpenFoodFacts(
    query: string,
    pageSize = 10,
  ): Promise<Partial<Food>[]> {
    const t = query.trim();
    if (!t) return [];
    const termLimpio = limpiarRuidoBusqueda(t) || t;
    const expr = termLimpio.slice(0, 200);
    const qEnc = encodeURIComponent(expr);
    const ps = Math.min(24, Math.max(1, pageSize));
    const fields = 'code,product_name,product_name_es,nutriments';

    const urlPl =
      `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${qEnc}` +
      `&search_simple=1&action=process&json=1&page_size=${ps}` +
      `&tagtype_0=countries&tag_contains_0=contains&tag_0=Spain` +
      `&fields=${fields}`;

    const normalizedQuery = normalizeText(termLimpio);
    const matchTokens = tokensForMatching(normalizedQuery);
    if (matchTokens.length === 0) return [];

    let products = await fetchOffSearchPlProducts(urlPl);
    products = products.filter((p) =>
      offNombreIncluyeAlgunToken(p as Record<string, unknown>, matchTokens),
    );
    if (products.length === 0) {
      dbgAlimentos(
        'OFF: sin search.pl o sin nombre acorde; v2 España + token en nombre',
      );
      products = await fetchOffV2EspanaConTextoEnNombre(expr, ps, matchTokens);
    }

    const queryTokens = tokensForMatchingExpanded(normalizedQuery, termLimpio);

    const mapped: (Partial<Food> & { _score?: number })[] = [];

    const pushProduct = (p: Record<string, unknown>): void => {
      const nombreEs = String(p?.product_name_es ?? '').trim();
      const nombre = (nombreEs || String(p?.product_name ?? '')).trim();
      const code = p?.code != null ? String(p.code) : '';
      if (!nombre || !code) return;

      const nName = normalizeText(nombre);
      if (!offNombreIncluyeAlgunToken(p, matchTokens)) return;

      const nm = (p.nutriments ?? {}) as Record<string, unknown>;
      const kcal = kcalDesdeNutriments(nm);
      if (kcal <= 0) return;

      const score = scoreResult(nName, normalizedQuery, queryTokens);
      mapped.push({
        nombre,
        api_source: FOOD_API_SOURCE,
        api_id: code,
        calorias: sanitizeNumber(kcal),
        proteinas: sanitizeNumber(nm.proteins_100g ?? 0),
        carbohidratos: sanitizeNumber(nm.carbohydrates_100g ?? 0),
        grasas: sanitizeNumber(nm.fat_100g ?? 0),
        fibra: nullableNumber(nm.fiber_100g),
        azucar: nullableNumber(nm.sugars_100g),
        is_custom: false,
        created_by: null,
        food_tier: 'brand',
        source_kind: 'openfoodfacts',
        verified_basic: false,
        _score: score,
      });
    };

    for (const p of products) {
      pushProduct(p as Record<string, unknown>);
    }

    mapped.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
    return mapped.slice(0, pageSize).map(({ _score, ...rest }) => rest);
  },

  /**
   * Open Food Facts por código de barras → fila en caché global (`foods-upsert-global`).
   */
  async resolverProductoPorCodigoBarras(codigo: string): Promise<Food | null> {
    const clean = String(codigo ?? '').replace(/\D/g, '');
    if (clean.length < 8 || clean.length > 14) return null;
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(clean)}.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const j = (await res.json()) as {
        status?: number;
        product?: Record<string, unknown>;
      };
      if (j.status !== 1 || !j.product) return null;
      const p = j.product;
      const nombreEs = String(p.product_name_es ?? '').trim();
      const nombre = (nombreEs || String(p.product_name ?? '')).trim();
      const code = p.code != null ? String(p.code) : clean;
      if (!nombre) return null;
      const nm = (p.nutriments ?? {}) as Record<string, unknown>;
      const kcal = kcalDesdeNutriments(nm);
      if (kcal <= 0) return null;
      const partial: Partial<Food> = {
        nombre,
        api_source: FOOD_API_SOURCE,
        api_id: code,
        calorias: sanitizeNumber(kcal),
        proteinas: sanitizeNumber(nm.proteins_100g ?? 0),
        carbohidratos: sanitizeNumber(nm.carbohydrates_100g ?? 0),
        grasas: sanitizeNumber(nm.fat_100g ?? 0),
        fibra: nullableNumber(nm.fiber_100g),
        azucar: nullableNumber(nm.sugars_100g),
        is_custom: false,
        created_by: null,
        food_tier: 'brand',
        source_kind: 'openfoodfacts',
        verified_basic: false,
      };
      const saved = await this._guardarEnCache([partial]);
      return saved[0] ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Upsert en `foods` vía Edge (dedupe por api_source + api_id).
   */
  async _guardarEnCache(alimentos: Partial<Food>[]) {
    if (alimentos.length === 0) return [];

    const allowed = new Set([
      'builtin',
      FATSECRET_API_SOURCE,
      FOOD_API_SOURCE,
      'usda_fdc',
    ]);

    const payload = alimentos.filter(
      (a) =>
        !!a.api_id &&
        !!a.nombre &&
        a.api_source &&
        allowed.has(String(a.api_source)),
    );
    if (payload.length === 0) return [];

    const items: PayloadUpsertGlobal[] = payload.map((item) => {
      const meta = {
        food_tier: item.food_tier ?? inferTierFromPartial(item),
        source_kind: item.source_kind ?? inferSourceKindFromPartial(item),
        verified_basic: item.verified_basic ?? false,
      };
      const src = String(item.api_source);
      let apiSource: PayloadUpsertGlobal['api_source'];
      if (src === 'builtin') apiSource = 'builtin';
      else if (src === FATSECRET_API_SOURCE) apiSource = 'fatsecret';
      else if (src === FOOD_API_SOURCE || src === 'openfoodfacts') {
        apiSource = 'openfoodfacts';
      } else apiSource = 'usda_fdc';

      return {
        nombre: item.nombre!,
        api_source: apiSource,
        api_id: item.api_id!,
        calorias: item.calorias ?? 0,
        proteinas: item.proteinas ?? 0,
        carbohidratos: item.carbohidratos ?? 0,
        grasas: item.grasas ?? 0,
        fibra: item.fibra ?? null,
        azucar: item.azucar ?? null,
        ...meta,
      };
    });

    const results = await upsertGlobalFoodsViaEdge(items);
    const guardados: Food[] = [];
    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      if (row) guardados.push(row as Food);
    }
    return guardados;
  },
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** UUID v4 (acepta variantes 1–8 que Postgres suele generar). */
function esUuidPostgres(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

function dedupKeyFood(item: Pick<Food, 'id' | 'api_source' | 'api_id'>): string {
  if (item.api_source && item.api_id) {
    return `${item.api_source}:${item.api_id}`;
  }
  if (esUuidPostgres(item.id)) {
    return `id:${item.id}`;
  }
  if (item.id?.startsWith('builtin_') && item.api_id) {
    return `builtin:${item.api_id}`;
  }
  return `row:${item.id}`;
}

/**
 * Busca en el diccionario ALIMENTOS_BASICOS usando el query normalizado.
 * Devuelve los básicos que coincidan, ordenados por score.
 */
function buscarEnBasicos(
  normalizedQuery: string,
  queryTokens: string[],
  queryVariants: string[],
): AlimentoBasico[] {
  const scored = ALIMENTOS_BASICOS.map((a) => {
    const normalizedName = normalizeText(a.nombre);
    const keywordsText = a.keywords.map(normalizeText).join(' ');

    let score = 0;
    for (const v of queryVariants) {
      if (a.keywords.some((k) => normalizeText(k) === v)) score = Math.max(score, 150);
      if (a.keywords.some((k) => normalizeText(k).startsWith(v))) score = Math.max(score, 80);
      if (a.keywords.some((k) => normalizeText(k).includes(v))) score = Math.max(score, 50);
    }
    for (const t of queryTokens) {
      if (keywordsText.includes(t)) score += 30;
    }
    let nameScore = 0;
    for (const v of queryVariants) {
      nameScore = Math.max(nameScore, scoreResult(normalizedName, v, queryTokens));
    }
    score += nameScore;

    return { alimento: a, score };
  }).filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map((x) => x.alimento);
}

/**
 * Genera un slug simple para usar como api_id de alimentos builtin.
 */
function slugify(text: string): string {
  return normalizeText(text).replace(/\s+/g, '_').slice(0, 80);
}

/**
 * Traduce términos comunes del español al inglés para búsquedas en USDA.
 */
function traducirAlIngles(query: string): string {
  const map: Record<string, string> = {
    pollo: 'chicken', arroz: 'rice', huevo: 'egg', leche: 'milk',
    carne: 'beef', res: 'beef', cerdo: 'pork', pavo: 'turkey',
    salmon: 'salmon', atun: 'tuna', camarones: 'shrimp', camaron: 'shrimp',
    tilapia: 'tilapia', avena: 'oatmeal', pan: 'bread', pasta: 'pasta',
    quinoa: 'quinoa', brocoli: 'broccoli', espinaca: 'spinach',
    zanahoria: 'carrot', papa: 'potato', camote: 'sweet potato',
    aguacate: 'avocado', palta: 'avocado', platano: 'banana', banano: 'banana',
    manzana: 'apple', fresa: 'strawberry', naranja: 'orange', mango: 'mango',
    limon: 'lemon', lima: 'lime',
    frijoles: 'beans', lentejas: 'lentils', garbanzos: 'chickpeas',
    tofu: 'tofu', almendras: 'almonds', mani: 'peanut', cacahuate: 'peanut',
    proteina: 'protein powder', yogur: 'yogurt', yogurt: 'yogurt',
    queso: 'cheese', mantequilla: 'butter', aceite: 'oil',
    'pechuga de pollo': 'chicken breast', 'muslo de pollo': 'chicken thigh',
    'carne molida': 'ground beef', 'arroz integral': 'brown rice',
    'pan integral': 'whole wheat bread', 'leche descremada': 'skim milk',
  };
  const normalized = normalizeText(query);
  if (map[normalized]) return map[normalized];
  for (const [es, en] of Object.entries(map)) {
    if (normalized.startsWith(es)) return en;
  }
  return query;
}

async function terminoInglesParaUsda(termEs: string): Promise<string> {
  const t = termEs.trim().slice(0, 200);
  if (!t) return '';

  // 1. Diccionario local (instantáneo, sin red)
  const dictResult = traducirAlIngles(t);
  if (dictResult !== t) return dictResult.trim().slice(0, 200);

  // 2. Caché de sesión (evita llamada HTTP repetida para el mismo término)
  const cacheKey = `es>en:${t.toLowerCase()}`;
  const cached = _traduccionCache.get(cacheKey);
  if (cached) return cached;

  // 3. LibreTranslate / MyMemory como fallback de red
  const lt = await libreTranslate(t, 'es', 'en');
  if (lt && lt.length > 0) {
    const result = lt.slice(0, 200);
    _traduccionCache.set(cacheKey, result);
    return result;
  }

  return t.slice(0, 200);
}

async function traducirListaEnAEs(textos: string[]): Promise<string[]> {
  if (textos.length === 0) return [];

  // Traducir todas las que no estén ya en caché, en paralelo (sin delay artificial)
  const resultado = await Promise.all(
    textos.map(async (s) => {
      const cacheKey = `en>es:${s.toLowerCase().slice(0, 100)}`;
      const cached = _traduccionCache.get(cacheKey);
      if (cached) return cached;
      const x = await libreTranslate(s, 'en', 'es');
      const out = x && x.length > 0 ? x : s;
      _traduccionCache.set(cacheKey, out);
      return out;
    }),
  );

  return resultado;
}

/**
 * Inglés → forma ES normalizada (sin acentos) para puntuar nombres en español
 * cuando el usuario escribe en inglés.
 */
function traducirAEspanolDesdeIngles(normalizedQuery: string): string {
  const inv: Record<string, string> = {
    lemon: 'limon',
    lime: 'lima',
    orange: 'naranja',
    apple: 'manzana',
    strawberry: 'fresa',
    banana: 'platano',
    chicken: 'pollo',
    rice: 'arroz',
    egg: 'huevo',
    milk: 'leche',
  };
  return inv[normalizedQuery] ?? '';
}

/** Variantes del término para igualdad / palabra completa (ES↔EN). */
function variantesNombreParaScoring(normalizedQuery: string, termLimpio: string): string[] {
  const set = new Set<string>();
  const add = (s: string) => {
    const x = normalizeText(s);
    if (x.length >= 2) set.add(x);
  };
  add(termLimpio);
  add(normalizedQuery);
  add(traducirAlIngles(termLimpio));
  const back = traducirAEspanolDesdeIngles(normalizedQuery);
  if (back) add(back);
  return [...set];
}

/** Tokens para scoring: query + traducción + inversa. */
function tokensForMatchingExpanded(normalizedQuery: string, termLimpio: string): string[] {
  const set = new Set<string>();
  for (const t of tokensForMatching(normalizedQuery)) set.add(t);
  const en = normalizeText(traducirAlIngles(termLimpio));
  for (const t of en.split(/\s+/).filter(Boolean)) {
    if (t.length > 1) set.add(t);
  }
  const back = traducirAEspanolDesdeIngles(normalizedQuery);
  if (back.length > 1) set.add(back);
  return [...set];
}

/**
 * 0 = nombre igual a una variante; 1 = empieza por variante; 2 = palabra completa;
 * 3 = subcadena; 4 = débil.
 *
 * `rawNombre`: sin normalizar; hace falta porque `normalizeText` quita `()` y
 * dejaría de detectarse «Nombre (marca)» de FatSecret.
 */
function literalMatchTier(
  normalizedName: string,
  variants: string[],
  rawNombre?: string,
): number {
  const tieneMarcaEntreParentesis = (s: string) => /\([^)]+\)/.test(s);
  let best = 4;
  for (const v of variants) {
    if (!v) continue;
    if (normalizedName === v) return 0;
    if (
      normalizedName.startsWith(`${v} `) ||
      normalizedName.startsWith(`${v},`) ||
      normalizedName.startsWith(`${v}(`)
    ) {
      const pareceMarcaFatSecret =
        (rawNombre && tieneMarcaEntreParentesis(rawNombre)) ||
        tieneMarcaEntreParentesis(normalizedName);
      best = Math.min(best, pareceMarcaFatSecret ? 2 : 1);
      continue;
    }
    if (hasWholeWord(normalizedName, v)) {
      best = Math.min(best, 2);
      continue;
    }
    if (normalizedName.includes(v)) best = Math.min(best, 3);
  }
  return best;
}

function nounFocusBonusMax(
  normalizedName: string,
  variants: string[],
  tokens: string[],
  opts?: { rawNombre?: string; singleTokenQuery?: boolean },
): number {
  let m = 0;
  for (const v of variants) {
    m = Math.max(m, nounFocusBonus(normalizedName, v, tokens, opts));
  }
  return m;
}

function sanitizeNumber(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Number(n.toFixed(2));
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n.toFixed(2));
}

type FdcNutrientRow = {
  nutrientId?: number;
  value?: number;
  amount?: number;
  nutrient?: { id?: number; number?: string; name?: string; unitName?: string };
};

function nutrientMapFromFdcRows(rows: unknown[] | undefined): Map<number, number> {
  const m = new Map<number, number>();
  if (!Array.isArray(rows)) return m;
  for (const r of rows) {
    const row = r as FdcNutrientRow;
    const id =
      typeof row.nutrientId === 'number'
        ? row.nutrientId
        : typeof row.nutrient?.id === 'number'
          ? row.nutrient.id
          : undefined;
    const val =
      typeof row.value === 'number'
        ? row.value
        : typeof row.amount === 'number'
          ? row.amount
          : undefined;
    if (id != null && val != null && Number.isFinite(val)) m.set(id, val);
  }
  return m;
}

/**
 * Macros por 100 g desde filas FDC: kcal (1008), kJ→kcal (1062 o fila Energy),
 * Atwater 4/4/9 si hace falta.
 */
function macrosFromFdcNutrientRows(rows: unknown[] | undefined): {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  fibra: number | null;
  azucar: number | null;
} {
  const m = nutrientMapFromFdcRows(rows);
  const proteinas = sanitizeNumber(m.get(1003) ?? 0);
  const carbohidratos = sanitizeNumber(m.get(1005) ?? 0);
  const grasas = sanitizeNumber(m.get(1004) ?? 0);
  let calorias = sanitizeNumber(m.get(1008) ?? 0);

  if (calorias <= 0) {
    const kj = m.get(1062);
    if (kj != null && kj > 20) calorias = sanitizeNumber(kj / 4.184);
  }
  if (calorias <= 0) {
    const atw = m.get(2047);
    if (atw != null && atw > 0) calorias = sanitizeNumber(atw);
  }

  if (calorias <= 0 && Array.isArray(rows)) {
    for (const r of rows) {
      const o = r as Record<string, unknown>;
      const nut = o.nutrient as Record<string, unknown> | undefined;
      const name = String(nut?.name ?? '').toLowerCase();
      const unit = String(nut?.unitName ?? '').toLowerCase();
      const amt =
        typeof o.amount === 'number'
          ? o.amount
          : typeof o.value === 'number'
            ? o.value
            : null;
      if (amt == null || !Number.isFinite(amt)) continue;
      if (!name.includes('energy')) continue;
      if (unit === 'kj') {
        calorias = sanitizeNumber(amt / 4.184);
        break;
      }
      if (unit === 'kcal') {
        calorias = sanitizeNumber(amt);
        break;
      }
    }
  }

  if (calorias <= 0 && (proteinas > 0 || carbohidratos > 0 || grasas > 0)) {
    calorias = sanitizeNumber(4 * proteinas + 4 * carbohidratos + 9 * grasas);
  }

  return {
    calorias,
    proteinas,
    carbohidratos,
    grasas,
    fibra: nullableNumber(m.get(1079)),
    azucar: nullableNumber(m.get(2000)),
  };
}

async function fetchFdcFoodNutrientRows(
  fdcId: number,
  apiKey: string,
): Promise<unknown[] | undefined> {
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const j = (await res.json()) as { foodNutrients?: unknown[] };
    return Array.isArray(j.foodNutrients) ? j.foodNutrients : undefined;
  } catch {
    return undefined;
  }
}

/** kcal explícitos o conversión desde kJ (OFF a veces solo publica energía en kJ). */
function kcalDesdeNutriments(nm: Record<string, unknown>): number {
  const k100 = nm['energy-kcal_100g'];
  if (k100 != null && Number(k100) > 0) return Number(k100);
  const ks = nm['energy-kcal_serving'];
  if (ks != null && Number(ks) > 0) return Number(ks);
  const kj100 = nm['energy-kj_100g'];
  if (kj100 != null && Number(kj100) > 0) return Number(kj100) / 4.184;
  const kjs = nm['energy-kj_serving'];
  if (kjs != null && Number(kjs) > 0) return Number(kjs) / 4.184;
  return 0;
}

/** Producto marcado como vendido en España (API v2 / campos opcionales). */
function vendeEnEspana(p: Record<string, unknown>): boolean {
  const tags = p.countries_tags;
  if (Array.isArray(tags)) {
    for (const x of tags) {
      if (x === 'en:spain' || x === 'es:espana' || x === 'es:spain') return true;
    }
  }
  const c = String(p.countries ?? p.country ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return c.includes('spain') || c.includes('españa') || c.includes('espana');
}

/** El nombre comercial (ES preferente) debe contener algún token de búsqueda relevante. */
function offNombreIncluyeAlgunToken(
  p: Record<string, unknown>,
  tokens: string[],
): boolean {
  if (tokens.length === 0) return false;
  const nombreEs = String(p.product_name_es ?? '').trim();
  const nombre = (nombreEs || String(p.product_name ?? '')).trim();
  const nName = normalizeText(nombre);
  return tokens.some((tok) => tok.length > 1 && nName.includes(tok));
}

async function fetchOffSearchPlProducts(url: string): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const payload = (await res.json()) as { products?: unknown[] };
    const arr = Array.isArray(payload?.products) ? payload.products : [];
    return arr as Record<string, unknown>[];
  } catch {
    return [];
  }
}

/**
 * v2 paginada: España + el nombre debe contener algún token (evita avena al buscar «pollo»).
 */
async function fetchOffV2EspanaConTextoEnNombre(
  query: string,
  needCount: number,
  matchTokens: string[],
): Promise<Record<string, unknown>[]> {
  const q = query.trim().slice(0, 200);
  if (!q || matchTokens.length === 0) return [];

  const fields = encodeURIComponent(
    'code,product_name,product_name_es,nutriments,countries_tags,countries',
  );
  const qEnc = encodeURIComponent(q);
  const perPage = 40;
  const maxPages = 10;
  const targetPool = Math.min(80, Math.max(needCount * 4, 24));
  const bases = [
    'https://es.openfoodfacts.org/api/v2/search',
    'https://world.openfoodfacts.org/api/v2/search',
  ];

  const collected: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const base of bases) {
    for (let page = 1; page <= maxPages && collected.length < targetPool; page++) {
      const u = `${base}?search_terms=${qEnc}&page=${page}&page_size=${perPage}&fields=${fields}`;
      try {
        const res = await fetch(u);
        if (!res.ok) continue;
        const j = (await res.json()) as { products?: unknown[] };
        const raw = Array.isArray(j?.products) ? j.products : [];
        if (raw.length === 0) break;

        for (const item of raw) {
          const p = item as Record<string, unknown>;
          if (!vendeEnEspana(p)) continue;
          if (!offNombreIncluyeAlgunToken(p, matchTokens)) continue;
          const code = String(p.code ?? '');
          if (!code || seen.has(code)) continue;
          seen.add(code);
          collected.push(p);
        }
        if (raw.length < perPage) break;
      } catch {
        continue;
      }
    }
    if (collected.length > 0) break;
  }

  return collected;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreResult(name: string, query: string, tokens: string[]): number {
  let score = 0;
  if (name === query) score += 100;
  else if (name.startsWith(query)) score += 60;
  else if (name.includes(query)) score += 35;
  if (hasWholeWord(name, query)) score += 80;

  for (const t of tokens) {
    if (hasWholeWord(name, t)) score += 35;
    else if (name.startsWith(t)) score += 18;
    else if (name.includes(t)) score += 10;
  }

  // Penalizar nombres muy largos (suelen ser variantes específicas)
  if (name.length > 60) score -= 8;
  if (name.length > 40) score -= 4;

  return score;
}

function hasWholeWord(text: string, token: string): boolean {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i').test(text);
}

const STOPWORDS_BUSQUEDA = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'y',
  'o',
  'a',
  'en',
  'con',
  'por',
  'para',
  'un',
  'una',
  'unos',
  'unas',
  'al',
]);

/** Quita muletillas de empaquetado / marketing de la consulta para matchear mejor el sustantivo. */
function limpiarRuidoBusqueda(raw: string): string {
  let s = normalizeText(raw);
  const frases = [
    'sabor a ',
    'sabor de ',
    'con sabor a ',
    'sabor ',
    'tipo ',
    'estilo ',
    'imitacion ',
    'imitación ',
    'light ',
    'diet ',
    'bajo en ',
    'sin azucar ',
    'sin azúcar ',
    'zero ',
    'deslactosada ',
    'deslactosado ',
  ];
  for (const p of frases) {
    while (s.includes(p)) s = s.replace(p, ' ');
  }
  s = s
    .replace(/\bcongelad[oa]s?\b/g, ' ')
    .replace(/\bcongelado\b/g, ' ')
    .replace(/\bcongelada\b/g, ' ')
    .replace(/\benlatad[oa]s?\b/g, ' ')
    .replace(/\bfresco[s]?\b/g, ' ')
    .replace(/\binstantane[oa]\b/g, ' ')
    .replace(/\binstantáne[oa]\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function tokensRelevantes(normalizedQuery: string): string[] {
  return normalizedQuery
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS_BUSQUEDA.has(t));
}

/** Tokens para scoring; si solo hay stopwords, conserva palabras significativas (>1 carácter). */
function tokensForMatching(normalizedQuery: string): string[] {
  const core = tokensRelevantes(normalizedQuery);
  if (core.length > 0) return core;
  return normalizedQuery.split(/\s+/).filter((t) => t.length > 1);
}

function inferTierFromPartial(item: Partial<Food>): FoodTier {
  if (item.food_tier) return item.food_tier;
  if (item.api_source === 'builtin') return 'master';
  if (item.api_source === GENERIC_DB_API_SOURCE) return 'reference';
  if (item.api_source === FOOD_API_SOURCE || item.api_source === 'openfoodfacts') {
    return 'brand';
  }
  if (item.api_source === FATSECRET_API_SOURCE) return 'reference';
  if (item.api_source === 'usda_fdc') return 'reference';
  return 'reference';
}

function inferSourceKindFromPartial(item: Partial<Food>): FoodSourceKind {
  if (item.source_kind) return item.source_kind as FoodSourceKind;
  if (item.api_source === 'builtin') return 'builtin';
  if (item.api_source === GENERIC_DB_API_SOURCE) return 'generic_curated';
  if (item.api_source === FATSECRET_API_SOURCE) return 'fatsecret';
  if (item.api_source === FOOD_API_SOURCE || item.api_source === 'openfoodfacts') {
    return 'openfoodfacts';
  }
  if (item.api_source === 'usda_fdc') return 'usda_foundation';
  return 'custom';
}

function rellenarMetaFood(f: Food): Food {
  return {
    ...f,
    food_tier: f.food_tier ?? inferTierFromPartial(f),
    source_kind: f.source_kind ?? inferSourceKindFromPartial(f),
    verified_basic: f.verified_basic ?? f.api_source === 'builtin',
  };
}

/** Prioridad por capa: maestro > USDA Foundation > FatSecret > marca/OFF. */
function tierBoost(food: Food): number {
  if (food.is_custom) return 155;
  if (food.api_source === 'builtin' || food.food_tier === 'master') return 310;

  const sk = food.source_kind;
  if (sk === 'generic_curated' || food.api_source === GENERIC_DB_API_SOURCE) return 124;
  if (sk === 'usda_foundation' || food.verified_basic) return 128;
  if (sk === 'usda_sr_legacy') return 102;
  if (sk === 'fatsecret' || food.api_source === FATSECRET_API_SOURCE) {
    return food.food_tier === 'brand' ? 68 : 108;
  }
  if (sk === 'usda_fndds' || food.food_tier === 'brand') return 48;
  if (sk === 'openfoodfacts' || food.api_source === FOOD_API_SOURCE) return 36;
  if (food.api_source === 'usda_fdc') return 88;
  return 72;
}

/** Prioriza nombres centrados en el sustantivo buscado (p. ej. «Pollo» sobre «Pizza con pollo»). */
function nounFocusBonus(
  normalizedName: string,
  normalizedQuery: string,
  tokens: string[],
  opts?: { rawNombre?: string; singleTokenQuery?: boolean },
): number {
  const useTokens = tokens.length > 0 ? tokens : normalizedQuery ? [normalizedQuery] : [];
  let bonus = 0;
  const marcaParen =
    opts?.rawNombre && /\([^)]+\)/.test(opts.rawNombre);
  for (const t of useTokens) {
    if (!t || t.length < 2) continue;
    if (normalizedName === t) bonus += 95;
    else if (normalizedName.startsWith(`${t},`) || normalizedName.startsWith(`${t} `)) {
      if (opts?.singleTokenQuery && marcaParen) {
        bonus += 24;
      } else {
        bonus += 72;
      }
    } else if (hasWholeWord(normalizedName, t)) {
      const words = normalizedName.split(/\s+/).filter((w) => w.length > 2);
      if (words.length <= 3) bonus += 38;
      else bonus += 12;
    }
  }
  return bonus;
}

/** Penaliza platos compuestos donde el ingrediente es secundario. */
function compoundDishPenalty(normalizedName: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  let pen = 0;
  const hasJunction = /\b(con|with|style|and)\b/.test(normalizedName);
  if (!hasJunction) return 0;

  for (const t of tokens) {
    if (t.length < 3) continue;
    if (!normalizedName.includes(t)) continue;
    const idx = normalizedName.indexOf(t);
    const before = normalizedName.slice(0, idx);
    if (
      /\b(con|with)\s+\S+\s*$/.test(before.trimEnd()) ||
      /\S+\s+con\s+$/.test(before) ||
      /\bpizza\b|\bsandwich\b|\bburger\b|\burrito\b|\btaco\b/.test(before)
    ) {
      pen += 52;
    }
  }
  return pen;
}

function popularityBoost(count: number): number {
  if (count <= 0) return 0;
  return Math.min(32, 16 * Math.log10(count + 1));
}

async function cargarPopularidadPorIds(ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return map;
  const { data, error } = await supabase
    .from('food_search_popularity')
    .select('food_id, selection_count')
    .in('food_id', uniq);
  if (error) return map;
  for (const row of data ?? []) {
    map.set(String(row.food_id), Number(row.selection_count ?? 0));
  }
  return map;
}

/** Fusiona filas con el mismo nombre normalizado (p. ej. duplicados técnicos) conservando el mayor score. */
function dedupePorNombreNormalizado<T extends { _score: number; nombre: string }>(
  items: T[],
): T[] {
  const byName = new Map<string, T>();
  for (const it of items) {
    const k = normalizeText(it.nombre);
    if (!k) continue;
    const prev = byName.get(k);
    if (!prev || it._score > prev._score) byName.set(k, it);
  }
  return Array.from(byName.values());
}

function attachSearchScore(f: Food, ctx: SearchScoreCtx): Food & { _score: number } {
  const rawNombre = f.nombre ?? '';
  const normalizedName = normalizeText(rawNombre);
  const fMeta = rellenarMetaFood(f);
  const forTier: Food =
    fMeta.api_source === FATSECRET_API_SOURCE &&
    rawNombre &&
    /\([^)]+\)/.test(rawNombre) &&
    fMeta.food_tier === 'reference'
      ? { ...fMeta, food_tier: 'brand' }
      : fMeta;
  const base = tierBoost(forTier);
  let textScore = 0;
  for (const v of ctx.queryVariants) {
    textScore = Math.max(textScore, scoreResult(normalizedName, v, ctx.queryTokens));
  }
  const noun = nounFocusBonusMax(normalizedName, ctx.queryVariants, ctx.queryTokens, {
    rawNombre,
    singleTokenQuery: ctx.singleTokenQuery,
  });
  const noise = compoundDishPenalty(normalizedName, ctx.queryTokens);
  const literalTier = literalMatchTier(normalizedName, ctx.queryVariants, rawNombre);
  const literalBoost = (4 - literalTier) * 480;
  const tituloIgualQuery =
    ctx.singleTokenQuery &&
    ctx.queryVariants.some((v) => v && normalizedName === v);
  const bonusNombreMinimo = tituloIgualQuery ? 520 : 0;
  let apiOrderBoost = 0;
  if (f.api_id != null && f.api_source) {
    const rk = ctx.apiOrderByKey.get(`${f.api_source}:${f.api_id}`);
    if (rk !== undefined) {
      apiOrderBoost = Math.max(0, 36 - rk) * 11;
    }
  }
  let score =
    base +
    textScore +
    noun -
    noise +
    literalBoost +
    apiOrderBoost +
    bonusNombreMinimo;
  if (esUuidPostgres(f.id)) {
    score += popularityBoost(ctx.popularidad.get(f.id) ?? 0);
  }
  return { ...f, _score: score };
}

function rankFoodsForBucket(
  foods: Food[],
  ctx: SearchScoreCtx,
): (Food & { _score: number })[] {
  if (foods.length === 0) return [];
  const scored = foods.map((x) => attachSearchScore(x, ctx));
  return dedupePorNombreNormalizado(scored).sort((a, b) => b._score - a._score);
}

function pickSearchSlots(
  ranked: (Food & { _score: number })[],
  maxTake: number,
  out: Food[],
  seenKeys: Set<string>,
  seenNames: Set<string>,
): void {
  let taken = 0;
  for (const row of ranked) {
    if (taken >= maxTake) break;
    const dk = dedupKeyFood(row);
    const nk = normalizeText(row.nombre);
    if (!nk) continue;
    if (seenKeys.has(dk) || seenNames.has(nk)) continue;
    seenKeys.add(dk);
    seenNames.add(nk);
    const { _score, ...rest } = row;
    void _score;
    out.push(rest as Food);
    taken++;
  }
}
