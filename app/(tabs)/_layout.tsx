/**
 * TABS LAYOUT — App principal
 *
 * Barra de navegación inferior con 5 tabs:
 *
 *   1. Nutrición     → log diario de comidas
 *   2. Entrenamiento → sesiones de gym
 *   3. Progreso      → métricas corporales y gráficos
 *   4. IA            → chat general con el asistente
 *   5. Perfil        → datos de usuario, plan y ajustes
 *
 * Cada tab tiene su propio Stack interno para gestionar
 * pantallas de detalle sin perder el contexto del tab.
 */

import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // TODO: personalizar colores con constantes/colores.ts
        // TODO: añadir iconos SVG/Ionicons por tab
      }}
    >
      <Tabs.Screen
        name="(nutricion)"
        options={{ title: 'Nutrición' }}
      />
      <Tabs.Screen
        name="(entrenamiento)"
        options={{ title: 'Entreno' }}
      />
      <Tabs.Screen
        name="(progreso)"
        options={{ title: 'Progreso' }}
      />
      <Tabs.Screen
        name="(ia)"
        options={{ title: 'IA' }}
      />
      <Tabs.Screen
        name="(perfil)"
        options={{ title: 'Perfil' }}
      />
    </Tabs>
  );
}
