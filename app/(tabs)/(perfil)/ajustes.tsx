/**
 * PANTALLA: Ajustes
 *
 * Preferencias generales de la app.
 *
 * Opciones:
 *   - Tema: claro / oscuro / sistema
 *   - Unidades: kg/cm o lb/in
 *   - Notificaciones: recordatorio de log diario (hora)
 *   - Cambiar contraseña (redirige a Supabase Auth)
 *   - Eliminar cuenta (acción destructiva con confirmación)
 *
 * Nota: Los ajustes de unidades y tema se guardan en AsyncStorage
 * (no en Supabase, ya que son preferencias locales del dispositivo).
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeMode } from '@/context/ThemeContext';
import type { Theme } from '@/constants/theme';
import { useTimerDescanso, type ModoDescanso } from '@/hooks/useTimerDescanso';
import { useTheme } from '@/hooks/useTheme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatearDuracion(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(
  c: Theme,
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: s.md, gap: s.md },

    // Sección
    seccion: {
      backgroundColor: c.surface,
      borderRadius: r.md,
      paddingHorizontal: s.md,
      paddingTop: s.md,
      paddingBottom: s.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    seccionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      marginBottom: s.sm,
    },
    seccionTitulo: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Fila de ajuste
    fila: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      gap: s.sm,
    },
    filaTextoWrap: { flex: 1, minWidth: 0 },
    filaTitulo: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.text,
    },
    filaSubtitulo: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginTop: 2,
    },
    filaValor: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
    },

    // Opciones de radio expandidas
    opcionesWrap: {
      marginTop: s.xs,
      gap: 2,
    },
    opcion: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: s.sm,
      paddingHorizontal: s.sm,
      borderRadius: r.sm,
      gap: s.sm,
    },
    opcionActiva: {
      backgroundColor: c.primaryBg,
    },
    opcionTitulo: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.text,
    },
    opcionDescripcion: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginTop: 1,
    },

    // Selector de duración
    duracionWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.md,
      paddingVertical: s.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      marginTop: s.xs,
    },
    duracionBtn: {
      width: 40,
      height: 40,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    duracionBtnTxt: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    duracionTxt: {
      ...ts.heading,
      fontFamily: f.monoBold,
      color: c.textDisplay,
      minWidth: 56,
      textAlign: 'center',
    },
    duracionLabel: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 2,
    },
  });
}

// ─── Componentes internos ─────────────────────────────────────────────────────

type OpcionRadioProps = {
  activa: boolean;
  titulo: string;
  descripcion: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  c: Theme;
  f: ReturnType<typeof useTheme>['f'];
};

function OpcionRadio({ activa, titulo, descripcion, onPress, styles, c, f }: OpcionRadioProps) {
  return (
    <Pressable
      style={[styles.opcion, activa && styles.opcionActiva]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: activa }}
    >
      <Ionicons
        name={activa ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={activa ? c.primary : c.textMuted}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.opcionTitulo, activa && { fontFamily: f.sansBold, color: c.primary }]}>
          {titulo}
        </Text>
        <Text style={styles.opcionDescripcion}>{descripcion}</Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Ajustes() {
  const insets = useSafeAreaInsets();
  const { isDark, setMode } = useThemeMode();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const { preferencia, setModo, setDuracionSeg } = useTimerDescanso();
  const [descansoExpandido, setDescansoExpandido] = useState(false);

  const modos: { key: ModoDescanso; titulo: string; descripcion: string }[] = [
    {
      key: 'fijo',
      titulo: 'Tiempo fijo',
      descripcion: 'Cuenta atrás configurable al marcar cada serie.',
    },
    {
      key: 'auto',
      titulo: 'Automático',
      descripcion: 'Mide el tiempo entre series y lo guarda en el historial.',
    },
    {
      key: 'off',
      titulo: 'Desactivado',
      descripcion: 'Sin timer de descanso.',
    },
  ];

  const subtituloDescanso =
    preferencia.modo === 'fijo'
      ? `Tiempo fijo · ${formatearDuracion(preferencia.duracionSeg)}`
      : preferencia.modo === 'auto'
      ? 'Automático'
      : 'Desactivado';

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: 'Ajustes', headerBackTitle: 'Perfil' }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: s.md, paddingBottom: insets.bottom + 40 }]}
      >
        {/* ── APARIENCIA ── */}
        <View style={styles.seccion}>
          <View style={styles.seccionHeader}>
            <Ionicons name="color-palette-outline" size={15} color={c.primary} />
            <Text style={styles.seccionTitulo}>Apariencia</Text>
          </View>

          <View style={styles.fila}>
            <View style={styles.filaTextoWrap}>
              <Text style={styles.filaTitulo}>Modo oscuro</Text>
              <Text style={styles.filaSubtitulo}>{isDark ? 'Oscuro' : 'Claro'}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(value) => setMode(value ? 'dark' : 'light')}
              trackColor={{ false: c.surfaceElevated, true: c.primaryBg }}
              thumbColor={c.primary}
            />
          </View>
        </View>

        {/* ── ENTRENAMIENTO ── */}
        <View style={styles.seccion}>
          <View style={styles.seccionHeader}>
            <Ionicons name="barbell-outline" size={15} color={c.primary} />
            <Text style={styles.seccionTitulo}>Entrenamiento</Text>
          </View>

          {/* Fila: Descanso entre series */}
          <Pressable
            style={styles.fila}
            onPress={() => setDescansoExpandido((v) => !v)}
            accessibilityRole="button"
          >
            <View style={styles.filaTextoWrap}>
              <Text style={styles.filaTitulo}>Descanso entre series</Text>
              <Text style={styles.filaSubtitulo}>{subtituloDescanso}</Text>
            </View>
            <Ionicons
              name={descansoExpandido ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={c.textMuted}
            />
          </Pressable>

          {descansoExpandido && (
            <View style={styles.opcionesWrap}>
              {modos.map((m) => (
                <OpcionRadio
                  key={m.key}
                  activa={preferencia.modo === m.key}
                  titulo={m.titulo}
                  descripcion={m.descripcion}
                  onPress={() => setModo(m.key)}
                  styles={styles}
                  c={c}
                  f={f}
                />
              ))}

              {/* Selector de duración — solo en modo fijo */}
              {preferencia.modo === 'fijo' && (
                <View style={styles.duracionWrap}>
                  <Pressable
                    style={styles.duracionBtn}
                    onPress={() =>
                      setDuracionSeg(Math.max(15, preferencia.duracionSeg - 15))
                    }
                    accessibilityLabel="Quitar 15 segundos"
                  >
                    <Text style={styles.duracionBtnTxt}>−</Text>
                  </Pressable>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.duracionTxt}>
                      {formatearDuracion(preferencia.duracionSeg)}
                    </Text>
                    <Text style={styles.duracionLabel}>min:seg</Text>
                  </View>
                  <Pressable
                    style={styles.duracionBtn}
                    onPress={() =>
                      setDuracionSeg(Math.min(600, preferencia.duracionSeg + 15))
                    }
                    accessibilityLabel="Añadir 15 segundos"
                  >
                    <Text style={styles.duracionBtnTxt}>+</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── OTRAS SECCIONES (pendientes) ── */}
        {/* TODO: Selector de unidades (kg/cm o lb/in) */}
        {/* TODO: Toggle notificación recordatorio diario */}
        {/* TODO: Opción "Cambiar contraseña" */}
        {/* TODO: Opción "Eliminar cuenta" (con confirmación) */}
      </ScrollView>
    </View>
  );
}
