/**
 * Script de prueba de APIs de alimentos.
 * Ejecutar desde la raíz del proyecto:
 *   node test-apis.mjs
 */

const USDA_KEY = 'oy1HvWlznAr5DlUkfZjq8vLyZIu0v9rGAaJaDaNm';
const QUERY_ES = 'pollo';
const QUERY_EN = 'chicken';

async function testUSDA() {
  console.log('\n======= USDA FoodData Central =======');
  console.log(`Buscando: "${QUERY_EN}"`);
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(QUERY_EN)}&api_key=${USDA_KEY}&dataType=Foundation,SR%20Legacy&pageSize=10`;
    const res = await fetch(url);
    console.log('HTTP Status:', res.status);
    if (!res.ok) {
      console.log('Error:', await res.text());
      return;
    }
    const data = await res.json();
    const foods = data.foods ?? [];
    console.log(`Resultados: ${foods.length}`);
    for (const f of foods.slice(0, 10)) {
      const nutrients = {};
      for (const n of f.foodNutrients ?? []) {
        nutrients[n.nutrientId] = n.value;
      }
      console.log(`  [${f.dataType}] ${f.description}`);
      console.log(`    Kcal: ${nutrients[1008] ?? 'N/A'} | Prot: ${nutrients[1003] ?? 'N/A'} | Carb: ${nutrients[1005] ?? 'N/A'} | Grasa: ${nutrients[1004] ?? 'N/A'}`);
    }
  } catch (e) {
    console.log('USDA falló:', e.message);
  }
}

async function testOpenFoodFacts() {
  console.log('\n======= Open Food Facts (ES) =======');
  console.log(`Buscando: "${QUERY_ES}"`);
  try {
    const url = `https://es.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(QUERY_ES)}&page_size=10&fields=code,product_name,product_name_es,generic_name_es,nutriments`;
    const res = await fetch(url);
    console.log('HTTP Status:', res.status);
    if (!res.ok) {
      console.log('Error:', await res.text());
      return;
    }
    const data = await res.json();
    const products = data.products ?? [];
    console.log(`Resultados: ${products.length}`);
    for (const p of products.slice(0, 10)) {
      const nombre = p.product_name_es ?? p.product_name ?? p.generic_name_es ?? '(sin nombre)';
      const n = p.nutriments ?? {};
      console.log(`  ${nombre}`);
      console.log(`    Kcal: ${n['energy-kcal_100g'] ?? 'N/A'} | Prot: ${n['proteins_100g'] ?? 'N/A'} | Carb: ${n['carbohydrates_100g'] ?? 'N/A'} | Grasa: ${n['fat_100g'] ?? 'N/A'}`);
    }
  } catch (e) {
    console.log('Open Food Facts falló:', e.message);
  }
}

await testUSDA();
await testOpenFoodFacts();
