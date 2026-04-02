/**
 * PANTALLA: Objetivos (Onboarding paso 2/3)
 *
 * El usuario elige su objetivo principal y configura sus metas de
 * calorías y macros. Se guarda en la tabla user_goals.
 *
 * Datos que genera:
 *   user_goals {
 *     objetivo: 'perder_peso' | 'mantener' | 'ganar_masa' | 'mejorar_rendimiento'
 *     calorias_objetivo: number
 *     proteinas_objetivo: number
 *     carbos_objetivo: number
 *     grasas_objetivo: number
 *   }
 *
 * Acciones:
 *   - nutricion.service.ts → crearObjetivos()
 *   - Sugerencia automática de macros según objetivo seleccionado
 *
 * Navegación:
 *   - ← bienvenida
 *   - → metricas
 */

import { Text, View, StyleSheet } from 'react-native';

export default function Objetivos() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>¿Cuál es tu objetivo?</Text>

      {/* TODO: Selector de objetivo (4 opciones con iconos) */}
      {/* TODO: Inputs de calorías y macros con sugerencia automática */}
      {/* TODO: Botón "Continuar" → metricas */}
      {/* TODO: Botón "Atrás" */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 32, textAlign: 'center' },
});
