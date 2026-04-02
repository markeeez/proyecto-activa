/**
 * Prueba local de la API FatSecret (mismo flujo que la Edge Function).
 *
 * En `.env`:
 *   FATSECRET_CLIENT_ID=...
 *   FATSECRET_CLIENT_SECRET=...
 *
 * Opcional (mismo camino que Supabase → tu relay Hetzner):
 *   FATSECRET_RELAY_URL=http://178.104.110.6:8787
 *   FATSECRET_RELAY_SECRET=...
 *
 * Uso:
 *   node scripts/test-fatsecret.mjs
 *   node scripts/test-fatsecret.mjs "pollo chicken"
 *   npm run test:fatsecret
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadEnvFile() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  const text = readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function normalizeRelayBase(raw) {
  let b = (raw ?? '').trim().replace(/\/+$/, '');
  if (/\/relay$/i.test(b)) b = b.replace(/\/relay$/i, '');
  return b.replace(/\/+$/, '');
}

let relayBase = null;
let relaySecret = null;

function initRelayFromEnv() {
  const rb = normalizeRelayBase(process.env.FATSECRET_RELAY_URL);
  const rs = process.env.FATSECRET_RELAY_SECRET?.trim();
  if (rb && rs) {
    relayBase = rb;
    relaySecret = rs;
    return true;
  }
  return false;
}

/**
 * Petición a FatSecret directa o vía relay (igual que supabase/functions/fatsecret-search).
 */
async function fatsecretRequest(url, init = {}) {
  if (relayBase) {
    const headersObj = {};
    if (init.headers) {
      new Headers(init.headers).forEach((v, k) => {
        headersObj[k] = v;
      });
    }
    let bodyStr = null;
    const b = init.body;
    if (b != null) {
      if (typeof b === 'string') bodyStr = b;
      else if (b instanceof URLSearchParams) bodyStr = b.toString();
    }
    const relayUrl = `${relayBase}/relay`;
    const rr = await fetch(relayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FatSecret-Relay-Secret': relaySecret,
      },
      body: JSON.stringify({
        url,
        method: (init.method ?? 'GET').toUpperCase(),
        headers: headersObj,
        body: bodyStr,
      }),
    });
    const text = await rr.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = {
        _parseError: 'no es JSON',
        _rawHead: text.slice(0, 500),
      };
    }
    if (!rr.ok) {
      console.warn(
        '[relay] El nodo relay respondió HTTP',
        rr.status,
        '(no es el status de FatSecret). Cuerpo:',
        text.slice(0, 400),
      );
    }
    return {
      ok: rr.ok,
      status: rr.status,
      json,
      textLength: text.length,
      text,
    };
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _parseError: 'no es JSON', _rawHead: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, json, textLength: text.length, text };
}

function extractFoodList(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const o = payload;
  const roots = [
    o,
    o.food_response,
    o.response,
    o.result,
  ].filter(Boolean);

  for (const root of roots) {
    if (typeof root !== 'object') continue;
    const fs = root.foods_search?.results;
    if (fs?.food != null) {
      const food = fs.food;
      return Array.isArray(food) ? food : [food];
    }
    const foods = root.foods;
    if (foods?.food != null) {
      const food = foods.food;
      return Array.isArray(food) ? food : [food];
    }
  }
  return [];
}

async function oauthToken(clientId, clientSecret) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  return fatsecretRequest('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'basic',
    }),
  });
}

