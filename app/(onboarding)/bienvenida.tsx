/**
 * PANTALLA: Bienvenida (Onboarding paso 1/3)
 *
 * Presentación visual de las funcionalidades principales de ACTIVA.
 * Sin llamadas a la BD. Solo UI + navegación al siguiente paso.
 *
 * Navegación:
 *   - → /(onboarding)/objetivos
 */

import { Text, View, StyleSheet } from 'react-native';

export default function Bienvenida() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Bienvenido a ACTIVA</Text>
      <Text style={styles.descripcion}>
        Tu app de nutrición y entrenamiento. Vamos a configurar tu perfil.
      </Text>

      {/* TODO: Ilustración / animación de bienvenida */}
      {/* TODO: Puntos destacados: nutrición, entrenamiento, IA */}
      {/* TODO: Botón "Empezar" → objetivos */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  titulo: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  descripcion: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
});
