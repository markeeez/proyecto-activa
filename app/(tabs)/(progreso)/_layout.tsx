/**
 * PROGRESO — Stack layout
 *
 * Pantallas dentro del tab de progreso:
 *
 *   index   → dashboard con gráficos de métricas corporales y nutrición
 */

import { Stack } from 'expo-router';

export default function ProgresoLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Progreso' }} />
    </Stack>
  );
}
