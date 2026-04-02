/**
 * NUTRICIÓN — Stack layout
 *
 * Pantallas dentro del tab de nutrición:
 *
 *   index           → log diario (pantalla principal)
 *   agregar         → buscar y añadir alimentos al log
 *   alimento/[id]   → detalle de un alimento (macros completos)
 */

import { Stack } from 'expo-router';

export default function NutricionLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="agregar"
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade' }}
      />
      <Stack.Screen name="alimento/[id]" options={{ title: 'Alimento' }} />
    </Stack>
  );
}
