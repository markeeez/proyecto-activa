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
import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'nutrition' : 'nutrition-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* Posición 2 — IA (centro oculto bajo el FAB; onFabPress navega aquí) */}
      <Tabs.Screen
        name="(ia)"
        options={{
          title: 'IA',
          tabBarLabel: 'IA',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* Posición 3 — Entreno */}
      <Tabs.Screen
        name="(entrenamiento)"
        options={{
          title: 'Entreno',
          tabBarLabel: 'Entreno',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* Posición 4 — Más */}
      <Tabs.Screen
        name="(perfil)"
        options={{
          title: 'Más',
          tabBarLabel: 'Más',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'} size={24} color={color} />
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
