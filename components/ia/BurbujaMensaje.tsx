/**
 * COMPONENTE: BurbujaMensaje
 *
 * Burbuja de mensaje en el chat de IA.
 *
 * Props:
 *   - mensaje: MensajeChat
 *
 * Diseño:
 *   - rol 'user'      → burbuja derecha, color primario
 *   - rol 'assistant' → burbuja izquierda, color gris claro
 *
 * TODO: soporte markdown básico en mensajes del asistente
 * TODO: skeleton loader mientras espera respuesta (enviando: true)
 */

import { Text, View, StyleSheet } from 'react-native';
import type { MensajeChat } from '@/types/app.types';

interface BurbujaMensajeProps {
  mensaje: MensajeChat;
}

export function BurbujaMensaje({ mensaje }: BurbujaMensajeProps) {
  const esUsuario = mensaje.rol === 'user';

  return (
    <View style={[styles.contenedor, esUsuario ? styles.derecha : styles.izquierda]}>
      <View style={[styles.burbuja, esUsuario ? styles.burbujaUsuario : styles.burbujaAsistente]}>
        <Text style={[styles.texto, esUsuario ? styles.textoUsuario : styles.textoAsistente]}>
          {mensaje.contenido}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginVertical: 4, paddingHorizontal: 16 },
  derecha: { alignItems: 'flex-end' },
  izquierda: { alignItems: 'flex-start' },
  burbuja: { maxWidth: '80%', borderRadius: 18, padding: 12 },
  burbujaUsuario: { backgroundColor: '#4F7CFF', borderBottomRightRadius: 4 },
  burbujaAsistente: { backgroundColor: '#F3F4F6', borderBottomLeftRadius: 4 },
  texto: { fontSize: 15, lineHeight: 22 },
  textoUsuario: { color: '#fff' },
  textoAsistente: { color: '#111827' },
});
