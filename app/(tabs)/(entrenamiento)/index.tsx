/**
 * PANTALLA: Entreno — tabs compactos pegados al área segura + contenido flex sin scroll vertical.
 * UI mock; conexión Supabase en un paso posterior.
 */

import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { EntrenosCalendarioTab, type DiaSemanaEntreno } from '@/components/entrenamiento/EntrenosCalendarioTab';
import { RutinasListadoTab } from '@/components/entrenamiento/RutinasListadoTab';
import { useEntreno } from '@/context/EntrenoContext';
import { useTheme } from '@/hooks/useTheme';

type TabEntreno = 'entrenos' | 'rutinas';

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function inicioSemanaLunes(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(base: Date, n: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function etiquetaRangoSemana(lunes: Date): string {
  const domingo = addDays(lunes, 6);
  const op: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${lunes.toLocaleDateString('es-ES', op)} — ${domingo.toLocaleDateString('es-ES', op)}`;
}

export default function EntrenamientoIndex() {
  const { c, f, ts, s, r } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { entrenoActivo } = useEntreno();

  const [tab, setTab] = useState<TabEntreno>('entrenos');

  useFocusEffect(
    useCallback(() => {
      if (entrenoActivo != null && tab === 'rutinas') {
        router.replace('/(tabs)/(entrenamiento)/entreno-activo');
      }
    }, [entrenoActivo, tab, router]),
  );
  const [lunesSemana, setLunesSemana] = useState(() => inicioSemanaLunes(new Date()));
  const [contentH, setContentH] = useState(400);

  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    setContentH(e.nativeEvent.layout.height);
  }, []);

  const hoy = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const diasSemana: DiaSemanaEntreno[] = useMemo(() => {
    const mockTiene = [true, false, true, true, false, true, false];
    return Array.from({ length: 7 }, (_, i) => {
      const fecha = addDays(lunesSemana, i);
      return {
        corto: DIAS_CORTO[i],
        fecha,
        diaNum: fecha.getDate(),
        tieneEntreno: mockTiene[i],
        esHoy: mismoDia(fecha, hoy),
      };
    });
  }, [lunesSemana, hoy]);

  const resumenSemanal = useMemo(
    () => ({
      sesiones: diasSemana.filter((d) => d.tieneEntreno).length,
      minutos: 185,
      volumen: '12.4 t',
    }),
    [diasSemana],
  );

  const semanaAnterior = useCallback(() => {
    setLunesSemana((prev) => addDays(prev, -7));
  }, []);

  const semanaSiguiente = useCallback(() => {
    setLunesSemana((prev) => addDays(prev, 7));
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: c.background,
        },
        inner: {
          flex: 1,
        },
        header: {
          paddingTop: insets.top + s.md,
          paddingHorizontal: s.md,
          paddingBottom: s.md,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        tabRow: {
          flexDirection: 'row',
          gap: s.sm,
        },
        tabBtn: {
          flex: 1,
          paddingVertical: s.xs + 2,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: c.borderVisible,
          borderRadius: r.technical,
          backgroundColor: c.surface,
        },
        tabBtnOn: {
          backgroundColor: c.primaryBg,
          borderColor: c.primary,
        },
        tabTxt: {
          ...ts.label,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.85,
        },
        tabTxtOn: {
          color: c.primary,
        },
        content: {
          flex: 1,
          minHeight: 0,
          paddingTop: s.md,
          paddingBottom: s.sm,
        },
      }),
    [c, f, ts, s, r, insets.top],
  );

  return (
    <View style={styles.safe}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tabBtn, tab === 'entrenos' && styles.tabBtnOn]}
              onPress={() => setTab('entrenos')}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'entrenos' }}
            >
              <Text style={[styles.tabTxt, tab === 'entrenos' && styles.tabTxtOn]}>ENTRENOS</Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, tab === 'rutinas' && styles.tabBtnOn]}
              onPress={() => {
                if (entrenoActivo != null) {
                  router.replace('/(tabs)/(entrenamiento)/entreno-activo');
                } else {
                  setTab('rutinas');
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'rutinas' }}
            >
              <Text style={[styles.tabTxt, tab === 'rutinas' && styles.tabTxtOn]}>RUTINAS</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.content} onLayout={onContentLayout}>
          {tab === 'entrenos' ? (
            <EntrenosCalendarioTab
              dias={diasSemana}
              etiquetaSemana={etiquetaRangoSemana(lunesSemana)}
              onSemanaAnterior={semanaAnterior}
              onSemanaSiguiente={semanaSiguiente}
              resumenSemanal={resumenSemanal}
              contentHeight={contentH}
            />
          ) : (
            <RutinasListadoTab />
          )}
        </View>
      </View>
    </View>
  );
}
