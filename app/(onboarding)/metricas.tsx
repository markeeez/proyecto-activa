/**
 * PANTALLA: Métricas corporales (Onboarding paso 3/3)
 *
 * El usuario introduce sus datos físicos iniciales.
 * Se guarda el primer registro en user_body_metrics.
 *
 * Datos que genera:
 *   user_body_metrics {
 *     peso_kg: number
 *     altura_cm: number
 *     grasa_corporal?: number   (opcional)
 *     fecha: hoy
 *   }
 *
 * Acciones:
 *   - perfil.service.ts → registrarMetricasCorporales()
 *   - En éxito: redirige a la app principal
 *
 * Navegación:
 *   - ← objetivos
 *   - → /(tabs)/(nutricion) (fin del onboarding)
 */

import { Text, View, StyleSheet } from 'react-native';

export default function Metricas() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Tus medidas</Text>
      <Text style={styles.descripcion}>
        Solo lo usamos para calcular mejor tus necesidades calóricas.
      </Text>

      {/* TODO: Input peso (kg) con selector de unidad */}
      {/* TODO: Input altura (cm) */}
      {/* TODO: Input grasa corporal % (opcional) */}
      {/* TODO: Botón "Finalizar" → /(tabs)/(nutricion) */}
      {/* TODO: Botón "Omitir" (sin guardar) */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  descripcion: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32 },
});
