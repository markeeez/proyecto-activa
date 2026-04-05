/**
 * Redirección: el flujo de nueva sesión vive en RutinasListadoTab + EntrenoContext.
 */

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function NuevaSesion() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/(entrenamiento)');
  }, [router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
