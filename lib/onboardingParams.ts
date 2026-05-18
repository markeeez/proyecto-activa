/**
 * Helpers para leer params de Expo Router en el flujo de onboarding.
 *
 * Expo Router puede entregar un valor `string | string[] | undefined`.
 * Estos helpers normalizan a `string | undefined` y validan rangos para
 * evitar que un usuario llegue a la pantalla final con datos inválidos
 * tras una navegación atípica.
 */

export type ObjetivoUi = 'perder' | 'mantener' | 'ganar';
export type GeneroOnboarding = 'hombre' | 'mujer';

export function leerParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

export function leerNumero(value: string | string[] | undefined): number | null {
  const raw = leerParam(value);
  if (raw == null) return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function leerObjetivoUi(value: string | string[] | undefined): ObjetivoUi | undefined {
  const raw = leerParam(value);
  if (raw === 'perder' || raw === 'mantener' || raw === 'ganar') return raw;
  return undefined;
}

export function leerGenero(value: string | string[] | undefined): GeneroOnboarding | undefined {
  const raw = leerParam(value);
  if (raw === 'hombre' || raw === 'mujer') return raw;
  return undefined;
}
