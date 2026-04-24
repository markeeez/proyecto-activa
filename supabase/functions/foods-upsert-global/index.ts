/**
 * Upsert de filas globales en public.foods (builtin, FatSecret, Open Food Facts, legacy USDA).
 * Requiere JWT de usuario válido; escritura con service_role (bypass RLS).
 *
 * Secreto con permisos de escritura (obligatorio). El CLI suele ignorar variables
 * que empiezan por SUPABASE_ si las lees desde un .env; usa uno de estos:
 *   - `supabase secrets set SERVICE_ROLE_KEY=tu_jwt_service_role`
 *   - o Dashboard → Edge Functions → Secrets: SERVICE_ROLE_KEY
 * Opcional: SUPABASE_SERVICE_ROLE_KEY si lo defines sin usar --env-file.
 * SUPABASE_URL y SUPABASE_ANON_KEY los inyecta Supabase en la función.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_SOURCES = new Set([
  'builtin',
  'fatsecret',
  'openfoodfacts',
  'usda_fdc',
]);
const MAX_ITEMS = 30;

type IncomingItem = {
  nombre?: string;
  api_source?: string;
  api_id?: string;
  calorias?: number;
  proteinas?: number;
  carbohidratos?: number;
  grasas?: number;
  fibra?: number | null;
  azucar?: number | null;
  food_tier?: string | null;
  source_kind?: string | null;
  verified_basic?: boolean | null;
};

function clampNum(n: unknown, max = 10_000): number {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.min(x, max);
}

function nullableNum(n: unknown): number | null {
  if (n === null || n === undefined || n === '') return null;
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return null;
  return Math.min(Number(x.toFixed(2)), 10_000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SERVICE_ROLE_KEY') ??
    '';

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(token);
  // Evitar que anónimos llenen la caché global: hace falta usuario registrado.
  if (userErr || !user) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized',
        detail: userErr?.message ?? 'Se requiere iniciar sesión para guardar alimentos de la API',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  let body: { items?: IncomingItem[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawItems = body?.items;
  if (!Array.isArray(rawItems)) {
    return new Response(JSON.stringify({ error: 'items must be an array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (rawItems.length > MAX_ITEMS) {
    return new Response(JSON.stringify({ error: 'Too many items' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const results: (Record<string, unknown> | null)[] = [];

  // Construir filas válidas manteniendo el índice original para devolver
  // null en las posiciones que no pasen validación.
  const TIER_OK = new Set(['master', 'reference', 'brand']);

  const rows: ({ idx: number; payload: Record<string, unknown> })[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const nombre = typeof raw.nombre === 'string' ? raw.nombre.trim() : '';
    const apiSource = raw.api_source;
    const apiId = typeof raw.api_id === 'string' ? raw.api_id.trim() : '';

    if (!nombre || !apiId || typeof apiSource !== 'string' || !ALLOWED_SOURCES.has(apiSource)) {
      results[i] = null;
      continue;
    }

    const rawTier = typeof raw.food_tier === 'string' ? raw.food_tier : 'reference';
    const food_tier = TIER_OK.has(rawTier) ? rawTier : 'reference';
    const source_kind = typeof raw.source_kind === 'string' ? raw.source_kind : null;
    const verified_basic = raw.verified_basic === true;

    rows.push({
      idx: i,
      payload: {
        nombre,
        api_source: apiSource,
        api_id: apiId,
        calorias: clampNum(raw.calorias),
        proteinas: clampNum(raw.proteinas),
        carbohidratos: clampNum(raw.carbohidratos),
        grasas: clampNum(raw.grasas),
        fibra: nullableNum(raw.fibra),
        azucar: nullableNum(raw.azucar),
        is_custom: false,
        created_by: null,
        food_tier,
        source_kind,
        verified_basic,
      },
    });
  }

  if (rows.length > 0) {
    try {
      // Paso 1: Insertar solo filas NUEVAS. Las ya existentes se omiten (ignoreDuplicates: true)
      // para nunca sobreescribir los macros de alimentos que el usuario ya ha registrado en su diario.
      const { data: inserted, error: insertErr } = await admin
        .from('foods')
        .upsert(
          rows.map((r) => r.payload),
          { onConflict: 'api_source,api_id', ignoreDuplicates: true },
        )
        .select('*');

      if (insertErr) {
        for (const r of rows) results[r.idx] = null;
      } else {
        // Construir mapa con las filas recién insertadas
        const byKey = new Map<string, Record<string, unknown>>(
          (inserted ?? []).map((row: Record<string, unknown>) => [
            `${row['api_source']}::${row['api_id']}`,
            row,
          ]),
        );

        const insertedKeys = new Set(byKey.keys());

        // Paso 2: Para filas ya existentes, actualizar SOLO metadatos — nunca los macros.
        // Así el historial del usuario siempre es consistente con los valores con los que registró.
        const existingRows = rows.filter(
          (r) => !insertedKeys.has(`${r.payload.api_source}::${r.payload.api_id}`),
        );

        if (existingRows.length > 0) {
          const updateResults = await Promise.all(
            existingRows.map((r) =>
              admin
                .from('foods')
                .update({
                  nombre: r.payload.nombre,
                  food_tier: r.payload.food_tier,
                  source_kind: r.payload.source_kind,
                  verified_basic: r.payload.verified_basic,
                })
                .eq('api_source', r.payload.api_source as string)
                .eq('api_id', r.payload.api_id as string)
                .select('*')
                .maybeSingle(),
            ),
          );

          for (let i = 0; i < existingRows.length; i++) {
            const r = existingRows[i];
            const key = `${r.payload.api_source}::${r.payload.api_id}`;
            const { data, error } = updateResults[i];
            if (!error && data) {
              byKey.set(key, data as Record<string, unknown>);
            }
          }
        }

        // Mapear resultados finales a los índices originales del array de entrada
        for (const r of rows) {
          const key = `${r.payload.api_source}::${r.payload.api_id}`;
          results[r.idx] = byKey.get(key) ?? null;
        }
      }
    } catch {
      for (const r of rows) results[r.idx] = null;
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
