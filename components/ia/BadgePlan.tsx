/**
 * COMPONENTE: BadgePlan
 *
 * Indicador de mensajes de IA restantes del mes.
 * Se muestra en la pantalla de chat IA.
 *
 * Props:
 *   - plan: Plan
 *   - usados: number
 *   - limite: number
 *
 * Comportamiento:
 *   - free: "Mejora tu plan para acceder a la IA"
 *   - plus/premium: "X mensajes restantes este mes"
 *   - Cuando queden < 10: color advertencia
 *   - Cuando sea 0: color error + bloqueo del input
 */

import { Text, View, StyleSheet } from 'react-native';
import type { Plan } from '@/types/database.types';

interface BadgePlanProps {
  plan: Plan;
  usados: number;
  limite: number;
}

export function BadgePlan({ plan, usados, limite }: BadgePlanProps) {
  if (plan === 'free') {
    return (
      <View style={[styles.badge, styles.free]}>
        <Text style={styles.textoFree}>Plan Free · Sin acceso a IA</Text>
      </View>
    );
  }

  const restantes = limite - usados;
  const color = restantes <= 0 ? '#EF4444' : restantes <= 10 ? '#F59E0B' : '#22C55E';

  return (
    <View style={[styles.badge, { backgroundColor: color + '15' }]}>
      <Text style={[styles.texto, { color }]}>
        {restantes} mensajes restantes este mes
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { marginHorizontal: 16, marginBottom: 8, borderRadius: 8, padding: 8, alignItems: 'center' },
  free: { backgroundColor: '#F3F4F6' },
  textoFree: { fontSize: 13, color: '#6B7280' },
  texto: { fontSize: 13, fontWeight: '500' },
});
