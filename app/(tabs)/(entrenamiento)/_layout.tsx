/**
 * ENTRENAMIENTO — Stack layout
 *
 * Pantallas dentro del tab de entrenamiento:
 *
 *   index              → pantalla principal: sesiones del día + acceso al historial
 *   nueva-sesion       → modal para iniciar una nueva sesión
 *   sesion/[id]        → sesión activa o pasada con sus ejercicios y series
 *   ejercicio/[id]     → detalle de un ejercicio (músculos, descripción, historial)
 *   crear-rutina       → formulario crear rutina (modal pantalla completa)
 *   rutina/[id]       → detalle y edición de rutina
 */

import { Stack } from 'expo-router';

export default function EntrenamientoLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="crear-rutina"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="entreno-activo"
        options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
      />
      <Stack.Screen name="rutina/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="consulta-ejercicio" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="nueva-sesion" options={{ title: 'Nueva sesión', presentation: 'modal' }} />
      <Stack.Screen name="ejercicio/[id]" options={{ title: 'Ejercicio' }} />
    </Stack>
  );
}
