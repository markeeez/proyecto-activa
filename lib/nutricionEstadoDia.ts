/**
 * Estado nutricional de un dia segun calorias consumidas vs. objetivo.
 *
 * Rangos (mismos del calendario):
 *   - dentro: entre el 95% y el 105% del objetivo
 *   - cerca: por debajo del 95% o entre el 105% y el 115%
 *   - sobre: por encima del 115%
 *
 * Si no hay objetivo (usuario sin metas) o consumido es 0, se considera `sinDatos`.
 *
 * Pura: no depende de React, sin efectos. Facil de testear.
 */

export type EstadoDiaNutricion = 'dentro' | 'cerca' | 'sobre' | 'sinDatos';

const LIMITE_DENTRO_INFERIOR = 0.95;
const LIMITE_DENTRO_SUPERIOR = 1.05;
const LIMITE_SOBRE_SUPERIOR = 1.15;

export function calcularEstadoDia(
  consumido: number | null | undefined,
  objetivo: number | null | undefined,
): EstadoDiaNutricion {
  // Sin objetivo no podemos clasificar.
  if (!objetivo || objetivo <= 0) return 'sinDatos';
  // Sin consumo registrado para el dia -> punto gris.
  if (!consumido || consumido <= 0) return 'sinDatos';

  const ratio = consumido / objetivo;

  // Dentro: ventana centrada en el objetivo (ej. 1900-2100 kcal si el objetivo es 2000).
  if (ratio >= LIMITE_DENTRO_INFERIOR && ratio <= LIMITE_DENTRO_SUPERIOR) return 'dentro';
  // Pasado: exceso claro por encima del objetivo (ej. >2300 kcal si el objetivo es 2000).
  if (ratio > LIMITE_SOBRE_SUPERIOR) return 'sobre';
  // Cerca: por debajo del rango verde o exceso moderado.
  return 'cerca';
}
