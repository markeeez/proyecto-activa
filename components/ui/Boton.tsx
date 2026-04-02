/**
 * COMPONENTE: Boton
 *
 * Botón reutilizable con variantes de estilo.
 *
 * Props:
 *   - titulo: string
 *   - onPress: () => void
 *   - variante?: 'primario' | 'secundario' | 'destructivo' | 'fantasma'
 *   - tamaño?: 'sm' | 'md' | 'lg'
 *   - cargando?: boolean  → muestra spinner y deshabilita
 *   - deshabilitado?: boolean
 *   - icono?: ReactNode   → icono a la izquierda del texto
 *
 * TODO: implementar con StyleSheet y Colores
 */

import { Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface BotonProps {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'destructivo' | 'fantasma';
  tamaño?: 'sm' | 'md' | 'lg';
  cargando?: boolean;
  deshabilitado?: boolean;
}

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  cargando = false,
  deshabilitado = false,
}: BotonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variante]]}
      onPress={onPress}
      disabled={cargando || deshabilitado}
      activeOpacity={0.8}
    >
      {cargando ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.texto}>{titulo}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primario: { backgroundColor: '#4F7CFF' },
  secundario: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  destructivo: { backgroundColor: '#EF4444' },
  fantasma: { backgroundColor: 'transparent' },
  texto: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
