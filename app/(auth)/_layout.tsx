/**
 * AUTH LAYOUT
 *
 * Stack de pantallas para usuarios no autenticados.
 * Si el usuario ya tiene sesión, el index.tsx raíz redirige
 * antes de llegar aquí.
 *
 * Pantallas:
 *   iniciar-sesion       → login con email/contraseña
 *   registrarse          → registro con email/contraseña
 *   recuperar-contrasena → solicitar email de recuperación
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function AuthLayout() {
  return (
    <>
      {/* Siempre light (texto blanco) en auth: fondo siempre negro */}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="iniciar-sesion" />
        <Stack.Screen name="registrarse" />
        <Stack.Screen name="recuperar-contrasena" />
        <Stack.Screen name="restablecer-contrasena" />
        <Stack.Screen name="confirmar-email" />
      </Stack>
    </>
  );
}
