import AsyncStorage from '@react-native-async-storage/async-storage';

const keyOrden = (userId: string) => `activa_meal_order_${userId}`;

export async function obtenerOrdenComidas(userId: string): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(keyOrden(userId));
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as string[]) : null;
  } catch {
    return null;
  }
}

export async function guardarOrdenComidas(userId: string, mealTypeIds: string[]): Promise<void> {
  await AsyncStorage.setItem(keyOrden(userId), JSON.stringify(mealTypeIds));
}
