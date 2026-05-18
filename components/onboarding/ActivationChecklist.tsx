import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { EstadoActivacion } from '@/services/activacion.service';

export function ActivationChecklist({
  estado,
  onRegistrarComida,
  onVerRutinas,
}: {
  estado: EstadoActivacion;
  onRegistrarComida: () => void;
  onVerRutinas: () => void;
}) {
  const { c, f, s } = useTheme();
  if (estado.completada) return null;

  const items = [
    { label: 'Tu plan está listo', done: estado.tieneObjetivos },
    { label: 'Registra tu primera comida', done: estado.haRegistradoComida },
    { label: 'Haz tu primer entreno', done: estado.haIniciadoEntreno },
  ];
  const completados = items.filter((item) => item.done).length;

  return (
    <View style={[st.card, { backgroundColor: c.surface, borderColor: c.borderVisible }]}>
      <View style={st.header}>
        <View>
          <Text style={[st.eyebrow, { color: c.primary, fontFamily: f.monoBold }]}>PRIMEROS PASOS</Text>
          <Text style={[st.title, { color: c.textDisplay, fontFamily: f.sansBold }]}>Empieza a ver avances</Text>
        </View>
        <Text style={[st.count, { color: c.textSecondary, fontFamily: f.monoBold }]}>{completados}/3</Text>
      </View>
      <View style={[st.track, { backgroundColor: c.border }]}>
        <View style={[st.fill, { width: `${(completados / items.length) * 100}%`, backgroundColor: c.primary }]} />
      </View>
      <View style={st.items}>
        {items.map((item) => (
          <View key={item.label} style={st.item}>
            <Ionicons name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={item.done ? c.success : c.textMuted} />
            <Text style={[st.itemText, { color: item.done ? c.textSecondary : c.textDisplay, fontFamily: f.sansMedium }]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={[st.actions, { gap: s.sm }]}>
        {!estado.haRegistradoComida ? (
          <Pressable style={[st.primaryAction, { backgroundColor: c.primary }]} onPress={onRegistrarComida}>
            <Ionicons name="restaurant-outline" size={18} color={c.textOnPrimary} />
            <Text style={[st.primaryActionText, { color: c.textOnPrimary, fontFamily: f.sansBold }]}>Registrar comida</Text>
          </Pressable>
        ) : null}
        {!estado.haIniciadoEntreno ? (
          <Pressable style={[st.secondaryAction, { borderColor: c.borderVisible, backgroundColor: c.surfaceElevated }]} onPress={onVerRutinas}>
            <Ionicons name="barbell-outline" size={18} color={c.primary} />
            <Text style={[st.secondaryActionText, { color: c.textDisplay, fontFamily: f.sansBold }]}>
              Ver rutinas
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontSize: 10, lineHeight: 13, letterSpacing: 1.1 },
  title: { marginTop: 3, fontSize: 16, lineHeight: 21 },
  count: { fontSize: 12, lineHeight: 15 },
  track: { height: 5, borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', borderRadius: 999 },
  items: { marginTop: 12, gap: 9 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  itemText: { fontSize: 13, lineHeight: 17 },
  actions: { flexDirection: 'row', marginTop: 14 },
  primaryAction: { flex: 1, minHeight: 42, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { fontSize: 13, lineHeight: 17 },
  secondaryAction: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryActionText: { fontSize: 13, lineHeight: 17 },
});
