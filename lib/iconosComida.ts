import { Ionicons } from '@expo/vector-icons';

export type IconoComida = keyof (typeof Ionicons)['glyphMap'];

const ICONOS_COMIDAS_DEFAULT: Record<string, IconoComida> = {
  desayuno: 'cafe-outline',
  almuerzo: 'sunny-outline',
  merienda: 'restaurant-outline',
  cena: 'moon-outline',
};

export function iconoComida(nombre: string, isDefault: boolean): IconoComida {
  if (!isDefault) return 'nutrition-outline';
  return ICONOS_COMIDAS_DEFAULT[nombre.toLowerCase().trim()] ?? 'nutrition-outline';
}
