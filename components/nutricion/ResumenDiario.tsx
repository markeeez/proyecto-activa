/**
 * COMPONENTE: ResumenDiario
 *
 * Muestra el resumen calórico y de macros del día.
 * Se usa en la pantalla principal de nutrición.
 *
 * Props:
 *   - totalCalorias: number
 *   - objetivoCalorias: number
 *   - proteinas: { total: number; objetivo: number }
 *   - carbos: { total: number; objetivo: number }
 *   - grasas: { total: number; objetivo: number }
 *
 * Diseño previsto:
 *   - Círculo grande central con calorías consumidas / objetivo
 *   - 3 barras de progreso (proteínas, carbos, grasas)
 *
 * TODO: implementar con react-native-svg para el círculo
 * TODO: animaciones al cargar los valores
 */

import { Text, View, StyleSheet } from 'react-native';

interface ResumenDiarioProps {
  totalCalorias: number;
  objetivoCalorias: number;
  proteinas: { total: number; objetivo: number };
  carbos: { total: number; objetivo: number };
  grasas: { total: number; objetivo: number };
}

export function ResumenDiario({
  totalCalorias,
  objetivoCalorias,
  proteinas,
  carbos,
  grasas,
}: ResumenDiarioProps) {
  return (
    <View style={styles.container}>
      {/* TODO: Círculo de calorías */}
      <Text style={styles.calorias}>{totalCalorias} / {objetivoCalorias} kcal</Text>

      {/* TODO: <BarraMacros /> × 3 */}
      <Text style={styles.macro}>P: {proteinas.total}g / {proteinas.objetivo}g</Text>
      <Text style={styles.macro}>C: {carbos.total}g / {carbos.objetivo}g</Text>
      <Text style={styles.macro}>G: {grasas.total}g / {grasas.objetivo}g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 16 },
  calorias: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  macro: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
});
