/**
 * Estado nutricional de un día según calorías consumidas vs. objetivo.
 *
 * Rangos (mismos del calendario):
 *   - dentro:   |consumido - objetivo| <= 10% del objetivo
 *   - cerca:    consumido > objetivo + 10%   y   consumido <= objetivo + 25%
 *   - sobre:    consumido > objetivo + 25%
 *
 * Si no hay objetivo (usuario sin metas) o consumido es 0, se considera `sinDatos`.
 *
 * Pura: no depende de React, sin efectos. Fácil de testear.
 */

export type EstadoDiaNutricion = 'dentro' | 'cerca' | 'sobre' | 'sinDatos';

export function calcularEstadoDia(
  consumido: number | null | undefined,
  objetivo: number | null | undefined,
): EstadoDiaNutricion {
  // Sin objetivo no podemos clasificar.
  if (!objetivo || objetivo <= 0) return 'sinDatos';
  // Sin consumo registrado para el día → punto gris.
  if (!consumido || consumido <= 0) return 'sinDatos';

  const ratio = consumido / objetivo;

  // Dentro: 0 a 110% del objetivo (incluye haber comido menos del objetivo).
  if (ratio <= 1.1) return 'dentro';
  // Cerca del límite: entre +10% y +25%.
  if (ratio <= 1.25) return 'cerca';
  // Pasado: +25%.
  return 'sobre';
}
