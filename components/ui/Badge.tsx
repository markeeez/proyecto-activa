/**
 * COMPONENTE: Badge
 *
 * Etiqueta pequeña para planes, categorías, músculos, etc.
 *
 * Props:
 *   - texto: string
 *   - color?: string (hex, default azul)
 *   - tamaño?: 'sm' | 'md'
 */

import { Text, View, StyleSheet } from 'react-native';

interface BadgeProps {
  texto: string;
  color?: string;
  tamaño?: 'sm' | 'md';
}

export function Badge({ texto, color = '#4F7CFF', tamaño = 'sm' }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.texto, { color }, tamaño === 'sm' ? styles.textoSm : styles.textoMd]}>
        {texto}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  texto: { fontWeight: '600' },
  textoSm: { fontSize: 11 },
  textoMd: { fontSize: 13 },
});