async function searchGet(url, accessToken) {
  return fatsecretRequest(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
}

function fatsecretLocaleParams() {
  const region = (process.env.FATSECRET_REGION ?? 'ES').trim();
  const language = (process.env.FATSECRET_LANGUAGE ?? 'es').trim();
  return { region, language };
}

async function searchPostServerApi(accessToken, q) {
  const { region, language } = fatsecretLocaleParams();
  const form = new URLSearchParams({
    method: 'foods.search',
    search_expression: q,
    max_results: '50',
    format: 'json',
  });
  if (region) form.set('region', region);
  if (language) form.set('language', language);
  return fatsecretRequest('https://platform.fatsecret.com/rest/server.api', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
}

function summarizePayload(label, json) {
  console.log(`\n--- ${label} ---`);
  if (!json || typeof json !== 'object') {
    console.log('(vacío o no objeto)');
    return;
  }
  console.log('Claves raíz:', Object.keys(json).join(', ') || '(ninguna)');
  const err = json.error;
  if (err) console.log('error API:', JSON.stringify(err));
  if (err?.code === 21) {
    console.log(
      '\n>>> Código 21: IP no autorizada en FatSecret (lista blanca).\n',
    );
  }
  const list = extractFoodList(json);
  console.log('Ítems que extraeríamos (foods_search o foods):', list.length);
  if (list[0]) {
    const f = list[0];
    console.log('Primer ítem (recortado):', {
      food_id: f.food_id,
      food_name: f.food_name,
      food_type: f.food_type,
      brand_name: f.brand_name,
      food_description: f.food_description
        ? String(f.food_description).slice(0, 120) + '…'
        : undefined,
      tiene_servings: Boolean(f.servings?.serving),
    });
  }
  const preview = JSON.stringify(json, null, 2);
  const max = 6000;
  if (preview.length > max) {
    console.log(
      `JSON completo (primeros ${max} caracteres):\n${preview.slice(0, max)}\n… [total ${preview.length} chars]`,
    );
  } else {
    console.log('JSON completo:\n', preview);
  }
}

loadEnvFile();
initRelayFromEnv();

const clientId = process.env.FATSECRET_CLIENT_ID?.trim();
const clientSecret = process.env.FATSECRET_CLIENT_SECRET?.trim();
const q = (process.argv[2] || 'chicken').trim();

console.log('=== Test FatSecret ===');
console.log('Búsqueda:', JSON.stringify(q));
if (relayBase) {
  console.log('Modo: RELAY →', relayBase, '(como la Edge Function de Supabase)');
} else {
  console.log('Modo: DIRECTO a FatSecret (sin FATSECRET_RELAY_URL en .env)');
}

if (!clientId || !clientSecret) {
  console.error(
    '\nFaltan FATSECRET_CLIENT_ID y/o FATSECRET_CLIENT_SECRET en el entorno o en .env\n',
  );
  process.exit(1);
}

console.log(
  '(diagnóstico) longitudes: client_id=',
  clientId.length,
  'chars, client_secret=',
  clientSecret.length,
  'chars (comprueba con el panel de FatSecret)',
);

console.log('\n1) OAuth2 client_credentials (scope=basic)…');
const tok = await oauthToken(clientId, clientSecret);
if (!tok.ok || !tok.json?.access_token) {
  console.error('Token HTTP', tok.status);
  console.error(tok.json ?? tok.text?.slice(0, 800));
  if (tok.json?.error === 'invalid_client') {
    console.error(
      '\n>>> invalid_client = FatSecret rechaza client_id/client_secret en la petición.\n' +
        '>>> No es el RELAY_SECRET. Revisa que .env tenga el Consumer Key y Consumer Secret\n' +
        '>>> exactos del portal (sin espacios, sin comillas dentro del valor).\n' +
        '>>> Deben ser los MISMOS que en Supabase secrets FATSECRET_CLIENT_ID / _SECRET.\n' +
        '>>> Prueba sin relay: quita FATSECRET_RELAY_URL del .env y ejecuta de nuevo;\n' +
        '>>> si con directo obtienes token, compara credenciales.\n',
    );
  }
  process.exit(1);
}
console.log('OK, access_token recibido (longitud', tok.json.access_token.length, ')');

const { region: fsRegion, language: fsLanguage } = fatsecretLocaleParams();
const params = new URLSearchParams({
  search_expression: q,
  max_results: '20',
  format: 'json',
});
if (fsRegion) params.set('region', fsRegion);
if (fsLanguage) params.set('language', fsLanguage);
console.log('Localización FatSecret:', fsRegion || '(sin region)', fsLanguage || '(sin language)');

const accessToken = tok.json.access_token;

console.log('\n2) GET /rest/foods/search/v3 …');
const v3 = await searchGet(
  `https://platform.fatsecret.com/rest/foods/search/v3?${params}`,
  accessToken,
);
console.log('HTTP', v3.status, 'body length', v3.textLength);
summarizePayload('v3', v3.json);

console.log('\n3) GET /rest/foods/search/v1 …');
const v1 = await searchGet(
  `https://platform.fatsecret.com/rest/foods/search/v1?${params}`,
  accessToken,
);
console.log('HTTP', v1.status, 'body length', v1.textLength);
summarizePayload('v1', v1.json);

console.log('\n4) POST /rest/server.api method=foods.search …');
const post = await searchPostServerApi(accessToken, q);
console.log('HTTP', post.status, 'body length', post.textLength);
summarizePayload('server.api', post.json);

console.log('\n=== Fin ===');
