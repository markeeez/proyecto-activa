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
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { BarraEntrenoMinimizado } from '@/components/entrenamiento/BarraEntrenoMinimizado';
import { useEntreno } from '@/context/EntrenoContext';
import { useTheme } from '@/hooks/useTheme';

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
  const { c } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <TabBarWithEntreno {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.textDisplay,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: 'SpaceMono_400Regular',
          fontSize: 9,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="(nutricion)"
        options={{
          title: 'Nutrición',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(entrenamiento)"
        options={{
          title: 'Entreno',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(progreso)"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(ia)"
        options={{
          title: 'IA',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(perfil)"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
