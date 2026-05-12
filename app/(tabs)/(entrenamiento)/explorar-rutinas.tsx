/**
 * Explorar rutinas predeterminadas — filtros por dificultad y grupo muscular, favoritos.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExplorarEjerciciosTab } from '@/components/ExplorarEjerciciosTab';
import { RutinaCardSkeleton } from '@/components/ui/SkeletonList';
import type { Theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  entrenamientoService,
  toggleFavoritoRutina,
  type RutinaExplorar,
} from '@/services/entrenamiento.service';

const DIFICULTADES: readonly string[] = ['Principiante', 'Intermedio', 'Avanzado'];

const FILTRO_MUSCULO_KEYWORDS = {
  Pecho: ['pectoral', 'pectorales'],
  Espalda: [
    'espalda alta',
    'dorsales superiores',
    'espalda superior',
    'parte superior de la espalda',
    'lumbares',
    'erectores espinales',
  ],
  Hombros: ['deltoides'],
  Pierna: ['cuádriceps', 'isquiotibiales', 'gemelos'],
  Glúteos: ['glúteos'],
  Bíceps: ['bíceps'],
  Tríceps: ['tríceps'],
  Core: ['abdominales', 'oblicuos'],
} as const;

type EtiquetaFiltroMusculo = keyof typeof FILTRO_MUSCULO_KEYWORDS;

const ETIQUETAS_MUSCULO: EtiquetaFiltroMusculo[] = [
  'Pecho',
  'Espalda',
  'Hombros',
  'Pierna',
  'Glúteos',
  'Bíceps',
  'Tríceps',
  'Core',
];

function normTxt(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function ejercicioCuentaParaFiltroMusculo(muscPrim: string, filtro: EtiquetaFiltroMusculo): boolean {
  const m = normTxt(muscPrim);
  if (!m) return false;
  const keys = FILTRO_MUSCULO_KEYWORDS[filtro];
  for (const k of keys) {
    const kk = normTxt(k);
    if (m === kk || m.includes(kk)) return true;
  }
  return false;
}

/** Un ejercicio encaja si coincide con al menos uno de los filtros seleccionados (OR). */
function ejercicioCoincideAlgunoFiltroMusculo(muscPrim: string, filtros: EtiquetaFiltroMusculo[]): boolean {
  if (filtros.length === 0) return false;
  return filtros.some((f) => ejercicioCuentaParaFiltroMusculo(muscPrim, f));
}

function cuentaEjerciciosFiltroMusculo(r: RutinaExplorar, filtros: EtiquetaFiltroMusculo[]): number {
  if (filtros.length === 0) return 0;
  return r.musculosPorEjercicio.filter((mp) => ejercicioCoincideAlgunoFiltroMusculo(mp, filtros)).length;
}

function coincideDificultad(r: RutinaExplorar, sel: string | null): boolean {
  if (!sel) return true;
  return normTxt(r.dificultad ?? '') === normTxt(sel);
}

