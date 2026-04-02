/**
 * IA — Stack layout
 *
 * Pantallas dentro del tab de IA:
 *
 *   index   → chat general con el asistente (contexto_tipo: 'general')
 *
 * Nota: los chats contextuales (ligados a un log o sesión) se abren
 * como modales desde sus respectivas pantallas, no desde este tab.
 */

import { Stack } from 'expo-router';

export default function IALayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Asistente IA' }} />
    </Stack>
  );
}
