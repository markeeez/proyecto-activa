/**
 * COMPONENTE: Tarjeta
 *
 * Contenedor con borde redondeado y sombra sutil.
 * Base para TarjetaComida, TarjetaSesion, etc.
 *
 * Props:
 *   - children: ReactNode
 *   - padding?: number (default 16)
 *   - onPress?: () => void  → si se pasa, la tarjeta es presionable
 *   - style?: ViewStyle
 *
 * TODO: adaptar colores a modo oscuro/claro con useColorScheme
 */

import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { ReactNode } from 'react';

interface TarjetaProps {
  children: ReactNode;
  padding?: number;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Tarjeta({ children, padding = 16, onPress, style }: TarjetaProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.tarjeta, { padding }, style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.tarjeta, { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
});