function estiloChipDificultad(
  d: string | null,
  c: Theme,
): { bg: string; fg: string; border: string; label: string } {
  const raw = (d ?? '').trim();
  const label = raw || '—';
  const x = normTxt(raw);
  if (x.includes('principiante')) {
    return { bg: c.successBg, fg: c.successText, border: c.success, label };
  }
  if (x.includes('intermedio')) {
    return { bg: c.warningBg, fg: c.warningText, border: c.warning, label };
  }
  if (x.includes('avanzado')) {
    return { bg: c.dangerBg, fg: c.dangerText, border: c.danger, label };
  }
  return {
    bg: c.surfaceElevated,
    fg: c.textSecondary,
    border: c.borderVisible,
    label,
  };
}

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.xs,
      paddingBottom: s.xs,
      minHeight: 50,
      backgroundColor: c.background,
    },
    headerSide: {
      width: 44,
      height: 44,
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
    },
    filtersOuter: {
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.background,
      paddingTop: s.sm,
      paddingBottom: s.xs,
    },
    filterHeader: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      marginBottom: s.sm,
    },
    filterTitle: {
      ...ts.label,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      letterSpacing: 0,
      textTransform: 'uppercase',
    },
    filterIconBtn: {
      width: 32,
      height: 28,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    filterGroupLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0,
      paddingHorizontal: s.md,
      marginBottom: s.xs,
    },
    chipsScroll: { flexGrow: 0 },
    chipsRow: {
      flexDirection: 'row',
      gap: s.xs,
      paddingHorizontal: s.md,
      paddingBottom: s.md,
    },
    chip: {
      minHeight: 30,
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
    },
    chipOn: {
      borderColor: c.primary,
      backgroundColor: c.primaryBg,
    },
    chipText: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      fontSize: 12,
      lineHeight: 16,
      color: c.textSecondary,
    },
    chipTextOn: { color: c.primary },
    groupDivider: { height: 0 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: s.md, paddingTop: s.md, paddingBottom: s.xxl },
    card: {
      backgroundColor: c.surface,
      borderRadius: r.md,
      marginBottom: s.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
      minHeight: 92,
    },
    cardPressable: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 15,
      paddingRight: 48,
    },
    cardMain: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    cardTextArea: {
      flex: 1,
      minWidth: 0,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: s.xs,
    },
    cardTitle: {
      flex: 1,
      fontSize: 14,
      lineHeight: 18,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    diffChip: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: r.technical,
      borderWidth: 1,
      maxWidth: 96,
    },
    diffChipText: {
      fontFamily: f.mono,
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0,
    },
    musclesLine: {
      marginTop: 4,
      ...ts.caption,
      fontSize: 10,
      lineHeight: 13,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 13,
    },
    metricItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metricText: {
      fontFamily: f.sansMedium,
      fontSize: 11,
      lineHeight: 14,
      color: c.textSecondary,
    },
    cardFooter: {
      position: 'absolute',
      right: 8,
      bottom: 12,
    },
    favBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    centerMono: {
      ...ts.bodySm,
      fontFamily: f.mono,
      color: c.textSecondary,
      textAlign: 'center',
      padding: s.lg,
    },
    errMono: {
      ...ts.bodySm,
      fontFamily: f.mono,
      color: c.danger,
      textAlign: 'center',
      padding: s.md,
    },
    loading: {
      padding: s.lg,
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: c.background,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingHorizontal: s.md,
    },
    tabBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: s.sm,
      paddingBottom: 10,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabBtnActive: {
      borderBottomColor: c.primary,
    },
    tabTxt: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    tabTxtActive: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.monoBold,
      color: c.primary,
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    tabContent: {
      flex: 1,
    },
  });
}

