/**
 * PANTALLA: Editar objetivos
 *
 * Reutiliza la lógica del onboarding/objetivos pero en modo edición.
 *
 * Datos que necesita:
 *   - user_goals (para prerellenar los campos con los valores actuales)
 *
 * Campos editables (tabla user_goals):
 *   - objetivo: 'perder_peso' | 'mantener' | 'ganar_masa' | 'mejorar_rendimiento'
 *   - calorias_objetivo
 *   - proteinas_objetivo
 *   - carbos_objetivo
 *   - grasas_objetivo
 *
 * Acciones:
 *   - nutricion.service.ts → actualizarObjetivos(datos)
 *   - Sugerencia automática de macros al cambiar el objetivo
 */

import { Text, View, StyleSheet } from 'react-native';

export default function EditarObjetivos() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mis objetivos</Text>

      {/* TODO: Selector de objetivo principal */}
      {/* TODO: Inputs de calorías y macros */}
      {/* TODO: Sugerencia automática de distribución */}
      {/* TODO: Botón "Guardar objetivos" */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
});
