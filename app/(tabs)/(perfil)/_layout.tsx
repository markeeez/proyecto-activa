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
      <Stack.Screen name="cambiar-email" options={{ title: 'Cambiar email' }} />
      <Stack.Screen name="cambiar-contrasena" options={{ title: 'Cambiar contraseña' }} />
      <Stack.Screen name="perfil-ejercicios" options={{ title: 'Mis ejercicios' }} />
      <Stack.Screen name="perfil-entrenos" options={{ title: 'Mis entrenos' }} />
      <Stack.Screen name="records" options={{ headerShown: false }} />
      <Stack.Screen name="consulta-ejercicio" options={{ headerShown: false }} />
      <Stack.Screen name="sesion/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
