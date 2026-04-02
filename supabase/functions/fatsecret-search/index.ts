/**
 * Búsqueda FatSecret (OAuth2 client_credentials). Credenciales solo como secretos:
 *   FATSECRET_CLIENT_ID
 *   FATSECRET_CLIENT_SECRET
 *
 * Opcional (IP fija en FatSecret): tráfico vía relay en tu VPS:
 *   FATSECRET_RELAY_URL   base del relay (sin /relay): http://IP:8787 o https://sub.dominio.com
 *   FATSECRET_RELAY_SECRET mismo valor que RELAY_SECRET del relay
 *
 * Localización búsqueda (por defecto España + español):
 *   FATSECRET_REGION=ES   FATSECRET_LANGUAGE=es
 *   Dejar vacío uno de los dos en secrets si FatSecret devolviera error (algunos planes listan premier).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function relayConfig(): { base: string; secret: string } | null {
  let base = (Deno.env.get('FATSECRET_RELAY_URL') ?? '').trim();
  base = base.replace(/\/+$/, '');
  // Si alguien pega .../relay, no duplicar ruta (/relay/relay)
  if (/\/relay$/i.test(base)) base = base.replace(/\/relay$/i, '');
  base = base.replace(/\/+$/, '');
  const secret = (Deno.env.get('FATSECRET_RELAY_SECRET') ?? '').trim();
  if (base && secret) return { base, secret };
  return null;
}

/** Petición a FatSecret directa o a través del relay (misma respuesta HTTP que upstream). */
async function fatsecretFetch(url: string, init?: RequestInit): Promise<Response> {
  const relay = relayConfig();
  if (!relay) return fetch(url, init);

  const headersObj: Record<string, string> = {};
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => {
      headersObj[k] = v.trim();
    });
  }
  let bodyStr: string | undefined;
  const b = init?.body;
  if (b != null) {
    if (typeof b === 'string') bodyStr = b;
    else if (b instanceof URLSearchParams) bodyStr = b.toString();
    else if (b instanceof Uint8Array) bodyStr = new TextDecoder().decode(b);
    else if (b instanceof ArrayBuffer) {
      bodyStr = new TextDecoder().decode(new Uint8Array(b));
    }
  }
  const method = (init?.method ?? 'GET').toUpperCase();

  let relayRes: Response;
  try {
    relayRes = await fetch(`${relay.base}/relay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FatSecret-Relay-Secret': relay.secret,
      },
      body: JSON.stringify({
        url,
        method,
        headers: headersObj,
        body: bodyStr ?? null,
      }),
    });
  } catch (e) {
    console.warn(
      '[fatsecret-search] relay fetch falló (¿HTTP bloqueado desde Edge? prueba HTTPS+Caddy):',
      e instanceof Error ? e.message : String(e),
    );
    return new Response(null, { status: 502 });
  }

  if (!relayRes.ok) {
    const t = await relayRes.text();
    console.warn('[fatsecret-search] relay HTTP', relayRes.status, t.slice(0, 400));
    return new Response(null, { status: 502 });
  }

  const status = relayRes.status;
  const ct = relayRes.headers.get('content-type') ?? 'application/octet-stream';
  const buf = await relayRes.arrayBuffer();
  return new Response(buf, { status, headers: { 'Content-Type': ct } });
}

type FatSecretServing = {
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
};

type FatSecretFood = {
  food_id?: string | number;
  food_name?: string;
  brand_name?: string;
  food_description?: string;
  food_type?: string;
  servings?: {
    serving?: FatSecretServing | FatSecretServing[];
  };
};

function parseDescription(desc: string): {
  calorias: number;
  grasas: number;
  carbohidratos: number;
  proteinas: number;
} {
  const cal =
    desc.match(/Calories:\s*([\d.]+)\s*kcal/i) ??
    desc.match(/Energy:\s*([\d.]+)\s*kcal/i) ??
    desc.match(/Calories:\s*([\d.]+)/i);
  const fat =
    desc.match(/Fat:\s*([\d.]+)\s*g/i) ??
    desc.match(/Lipides:\s*([\d.]+)\s*g/i);
  const carb =
    desc.match(/Carbs:\s*([\d.]+)\s*g/i) ??
    desc.match(/Carbohydrate:\s*([\d.]+)\s*g/i) ??
    desc.match(/Carbohydrates:\s*([\d.]+)\s*g/i);
  const prot =
    desc.match(/Protein:\s*([\d.]+)\s*g/i) ??
    desc.match(/Proteins:\s*([\d.]+)\s*g/i);
  return {
    calorias: cal ? Number(cal[1]) : 0,
    grasas: fat ? Number(fat[1]) : 0,
    carbohidratos: carb ? Number(carb[1]) : 0,
    proteinas: prot ? Number(prot[1]) : 0,
  };
}

function macrosFromFirstServing(f: FatSecretFood): {
  calorias: number;
  grasas: number;
  carbohidratos: number;
  proteinas: number;
} {
  const raw = f.servings?.serving;
  if (raw == null) {
    return { calorias: 0, grasas: 0, carbohidratos: 0, proteinas: 0 };
  }
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s) {
    return { calorias: 0, grasas: 0, carbohidratos: 0, proteinas: 0 };
  }
  return {
    calorias: Number(s.calories ?? 0) || 0,
    proteinas: Number(s.protein ?? 0) || 0,
    carbohidratos: Number(s.carbohydrate ?? 0) || 0,
    grasas: Number(s.fat ?? 0) || 0,
  };
}

/**
 * v1: `foods.food`. APIs recientes: `foods_search.results.food`.
 * También raíces envueltas (`food_response`, etc.).
 */
function extractFoodsFromPayload(payload: unknown): FatSecretFood[] {
  if (!payload || typeof payload !== 'object') return [];
  const o = payload as Record<string, unknown>;
  const roots: unknown[] = [
    o,
    o.food_response,
    o.response,
    (o as { result?: unknown }).result,
  ];

  for (const root of roots) {
    if (!root || typeof root !== 'object') continue;
    const r = root as Record<string, unknown>;

    const fs = r.foods_search as
      | { results?: { food?: FatSecretFood | FatSecretFood[] } }
      | undefined;
    if (fs?.results) {
      const food = fs.results.food;
      if (food != null) {
        return Array.isArray(food) ? food : [food];
      }
    }

    const foods = r.foods as
      | { food?: FatSecretFood | FatSecretFood[] }
      | undefined;
    if (foods) {
      const food = foods.food;
      if (food != null) {
        return Array.isArray(food) ? food : [food];
      }
    }
  }

  console.warn(
    '[fatsecret-search] Sin lista foods en JSON. Claves raíz:',
    Object.keys(o).join(','),
  );
  return [];
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
  const clientId = (Deno.env.get('FATSECRET_CLIENT_ID') ?? '').trim();
  const clientSecret = (Deno.env.get('FATSECRET_CLIENT_SECRET') ?? '').trim();

  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { error: userErr } = await userClient.auth.getUser(token);
  // Sesión anónima: user es null pero el JWT sigue siendo válido (anon key) — permitir búsqueda.
  if (userErr) {
    return new Response(JSON.stringify({ error: 'Unauthorized', detail: userErr.message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ items: [] as unknown[] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  let body: { q?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (relayConfig()) {
    console.warn('[fatsecret-search] Usando FATSECRET_RELAY_URL (salida por tu VPS)');
  }

  const q = typeof body.q === 'string' ? body.q.trim() : '';
  if (!q || q.length > 200) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const tokenRes = await fatsecretFetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'basic',
    }),
  });

  if (!tokenRes.ok) {
    let detail = '';
    try {
      detail = (await tokenRes.clone().text()).slice(0, 400);
    } catch {
      detail = '';
    }
    console.warn('[fatsecret-search] OAuth token falló HTTP', tokenRes.status, detail);
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    console.warn(
      '[fatsecret-search] OAuth sin access_token:',
      JSON.stringify(tokenJson).slice(0, 500),
    );
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  /** Localización (España + español). Opcional: secretos FATSECRET_REGION / FATSECRET_LANGUAGE o vacíos para omitir. */
  const fsRegion = (Deno.env.get('FATSECRET_REGION') ?? 'ES').trim();
  const fsLanguage = (Deno.env.get('FATSECRET_LANGUAGE') ?? 'es').trim();

  const params = new URLSearchParams({
    search_expression: q,
    max_results: '20',
    format: 'json',
  });
  if (fsRegion) params.set('region', fsRegion);
  if (fsLanguage) params.set('language', fsLanguage);

  const fsHeaders = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  /** v3 suele exigir plan Premier (error 14 con scope `basic`); aun así devuelve HTTP 200. */
  function fatsecretBodyErrorCode(payload: unknown): number | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const c = (payload as { error?: { code?: number } }).error?.code;
    return typeof c === 'number' ? c : undefined;
  }

  let searchPayload: unknown | undefined;
  let searchRes = await fatsecretFetch(
    `https://platform.fatsecret.com/rest/foods/search/v3?${params.toString()}`,
    { headers: fsHeaders },
  );

  if (searchRes.ok) {
    const p = await searchRes.json();
    if (fatsecretBodyErrorCode(p) === 14) {
      console.warn(
        '[fatsecret-search] v3 requiere plan Premier (código 14); usando v1 con scope basic',
      );
    } else {
      searchPayload = p;
    }
  } else {
    console.warn('[fatsecret-search] GET v3 HTTP', searchRes.status);
  }

  if (searchPayload === undefined) {
    searchRes = await fatsecretFetch(
      `https://platform.fatsecret.com/rest/foods/search/v1?${params.toString()}`,
      { headers: fsHeaders },
    );
    if (searchRes.ok) {
      searchPayload = await searchRes.json();
    } else {
      console.warn('[fatsecret-search] GET v1 HTTP', searchRes.status);
      const form = new URLSearchParams({
        method: 'foods.search',
        search_expression: q,
        max_results: '20',
        format: 'json',
      });
      if (fsRegion) form.set('region', fsRegion);
      if (fsLanguage) form.set('language', fsLanguage);
      searchRes = await fatsecretFetch('https://platform.fatsecret.com/rest/server.api', {
        method: 'POST',
        headers: {
          ...fsHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      if (!searchRes.ok) {
        let sd = '';
        try {
          sd = (await searchRes.clone().text()).slice(0, 400);
        } catch {
          sd = '';
        }
        console.warn(
          '[fatsecret-search] búsqueda: v3/v1/server.api fallaron. Último HTTP',
          searchRes.status,
          sd,
        );
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      searchPayload = await searchRes.json();
    }
  }

  if (searchPayload === undefined) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  const errObj = (searchPayload as { error?: { code?: number; message?: string } })
    ?.error;
  if (errObj?.message) {
    const code = errObj.code;
    console.warn(
      '[fatsecret-search] API error:',
      errObj.message,
      code != null ? `(code ${code})` : '',
    );
  }
  // https://platform.fatsecret.com/docs/guides/error-codes — 21 = IP no en lista blanca
  if (errObj?.code === 21) {
    console.warn(
      '[fatsecret-search] Código 21: FatSecret rechaza la IP de salida. En el portal (tu clave OAuth) añade IPs permitidas. Las Edge Functions salen con IP de Supabase (no la del móvil ni tu casa).',
    );
  }

  const list = extractFoodsFromPayload(searchPayload);
  if (list.length === 0) {
    const keys =
      searchPayload && typeof searchPayload === 'object'
        ? Object.keys(searchPayload as object).join(',')
        : '';
    console.warn(
      '[fatsecret-search] Lista vacía (parse). Claves JSON:',
      keys || '(n/a)',
    );
  }

  const items = list
    .map((f) => {
      const id = f.food_id != null && f.food_id !== '' ? String(f.food_id) : '';
      const name = (f.food_name ?? '').trim();
      if (!id || !name) return null;
      let macros = parseDescription(f.food_description ?? '');
      if (
        macros.calorias === 0 &&
        macros.proteinas === 0 &&
        macros.carbohidratos === 0 &&
        macros.grasas === 0
      ) {
        macros = macrosFromFirstServing(f);
      }
      const brand = (f.brand_name ?? '').trim();
      const nombre = brand ? `${name} (${brand})` : name;
      const genericFirst =
        f.food_type === 'Generic' || f.food_type === 'generic';
      /** Con marca de tienda/productor no es «referencia» aunque FatSecret ponga Generic. */
      const food_tier =
        brand || !genericFirst ? 'brand' : 'reference';
      return {
        nombre,
        api_source: 'fatsecret',
        api_id: id,
        calorias: macros.calorias,
        proteinas: macros.proteinas,
        carbohidratos: macros.carbohidratos,
        grasas: macros.grasas,
        fibra: null as number | null,
        azucar: null as number | null,
        food_tier,
        source_kind: 'fatsecret',
        verified_basic: false,
        _generic: genericFirst,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  items.sort((a, b) => {
    const ga = a._generic === true ? 0 : 1;
    const gb = b._generic === true ? 0 : 1;
    return ga - gb;
  });

  for (const it of items) {
    delete it._generic;
  }

  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
