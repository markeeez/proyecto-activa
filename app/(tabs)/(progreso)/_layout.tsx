/**
 * PROGRESO — Stack layout
 *
 *   index                    → dashboard progreso (nutrición, peso, accesos)
 *   historial-peso           → historial de peso (placeholder)
 *   estadisticas-ejercicio   → estadísticas de ejercicio (placeholder, PARTE 2)
 */

import { Stack } from 'expo-router';

export default function ProgresoLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="historial-peso" options={{ headerShown: false }} />
      <Stack.Screen name="estadisticas-ejercicio" options={{ headerShown: false }} />
      <Stack.Screen name="personalizar-plan" options={{ headerShown: false }} />
    </Stack>
  );
}
