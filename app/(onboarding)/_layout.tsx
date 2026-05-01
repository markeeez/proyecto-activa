/**
 * ONBOARDING LAYOUT
 *
 * Flujo lineal de 2 pasos que se muestra solo cuando el usuario
 * no tiene user_goals (primera vez en la app).
 *
 *   1. datos     → datos corporales y nivel de actividad
 *   2. objetivo  → objetivo nutricional, macros, avatar y guardado
 *
 * Una vez completado, redirige a (tabs).
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="datos" />
      <Stack.Screen name="objetivo" />
    </Stack>
  );
}