export default function ExplorarRutinasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [rutinas, setRutinas] = useState<RutinaExplorar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [difSel, setDifSel] = useState<string | null>(null);
  const [musculoSel, setMusculoSel] = useState<EtiquetaFiltroMusculo[]>([]);
  const [tabExplorar, setTabExplorar] = useState(0);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await entrenamientoService.obtenerRutinasPredeterminadas();
      setRutinas(data);
    } catch {
      setError('load');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const listaFiltrada = useMemo(() => {
    let rows = rutinas.slice();
    if (difSel) {
      rows = rows.filter((r) => coincideDificultad(r, difSel));
    }
    if (musculoSel.length > 0) {
      rows = rows.filter((r) => cuentaEjerciciosFiltroMusculo(r, musculoSel) > 0);
      rows.sort((a, b) => {
        const ca = cuentaEjerciciosFiltroMusculo(a, musculoSel);
        const cb = cuentaEjerciciosFiltroMusculo(b, musculoSel);
        if (cb !== ca) return cb - ca;
        return a.nombre.localeCompare(b.nombre, 'es');
      });
    } else {
      rows.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    return rows;
  }, [rutinas, difSel, musculoSel]);

  const onToggleDificultad = (label: string) => {
    setDifSel((prev) => (prev === label ? null : label));
  };

  const onToggleMusculo = (m: EtiquetaFiltroMusculo) => {
    setMusculoSel((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const onToggleFavorito = async (item: RutinaExplorar, next: boolean) => {
    if (!user?.id) return;
    const prev = item.esFavorita;
    setRutinas((rows) => rows.map((r) => (r.id === item.id ? { ...r, esFavorita: next } : r)));
    try {
      await toggleFavoritoRutina(item.id, next);
    } catch {
      setRutinas((rows) => rows.map((r) => (r.id === item.id ? { ...r, esFavorita: prev } : r)));
    }
  };

  const textoMusculosResumen = (r: RutinaExplorar): string => {
    const list = r.musculos;
    if (list.length === 0) return '—';
    const head = list.slice(0, 4);
    const extra = list.length > 4 ? ` · +${list.length - 4} más` : '';
    return `${head.join(' · ')}${extra}`;
  };

  const hayFiltrosActivos = difSel !== null || musculoSel.length > 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver">
              <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
            </Pressable>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Explorar
          </Text>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.tabRow}>
          {(['RUTINAS', 'EJERCICIOS'] as const).map((label, i) => (
            <Pressable
              key={label}
              style={[styles.tabBtn, tabExplorar === i && styles.tabBtnActive]}
              onPress={() => setTabExplorar(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tabExplorar === i }}
            >
              <Text style={[styles.tabTxt, tabExplorar === i && styles.tabTxtActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tabContent}>
          {tabExplorar === 0 ? (
            <>
              <View style={styles.filtersOuter}>
                <View style={styles.filterHeader}>
                  <Text style={styles.filterTitle}>FILTRAR</Text>
                  <Pressable
                    style={[styles.filterIconBtn, !hayFiltrosActivos && { opacity: 0.72 }]}
                    onPress={() => {
                      setDifSel(null);
                      setMusculoSel([]);
                    }}
                    disabled={!hayFiltrosActivos}
                    accessibilityRole="button"
                    accessibilityLabel="Limpiar filtros"
                  >
                    <Ionicons name="options-outline" size={20} color={c.primary} />
                  </Pressable>
                </View>

                <Text style={styles.filterGroupLabel}>DIFICULTAD</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  <View style={styles.chipsRow}>
                    {DIFICULTADES.map((d) => {
                      const on = difSel === d;
                      return (
                        <Pressable
                          key={d}
                          style={[styles.chip, on && styles.chipOn]}
                          onPress={() => onToggleDificultad(d)}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{d}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                <View style={styles.groupDivider} />

                <Text style={styles.filterGroupLabel}>MÚSCULO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  <View style={styles.chipsRow}>
                    {ETIQUETAS_MUSCULO.map((m) => {
                      const on = musculoSel.includes(m);
                      return (
                        <Pressable
                          key={m}
                          style={[styles.chip, on && styles.chipOn]}
                          onPress={() => onToggleMusculo(m)}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{m}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {error ? (
                <Text style={styles.errMono}>[ERROR AL CARGAR]</Text>
              ) : cargando ? (
                <RutinaCardSkeleton color={c.surfaceElevated} borderColor={c.border} surface={c.surface} />
              ) : (
                <FlatList
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  data={listaFiltrada}
                  keyExtractor={(item) => item.id}
                  ListEmptyComponent={
                    <Text style={styles.centerMono}>Sin rutinas con estos filtros</Text>
                  }
                  renderItem={({ item }) => {
                    const diffSt = estiloChipDificultad(item.dificultad, c);
                    const totalEjercicios = item.musculosPorEjercicio.length;
                    return (
                      <View style={styles.card}>
                        <Pressable
                          style={styles.cardPressable}
                          onPress={() => router.push(`/(tabs)/(entrenamiento)/rutina/${item.id}`)}
                          accessibilityRole="button"
                        >
                          <View style={styles.cardMain}>
                            <View style={styles.cardTextArea}>
                              <View style={styles.cardTop}>
                                <Text style={styles.cardTitle} numberOfLines={2}>
                                  {item.nombre}
                                </Text>
                                <View style={[styles.diffChip, { backgroundColor: diffSt.bg, borderColor: diffSt.border }]}>
                                  <Text style={[styles.diffChipText, { color: diffSt.fg }]} numberOfLines={1}>
                                    {diffSt.label}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.musclesLine} numberOfLines={2}>
                                {textoMusculosResumen(item)}
                              </Text>
                              <View style={styles.metricsRow}>
                                <View style={styles.metricItem}>
                                  <Ionicons name="barbell" size={12} color={c.primary} />
                                  <Text style={styles.metricText} numberOfLines={1}>
                                    {totalEjercicios} ejercicios
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </Pressable>
                        <View style={styles.cardFooter}>
                          <Pressable
                            style={styles.favBtn}
                            onPress={() => void onToggleFavorito(item, !item.esFavorita)}
                            disabled={!user?.id}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={item.esFavorita ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                          >
                            <Ionicons
                              name={item.esFavorita ? 'star' : 'star-outline'}
                              size={24}
                              color={item.esFavorita ? c.warning : c.textMuted}
                            />
                          </Pressable>
                          <View style={{ flex: 1 }} />
                        </View>
                      </View>
                    );
                  }}
                />
              )}
            </>
          ) : (
            <ExplorarEjerciciosTab userId={user?.id} />
          )}
        </View>
      </View>
    </>
  );
}
