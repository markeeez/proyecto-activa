/**
 * Prueba Open Food Facts alineada con la app:
 * - País España (search.pl o v2 + countries_tags)
 * - El nombre debe contener algún token de búsqueda (no avena si buscas «pollo»)
 *
 * Uso:
 *   npm run test:openfoodfacts
 *   node scripts/test-openfoodfacts.mjs pollo
 *   node scripts/test-openfoodfacts.mjs pollo --v2
 */

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'y', 'o', 'a', 'en', 'con', 'por', 'para',
  'un', 'una', 'unos', 'unas', 'al',
]);

function tokensForMatching(normalizedQuery) {
  const core = normalizedQuery
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t));
  if (core.length > 0) return core;
  return normalizedQuery.split(/\s+/).filter((t) => t.length > 1);
}

function kcalDesdeNutriments(nm) {
  if (!nm || typeof nm !== 'object') return 0;
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

function vendeEnEspana(p) {
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

function offNombreIncluyeAlgunToken(p, tokens) {
  if (!tokens.length) return false;
  const nombreEs = String(p.product_name_es ?? '').trim();
  const nombre = (nombreEs || String(p.product_name ?? '')).trim();
  const nName = normalizeText(nombre);
  return tokens.some((tok) => tok.length > 1 && nName.includes(tok));
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const args = process.argv.slice(2).filter((a) => a !== '--v2');
const forceV2 = process.argv.includes('--v2');
const query = (args[0] || 'pollo').trim().slice(0, 200);
const pageSize = 10;
const normalizedQuery = normalizeText(query);
const matchTokens = tokensForMatching(normalizedQuery);

const qEnc = encodeURIComponent(query);
const fieldsBasic = 'code,product_name,product_name_es,nutriments';
const fieldsV2 = 'code,product_name,product_name_es,nutriments,countries_tags,countries';

const urlSearchPl =
  `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${qEnc}` +
  `&search_simple=1&action=process&json=1&page_size=${pageSize}` +
  `&tagtype_0=countries&tag_contains_0=contains&tag_0=Spain` +
  `&fields=${fieldsBasic}`;

async function trySearchPl() {
  const res = await fetch(urlSearchPl);
  const text = await res.text();
  const j = parseJsonResponse(text);
  if (res.ok && j && Array.isArray(j.products)) {
    const rel = j.products.filter((p) => offNombreIncluyeAlgunToken(p, matchTokens));
    return {
      ok: true,
      json: { ...j, products: rel },
      label: 'search.pl (Spain) + nombre contiene token',
    };
  }
  return {
    ok: false,
    status: res.status,
    head: text.trimStart().slice(0, 100).replace(/\s+/g, ' '),
  };
}

async function tryV2SpainYTokenEnNombre() {
  const perPage = 40;
  const maxPages = 10;
  const targetPool = 80;
  const fields = encodeURIComponent(fieldsV2);
  const bases = [
    'https://es.openfoodfacts.org/api/v2/search',
    'https://world.openfoodfacts.org/api/v2/search',
  ];
  const collected = [];
  const seen = new Set();

  for (const base of bases) {
    for (let page = 1; page <= maxPages && collected.length < targetPool; page++) {
      const u = `${base}?search_terms=${qEnc}&page=${page}&page_size=${perPage}&fields=${fields}`;
      const res = await fetch(u);
      const text = await res.text();
      const j = parseJsonResponse(text);
      if (!res.ok || !j || !Array.isArray(j.products)) continue;
      const raw = j.products;
      if (raw.length === 0) break;
      for (const p of raw) {
        if (!vendeEnEspana(p)) continue;
        if (!offNombreIncluyeAlgunToken(p, matchTokens)) continue;
        const code = String(p.code ?? '');
        if (!code || seen.has(code)) continue;
        seen.add(code);
        collected.push(p);
      }
      if (raw.length < perPage) break;
    }
    if (collected.length > 0) break;
  }

  if (collected.length === 0) return { ok: false };
  return {
    ok: true,
    json: { products: collected, page_count: collected.length },
    label: 'API v2 paginada (España + token en nombre)',
  };
}

console.log('=== Test Open Food Facts (España + relevancia nombre) ===');
console.log('Búsqueda:', JSON.stringify(query));
console.log('Tokens que deben aparecer en el nombre:', matchTokens.join(', ') || '(vacío)');
if (matchTokens.length === 0) {
  console.error('Sin tokens válidos para filtrar.');
  process.exit(1);
}

let json = null;
let used = '';

if (!forceV2) {
  console.log('\n1) search.pl + Spain + filtro nombre…');
  const r = await trySearchPl();
  if (r.ok) {
    json = r.json;
    used = r.label;
    console.log('OK — productos relevantes:', json.products.length);
  } else {
    console.log('Falló. HTTP', r.status, r.head);
  }
}

if (!json?.products?.length) {
  console.log('\n2) API v2 paginada (España + token en nombre)…');
  const r = await tryV2SpainYTokenEnNombre();
  if (r.ok) {
    json = r.json;
    used = r.label;
    console.log('OK —', used);
    console.log('Productos:', json.products.length);
  } else {
    console.error(
      '\nSin resultados: ningún producto en España con el término en el nombre (prueba otra palabra o más tarde).',
    );
    process.exit(1);
  }
}

const products = json.products.slice(0, pageSize);

for (let i = 0; i < products.length; i++) {
  const p = products[i];
  const nombreEs = String(p.product_name_es ?? '').trim();
  const nombre = (nombreEs || String(p.product_name ?? '')).trim();
  const code = p.code != null ? String(p.code) : '';
  const nm = p.nutriments ?? {};
  const kcal = kcalDesdeNutriments(nm);
  console.log(`\n  [${i + 1}] code=${code}`);
  console.log('      nombre:', nombre.slice(0, 100));
  console.log('      kcal:', kcal || '(0 / sin dato)');
}

const full = JSON.stringify({ ...json, products }, null, 2);
const max = 9000;
if (full.length > max) {
  console.log(
    `\nJSON (primeros ${max} chars):\n${full.slice(0, max)}\n… [total ${full.length}]`,
  );
} else {
  console.log('\nJSON (muestra):\n', full);
}

console.log('\n=== Fin ===');
