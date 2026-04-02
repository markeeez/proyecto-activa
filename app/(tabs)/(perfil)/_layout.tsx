/**
 * PERFIL — Stack layout
 *
 * Pantallas dentro del tab de perfil:
 *
 *   index     → resumen del perfil y acceso a subsecciones
 *   editar    → modificar nombre, apellidos, username
 *   objetivos → editar user_goals (calorías y macros)
 *   plan      → ver plan actual y opciones de upgrade
 *   ajustes   → preferencias de la app
 */

import { Stack } from 'expo-router';

export default function PerfilLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Perfil' }} />
      <Stack.Screen name="editar" options={{ title: 'Editar perfil' }} />
      <Stack.Screen name="objetivos" options={{ title: 'Mis objetivos' }} />
      <Stack.Screen name="plan" options={{ title: 'Mi plan' }} />
      <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
    </Stack>
  );
}
