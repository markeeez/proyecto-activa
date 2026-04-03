/**
 * NUTRICIÓN — Stack layout
 *
 * Pantallas dentro del tab de nutrición:
 *
 *   index           → log diario (pantalla principal)
 *   agregar         → buscar y añadir alimentos al log
 *   alimento/[id]   → detalle de un alimento (macros completos)
 */

import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ComidaPortapapelesProvider } from '@/context/ComidaPortapapelesContext';

export default function NutricionLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <ComidaPortapapelesProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="agregar"
            options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade' }}
          />
          <Stack.Screen name="alimento/[id]" options={{ title: 'Alimento' }} />
        </Stack>
      </ComidaPortapapelesProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
