/**
 * Onboarding paso 1: datos corporales y nivel de actividad.
 */

import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import type { Theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

export type GeneroOnboarding = 'hombre' | 'mujer';

export const ACTIVIDAD_OPCIONES = [
  { label: 'Sedentario (poco o nada de ejercicio)', factor: 1.2 },
  { label: 'Ligero (1-3 días/semana)', factor: 1.375 },
  { label: 'Moderado (3-5 días/semana)', factor: 1.55 },
  { label: 'Activo (6-7 días/semana)', factor: 1.725 },
  { label: 'Muy activo (atleta, trabajo físico)', factor: 1.9 },
] as const;

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: s.md,
      paddingBottom: s.sm,
    },
    pasoTxt: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    scroll: { flexGrow: 1, paddingHorizontal: s.md },
    titulo: {
      ...ts.displayMd,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: s.xs,
    },
    subtitulo: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginBottom: s.lg,
    },
    label: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: s.sm,
      letterSpacing: 0.6,
    },
    segmentRow: { flexDirection: 'row', gap: s.xs, marginBottom: s.lg },
    segmentBtn: {
      flex: 1,
      paddingVertical: s.md,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      backgroundColor: c.surface,
    },
    segmentBtnOn: {
      borderColor: c.primary,
      backgroundColor: c.primaryBg,
    },
    segmentTxt: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    segmentTxtOn: { color: c.primary },
    input: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      marginBottom: s.lg,
      backgroundColor: c.surface,
    },
    selectorActividad: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingHorizontal: s.md,
      paddingVertical: s.md,
      marginBottom: s.lg,
      backgroundColor: c.surface,
    },
    selectorActividadTxt: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textDisplay,
      flex: 1,
      paddingRight: s.sm,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: s.md,
      paddingTop: s.sm,
      backgroundColor: c.background,
    },
    btnPrimary: {
      paddingVertical: s.md,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.primary,
    },
    btnDis: { opacity: 0.4 },
    btnTxt: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
      letterSpacing: 0.3,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: c.surfaceElevated,
      borderTopLeftRadius: r.lg,
      borderTopRightRadius: r.lg,
      borderTopWidth: 1,
      borderColor: c.borderVisible,
      paddingBottom: s.lg,
      maxHeight: '70%',
    },
    modalTitulo: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      paddingHorizontal: s.md,
      paddingVertical: s.md,
    },
    modalOpcion: {
      paddingVertical: s.md,
      paddingHorizontal: s.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    modalOpcionTxt: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
  });
}

function nombreMostrar(user: ReturnType<typeof useAuth>['user']): string {
  if (!user) return 'Atleta';
  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  const u = meta?.username ?? meta?.full_name ?? meta?.name;
  if (u && String(u).trim()) return String(u).trim();
  const email = user.email ?? '';
  const at = email.indexOf('@');
  if (at > 0) return email.slice(0, at);
  return 'Atleta';
}

export default function OnboardingDatosPantalla() {
  const insets = useSafeAreaInsets();
  const { c, f, ts, s, r } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [genero, setGenero] = useState<GeneroOnboarding>('hombre');
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [actividadIdx, setActividadIdx] = useState(0);
  const [modalActividad, setModalActividad] = useState(false);

  const actividadSel = ACTIVIDAD_OPCIONES[actividadIdx];

  const formOk = useMemo(() => {
    const e = edad.trim();
    const p = peso.trim().replace(',', '.');
    const a = altura.trim().replace(',', '.');
    if (!e || !p || !a) return false;
    const ne = parseInt(e, 10);
    const np = parseFloat(p);
    const na = parseFloat(a);
    return Number.isFinite(ne) && ne > 0 && Number.isFinite(np) && np > 0 && Number.isFinite(na) && na > 0;
  }, [edad, peso, altura]);

  const onSiguiente = () => {
    if (!formOk) return;
    const factor = actividadSel.factor;
    router.push({
      pathname: '/(onboarding)/objetivo',
      params: {
        genero,
        edad: edad.trim(),
        pesoKg: peso.trim().replace(',', '.'),
        alturaCm: altura.trim().replace(',', '.'),
        factorActividad: String(factor),
      },
    });
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.pasoTxt}>Paso 1 de 2</Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.titulo}>Bienvenido, {nombreMostrar(user)}</Text>
          <Text style={styles.subtitulo}>Cuéntanos sobre ti</Text>

          <Text style={styles.label}>GÉNERO</Text>
          <View style={styles.segmentRow}>
            <Pressable
              style={[styles.segmentBtn, genero === 'hombre' && styles.segmentBtnOn]}
              onPress={() => setGenero('hombre')}
            >
              <Text style={[styles.segmentTxt, genero === 'hombre' && styles.segmentTxtOn]}>Hombre</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentBtn, genero === 'mujer' && styles.segmentBtnOn]}
              onPress={() => setGenero('mujer')}
            >
              <Text style={[styles.segmentTxt, genero === 'mujer' && styles.segmentTxtOn]}>Mujer</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>EDAD</Text>
          <TextInput
            style={styles.input}
            value={edad}
            onChangeText={setEdad}
            placeholder="años"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>PESO ACTUAL</Text>
          <TextInput
            style={styles.input}
            value={peso}
            onChangeText={setPeso}
            placeholder="kg"
            placeholderTextColor={c.textMuted}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>ALTURA</Text>
          <TextInput
            style={styles.input}
            value={altura}
            onChangeText={setAltura}
            placeholder="cm"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>NIVEL DE ACTIVIDAD</Text>
          <Pressable style={styles.selectorActividad} onPress={() => setModalActividad(true)}>
            <Text style={styles.selectorActividadTxt} numberOfLines={2}>
              {actividadSel.label}
            </Text>
            <Text style={[styles.pasoTxt, { color: c.primary }]}>▼</Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + s.md }]}>
          <Pressable
            style={[styles.btnPrimary, !formOk && styles.btnDis]}
            onPress={onSiguiente}
            disabled={!formOk}
          >
            <Text style={styles.btnTxt}>SIGUIENTE</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={modalActividad} transparent animationType="slide" onRequestClose={() => setModalActividad(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalActividad(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: insets.bottom + s.md }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitulo}>NIVEL DE ACTIVIDAD</Text>
            <ScrollView>
              {ACTIVIDAD_OPCIONES.map((op, i) => (
                <Pressable
                  key={op.label}
                  style={styles.modalOpcion}
                  onPress={() => {
                    setActividadIdx(i);
                    setModalActividad(false);
                  }}
                >
                  <Text style={styles.modalOpcionTxt}>{op.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
