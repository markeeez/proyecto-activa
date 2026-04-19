/**
 * Normalización de texto para búsquedas: minúsculas y sin tildes/diacríticos.
 * ñ → n, ü → u, etc. (NFD + quitar marcas combinantes).
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Palabras no vacías separadas por espacios (sin normalizar). */
export function palabrasBusqueda(texto: string): string[] {
  return texto
    .trim()
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Evita que `%` y `_` actúen como comodines en patrones `ilike`. */
export function sanitizarFragmentoIlike(fragmento: string): string {
  return fragmento.replace(/[%_\\]/g, '');
}

/**
 * Comprueba que el nombre normalizado contenga todas las palabras (AND).
 * Usar con `palabras` ya normalizadas con `normalizarTexto` por token.
 */
export function nombreContieneTodasLasPalabras(
  nombre: string,
  palabrasNormalizadas: string[],
): boolean {
  if (palabrasNormalizadas.length === 0) return true;
  const n = normalizarTexto(nombre);
  return palabrasNormalizadas.every((w) => w.length > 0 && n.includes(w));
}

/** Palabra más larga como ancla para un `ilike` amplio (mejor selectividad). */
export function elegirAnclajeBusqueda(palabrasNorm: string[]): string | null {
  if (palabrasNorm.length === 0) return null;
  const validas = palabrasNorm.filter((w) => w.length > 0);
  if (validas.length === 0) return null;
  return [...validas].sort((a, b) => b.length - a.length)[0] ?? null;
}
