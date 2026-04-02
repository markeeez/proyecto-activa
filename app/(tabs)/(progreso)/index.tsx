/**
 * PANTALLA: Dashboard de progreso
 *
 * Vista de evolución del usuario a lo largo del tiempo.
 *
 * Datos que necesita:
 *   - user_body_metrics (todos los registros del usuario, ordenados por fecha)
 *   - nutrition_logs + nutrition_log_items (para histórico de calorías)
 *   - user_goals (para líneas de referencia en los gráficos)
 *
 * Secciones:
 *   1. Métricas corporales
 *      - Gráfico de peso a lo largo del tiempo
 *      - Último registro vs objetivo
 *      - Botón "Registrar hoy"
 *
 *   2. Nutrición
 *      - Gráfico de calorías por día (últimas 2 semanas)
 *      - Promedio de macros semanal
 *
 *   3. Entrenamiento
 *      - Sesiones por semana (últimas 4 semanas)
 *      - Volumen total semanal
 *
 * Acciones:
 *   - perfil.service.ts → obtenerMetricasCorporales()
 *   - nutricion.service.ts → obtenerHistoricoNutricion()
 *   - entrenamiento.service.ts → obtenerResumenSemanal()
 *   - Modal para registrar nuevo peso/métricas
 */

import { Text, View, StyleSheet } from 'react-native';

export default function ProgresoIndex() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Progreso</Text>

      {/* TODO: Sección métricas corporales con <GraficoPeso /> */}
      {/* TODO: Botón "Registrar métricas de hoy" */}
      {/* TODO: Sección nutrición con <GraficoMacros /> */}
      {/* TODO: Sección entrenamiento con frecuencia semanal */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
});
