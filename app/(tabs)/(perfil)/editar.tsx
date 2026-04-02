/**
 * PANTALLA: Editar perfil
 *
 * Permite modificar los datos básicos del perfil.
 *
 * Campos editables (tabla profiles):
 *   - nombre
 *   - apellidos
 *   - username (con validación de disponibilidad)
 *
 * Campos NO editables aquí:
 *   - email (gestionado por Supabase Auth)
 *   - plan
 *
 * Acciones:
 *   - perfil.service.ts → actualizarPerfil(datos)
 *   - Validación de username único antes de guardar
 */

import { Text, View, StyleSheet } from 'react-native';

export default function EditarPerfil() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Editar perfil</Text>

      {/* TODO: Input nombre */}
      {/* TODO: Input apellidos */}
      {/* TODO: Input username con validación async */}
      {/* TODO: Botón "Guardar cambios" */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
});
