/**
 * Prueba local de USDA FoodData Central (mismo criterio que la app: Foundation, pageSize 10).
 *
 * En `.env`:
 *   EXPO_PUBLIC_USDA_FDC_API_KEY=...
 *
 * Uso:
 *   node scripts/test-usda.mjs
 *   node scripts/test-usda.mjs chicken
 *   npm run test:usda
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

function nutrientMapFromRows(rows) {
  const m = new Map();
  if (!Array.isArray(rows)) return m;
  for (const r of rows) {
    const id =
      typeof r.nutrientId === 'number'
        ? r.nutrientId
        : typeof r.nutrient?.id === 'number'
          ? r.nutrient.id
          : undefined;
    const val =
      typeof r.value === 'number'
        ? r.value
        : typeof r.amount === 'number'
          ? r.amount
          : undefined;
    if (id != null && val != null && Number.isFinite(val)) m.set(id, val);
  }
  return m;
}

function pickMacros(map) {
  return {
    kcal_1008: map.get(1008),
    protein_1003: map.get(1003),
    carb_1005: map.get(1005),
    fat_1004: map.get(1004),
    fiber_1079: map.get(1079),
  };
}

loadEnvFile();

const apiKey =
  process.env.EXPO_PUBLIC_USDA_FDC_API_KEY?.trim() ||
  process.env.USDA_FDC_API_KEY?.trim() ||
  '';
const query = (process.argv[2] || 'chicken').trim().slice(0, 200);

console.log('=== Test USDA FoodData Central ===');
console.log('Query (inglés recomendado):', JSON.stringify(query));
console.log('Variable env: EXPO_PUBLIC_USDA_FDC_API_KEY o USDA_FDC_API_KEY');

if (!apiKey) {
  console.error(
    '\nFalta la clave. Añade EXPO_PUBLIC_USDA_FDC_API_KEY en .env\n' +
      'Registro: https://fdc.nal.usda.gov/api-key-signup.html\n',
  );
  process.exit(1);
}

const searchUrl =
  'https://api.nal.usda.gov/fdc/v1/foods/search?' +
  new URLSearchParams({
    api_key: apiKey,
    query,
    dataType: 'Foundation',
    pageSize: '10',
  }).toString();

console.log('\n1) GET foods/search (Foundation, pageSize=10)…');
const searchRes = await fetch(searchUrl);
const searchText = await searchRes.text();
let searchJson;
try {
  searchJson = JSON.parse(searchText);
} catch {
  console.error('No es JSON. HTTP', searchRes.status, searchText.slice(0, 500));
  process.exit(1);
}

console.log('HTTP', searchRes.status);
if (!searchRes.ok) {
  console.error(JSON.stringify(searchJson, null, 2).slice(0, 2000));
  process.exit(1);
}

const foods = Array.isArray(searchJson.foods) ? searchJson.foods : [];
console.log('totalHits:', searchJson.totalHits ?? '(n/a)');
console.log('foods en esta página:', foods.length);

for (let i = 0; i < Math.min(foods.length, 10); i++) {
  const f = foods[i];
  const map = nutrientMapFromRows(f.foodNutrients);
  const mac = pickMacros(map);
  console.log(`\n  [${i + 1}] fdcId=${f.fdcId} dataType=${f.dataType}`);
  console.log('      description:', (f.description ?? '').slice(0, 120));
  console.log('      nutrientes (búsqueda):', mac);
  if (mac.kcal_1008 == null && f.fdcId) {
    const detailUrl = `https://api.nal.usda.gov/fdc/v1/food/${f.fdcId}?api_key=${encodeURIComponent(apiKey)}`;
    const dr = await fetch(detailUrl);
    if (dr.ok) {
      const dj = await dr.json();
      const dm = nutrientMapFromRows(dj.foodNutrients);
      console.log('      nutrientes (detalle /food/{id}):', pickMacros(dm));
    } else {
      console.log('      detalle HTTP', dr.status);
    }
  }
}

const preview = JSON.stringify(searchJson, null, 2);
const max = 8000;
if (preview.length > max) {
  console.log(
    `\nJSON búsqueda (primeros ${max} chars):\n${preview.slice(0, max)}\n… [total ${preview.length}]`,
  );
} else {
  console.log('\nJSON búsqueda completo:\n', preview);
}

console.log('\n=== Fin ===');
