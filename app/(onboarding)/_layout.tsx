/**
 * ONBOARDING LAYOUT
 *
 * Flujo lineal que se muestra solo una vez tras el primer registro.
 * Una vez completado, el campo onboarding_completado en profiles (o
 * lógica equivalente) redirige al usuario a (tabs) en futuros inicios.
 *
 * Pasos (legacy, pantallas intactas):
 *   1. bienvenida      → presentación de la app
 *   2. objetivos       → configurar user_goals (calorías y macros)
 *   3. metricas        → registrar métricas iniciales en user_body_metrics
 *
 * Flujo actual si falta user_goals: datos → objetivo → (tabs)
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="bienvenida" />
      <Stack.Screen name="objetivos" />
      <Stack.Screen name="metricas" />
      <Stack.Screen name="datos" />
      <Stack.Screen name="objetivo" />
    </Stack>
  );
}
