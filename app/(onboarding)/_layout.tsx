import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Flujo lineal del onboarding (6 pasos):
 *   1. objetivo      -> objetivo principal
 *   2. datos         -> datos corporales básicos
 *   3. actividad     -> nivel de actividad
 *   4. plan          -> resumen del plan (kcal + macros)
 *   5. foto-perfil   -> avatar opcional
 *   6. descanso      -> preferencia descanso + guardado final
 *
 * Bloqueamos el gesto de swipe-back en iOS y el botón físico de Android en
 * el primer paso para evitar dejar el flujo en estado inconsistente.
 */
export default function OnboardingLayout() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="objetivo" />
      <Stack.Screen name="datos" />
      <Stack.Screen name="actividad" />
      <Stack.Screen name="plan" />
      <Stack.Screen name="foto-perfil" />
      <Stack.Screen name="descanso" />
    </Stack>
  );
}
