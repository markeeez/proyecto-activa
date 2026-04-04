/**
 * PANTALLA: Entreno — cabecera fija (~20%) + contenido por tab sin scroll vertical.
 * UI mock; conexión Supabase en un paso posterior.
 */

import { useCallback, useMemo, useState } from 'react';
import { Dimensions, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EntrenosCalendarioTab, type DiaSemanaEntreno } from '@/components/entrenamiento/EntrenosCalendarioTab';
import { RutinasListadoTab, type RutinaMock } from '@/components/entrenamiento/RutinasListadoTab';
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

const RUTINAS_MIS_MOCK: RutinaMock[] = [
  {
    id: '1',
    nombre: 'ESPALDA',
    ejercicios: ['Dominadas', 'Remo con barra', 'Jalón al pecho', 'Face pull'],
  },
  {
    id: '2',
    nombre: 'PIERNA',
    ejercicios: ['Sentadilla', 'Prensa', 'Zancadas', 'Curl femoral'],
  },
  {
    id: '3',
    nombre: 'PUSH UPPER',
    ejercicios: ['Press banca', 'Press militar', 'Aperturas'],
  },
];

const RUTINAS_FAV_MOCK: RutinaMock[] = [
  {
    id: 'f1',
    nombre: 'FULL BODY EXPRESS',
    ejercicios: ['Burpees', 'Kettlebell swing', 'Farmer walk'],
  },
];

export default function EntrenamientoIndex() {
  const { c, f, ts, s, r } = useTheme();
  const insets = useSafeAreaInsets();
  const windowH = Dimensions.get('window').height;

  const usableH = Math.max(0, windowH - insets.top - insets.bottom);
  const headerH = Math.round(usableH * 0.2);

  const [tab, setTab] = useState<TabEntreno>('entrenos');
  const [lunesSemana, setLunesSemana] = useState(() => inicioSemanaLunes(new Date()));
  const [contentH, setContentH] = useState(usableH * 0.8);

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
          height: headerH,
          paddingHorizontal: s.md,
          justifyContent: 'flex-end',
          paddingBottom: s.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        tabRow: {
          flexDirection: 'row',
          gap: s.xs,
        },
        tabBtn: {
          flex: 1,
          paddingVertical: s.sm,
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
        },
      }),
    [c, f, ts, s, r, headerH],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
              onPress={() => setTab('rutinas')}
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
            <RutinasListadoTab rutinasMis={RUTINAS_MIS_MOCK} rutinasFavoritas={RUTINAS_FAV_MOCK} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
