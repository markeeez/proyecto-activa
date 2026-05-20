/**
 * TABS LAYOUT — App principal
 *
 * Barra de navegación inferior con 5 tabs:
 *
 *   1. Nutrición     → log diario de comidas
 *   2. Entrenamiento → sesiones de gym
 *   3. Progreso      → métricas corporales y gráficos
 *   4. Perfil        → datos de usuario, plan y ajustes
 *
 * Cada tab tiene su propio Stack interno para gestionar
 * pantallas de detalle sin perder el contexto del tab.
 */

import { View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import FoodNavIcon from '@/assets/images/nav-icons/food_nav_icon_v2.svg';
import HomeNavIcon from '@/assets/images/nav-icons/home_nav_icon.svg';
import MoreNavIcon from '@/assets/images/nav-icons/more_nav_icon.svg';
import WorkoutNavIcon from '@/assets/images/nav-icons/workout_nav_dumbbell.svg';
import { BarraEntrenoMinimizado } from '@/components/entrenamiento/BarraEntrenoMinimizado';
import { useEntreno } from '@/context/EntrenoContext';

import { TabBarActivia } from '@/components/navigation/TabBarActivia';

function TabBarWithEntreno(props: BottomTabBarProps) {
  const { entrenoActivo } = useEntreno();
  const pathname = usePathname();
  const enEntrenoActivo = pathname.includes('entreno-activo');
  return (
    <View>
      {entrenoActivo != null && !enEntrenoActivo ? <BarraEntrenoMinimizado /> : null}
      <TabBarActivia {...props} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBarWithEntreno {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Posición 0 — Inicio (Home) */}
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Inicio',
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <HomeNavIcon width={size} height={size} color={color} />
          ),
        }}
      />
      {/* index heredado — excluido del tab bar */}
      <Tabs.Screen name="index" options={{ href: null } as any} />
      {/* Posición 1 — Alimentación */}
      <Tabs.Screen
        name="(nutricion)"
        options={{
          title: 'Alimentación',
          tabBarLabel: 'Alimentación',
          tabBarIcon: ({ color, size }) => (
            <FoodNavIcon width={size} height={size} color={color} />
          ),
        }}
      />
      {/* IA: ruta conservada, pero oculta en la edición free */}
      <Tabs.Screen
        name="(ia)"
        options={{
          title: 'IA',
          tabBarLabel: 'IA',
          tabBarIcon: () => null,
          href: null,
        }}
      />
      {/* Posición 2 — Entreno */}
      <Tabs.Screen
        name="(entrenamiento)"
        options={{
          title: 'Entreno',
          tabBarLabel: 'Entreno',
          tabBarIcon: ({ color, size }) => (
            <WorkoutNavIcon width={size} height={size} color={color} />
          ),
        }}
      />
      {/* Posición 3 — Más */}
      <Tabs.Screen
        name="(perfil)"
        options={{
          title: 'Más',
          tabBarLabel: 'Más',
          tabBarIcon: ({ color, size }) => (
            <MoreNavIcon width={size} height={size} color={color} />
          ),
        }}
      />
      {/* Progreso: ruta existente, excluida del tab bar */}
      <Tabs.Screen
        name="(progreso)"
        options={{ href: null } as any}
      />
    </Tabs>
  );
}
