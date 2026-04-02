/**
 * Upsert de filas globales en public.foods (builtin + caché USDA).
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

const ALLOWED_SOURCES = new Set(['builtin', 'usda_fdc']);
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

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
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

  for (const raw of rawItems) {
    const nombre = typeof raw.nombre === 'string' ? raw.nombre.trim() : '';
    const apiSource = raw.api_source;
    const apiId = typeof raw.api_id === 'string' ? raw.api_id.trim() : '';

    if (!nombre || !apiId || typeof apiSource !== 'string' || !ALLOWED_SOURCES.has(apiSource)) {
      results.push(null);
      continue;
    }

    const TIER_OK = new Set(['master', 'reference', 'brand']);
    const rawTier = typeof raw.food_tier === 'string' ? raw.food_tier : 'reference';
    const food_tier = TIER_OK.has(rawTier) ? rawTier : 'reference';
    const source_kind =
      typeof raw.source_kind === 'string' ? raw.source_kind : null;
    const verified_basic = raw.verified_basic === true;

    const rowPayload = {
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
    };

    try {
      const { data: existingRows, error: selErr } = await admin
        .from('foods')
        .select('id')
        .eq('api_source', apiSource)
        .eq('api_id', apiId)
        .limit(1);

      if (selErr) {
        results.push(null);
        continue;
      }

      const existente = existingRows?.[0] ?? null;

      if (existente?.id) {
        const { data: updated, error: upErr } = await admin
          .from('foods')
          .update(rowPayload)
          .eq('id', existente.id)
          .select('*')
          .single();
        results.push(upErr ? null : updated);
      } else {
        const { data: inserted, error: insErr } = await admin
          .from('foods')
          .insert(rowPayload)
          .select('*')
          .single();
        results.push(insErr ? null : inserted);
      }
    } catch {
      results.push(null);
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
