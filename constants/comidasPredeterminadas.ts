/**
 * Las 4 comidas predeterminadas por día (solo constante de app; se insertan en nutrition_log_meals al crear el día).
 */

export const MEAL_SLOT_KEYS = ['breakfast', 'lunch', 'merienda', 'dinner'] as const;
export type MealSlotKey = (typeof MEAL_SLOT_KEYS)[number];

export interface ComidaDefaultDef {
  slot: MealSlotKey;
  nombre: string;
  orden: number;
}

export const COMIDAS_PREDETERMINADAS: ComidaDefaultDef[] = [
  { slot: 'breakfast', nombre: 'Desayuno', orden: 1 },
  { slot: 'lunch', nombre: 'Almuerzo', orden: 2 },
  { slot: 'merienda', nombre: 'Merienda', orden: 3 },
  { slot: 'dinner', nombre: 'Cena', orden: 4 },
];
