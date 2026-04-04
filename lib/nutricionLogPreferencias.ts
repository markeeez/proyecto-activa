import AsyncStorage from '@react-native-async-storage/async-storage';

const keyOrden = (userId: string, fechaIso: string) => `activa_meal_order_${userId}_${fechaIso}`;

export async function obtenerOrdenComidas(userId: string, fechaIso: string): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(keyOrden(userId, fechaIso));
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as string[]) : null;
  } catch {
    return null;
  }
}

/** Guarda orden de nutrition_log_meals.id para el día. */
export async function guardarOrdenComidas(
  userId: string,
  fechaIso: string,
  mealIds: string[],
): Promise<void> {
  await AsyncStorage.setItem(keyOrden(userId, fechaIso), JSON.stringify(mealIds));
}
