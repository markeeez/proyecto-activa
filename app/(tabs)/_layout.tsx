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

import { View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { BarraEntrenoMinimizado } from '@/components/entrenamiento/BarraEntrenoMinimizado';
import { useEntreno } from '@/context/EntrenoContext';

function TabBarWithEntreno(props: BottomTabBarProps) {
  const { entrenoActivo } = useEntreno();
  const pathname = usePathname();
  const enEntrenoActivo = pathname.includes('entreno-activo');
  return (
    <View>
      {entrenoActivo != null && !enEntrenoActivo ? <BarraEntrenoMinimizado /> : null}
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBarWithEntreno {...props} />}
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
