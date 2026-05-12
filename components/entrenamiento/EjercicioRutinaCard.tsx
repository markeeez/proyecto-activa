/**
 * Tarjeta de ejercicio en el borrador de rutina: cabecera + tabla de series.
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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import LogoLight from '@/assets/images/logo_light_sb.svg';
import LogoDark from '@/assets/images/logo_sb.svg';
import KmRecordIcon from '@/assets/images/km_record_trophy_icon.svg';
import PrRecordIcon from '@/assets/images/pr_trophy_icon.svg';
import TimeRecordIcon from '@/assets/images/time_record_trophy_icon.svg';
import VolumeRecordIcon from '@/assets/images/volume_record_trophy_icon.svg';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';
import type { BorradorEjercicioLinea, BorradorSerieLinea } from '@/types/entrenamientoBorrador.types';
import { abrevTipoSerieUi, type TipoSerieUi } from '@/lib/entrenamientoSerie';
import { tieneRecordFlags, type SetRecordFlags } from '@/lib/entrenamientoRecords';
import { OpcionesMenuModal, type OpcionMenuItem } from '@/components/entrenamiento/OpcionesMenuModal';

function lid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  data: BorradorEjercicioLinea;
  onChange: (next: BorradorEjercicioLinea) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReplace: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  modo?: 'rutina' | 'entreno';
  /** modo entreno: texto "Anterior" por fila de serie (misma longitud que data.sets) */
  textoAnteriorSeries?: (string | null)[];
  /** modo entreno: records conseguidos o candidatos por fila de serie */
  recordFlagsSeries?: SetRecordFlags[];
  /** modo entreno: nota del ejercicio (controlada desde el padre) */
  nota?: string;
  onNotaChange?: (nota: string) => void;
};

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      marginBottom: s.md,
      overflow: 'hidden',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: s.sm,
      gap: s.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbEntreno: {
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbEntrenoImg: {
      width: 48,
      height: 48,
      borderRadius: 8,
    },
    headText: {
      flex: 1,
      minWidth: 0,
    },
    nombre: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    nombreEntrenoLink: {
      color: c.primary,
    },
    menuHit: {
      padding: s.xs,
    },
    tableHead: {
      flexDirection: 'row',
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: s.xs,
    },
    th: {
      fontFamily: f.mono,
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0.6,
      color: c.textMuted,
    },
    colSerie: { width: 56 },
    /** Modo entreno: mismas columnas en cabecera y filas (flex compartido) */
    entrenoColSerie: { width: 66, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
    entrenoColAnt: { flex: 1.15, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
    entrenoColKg: { width: 52, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
    entrenoColReps: { width: 40, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
    entrenoColRir: { width: 40, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
    entrenoColCheck: { width: 26, alignItems: 'center', justifyContent: 'center' },
    entrenoInputInner: { flex: 1, minWidth: 0, width: '100%', alignSelf: 'stretch' },
    colKg: { flex: 1, minWidth: 44 },
    colReps: { flex: 1, minWidth: 44 },
    colCheck: { width: 44, alignItems: 'center', justifyContent: 'center' },
    colMenu: { width: 22 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      gap: s.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    serieNumWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    recordIconsSlot: {
      width: 30,
      minHeight: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 1,
    },
    recordIcon: {
      width: 14,
      height: 14,
    },
    serieNum: {
      fontFamily: f.monoBold,
      fontSize: 14,
      lineHeight: 21,
      color: c.textDisplay,
    },
    badge: {
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 2,
      backgroundColor: c.borderVisible,
    },
    badgeTxt: {
      fontFamily: f.monoBold,
      fontSize: 9,
      lineHeight: 12,
      color: c.textDisplay,
      letterSpacing: 0.3,
    },
    cellInput: {
      fontFamily: f.mono,
      fontSize: 14,
      lineHeight: 21,
      color: c.textDisplay,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingVertical: 4,
      minHeight: 32,
    },
    addSerie: {
      paddingVertical: s.sm,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    addSerieTxt: {
      fontFamily: f.mono,
      fontSize: 11,
      lineHeight: 13,
      letterSpacing: 0.88,
      color: c.primary,
    },
    antTxt: {
      fontFamily: f.mono,
      fontSize: 12,
      lineHeight: 17,
      color: c.textSecondary,
    },
    rowHecho: {
      backgroundColor: c.surfaceElevated,
    },
    inputHecho: {
      opacity: 0.55,
    },
    /** Centrado cabecera / valor KG y REPS en modo entreno */
    entrenoThCenter: {
      textAlign: 'center' as const,
      width: '100%',
    },
    cellInputEntrenoCenter: {
      textAlign: 'center' as const,
      width: '100%',
    },
    rirInput: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.technical,
      backgroundColor: c.surface,
      paddingVertical: 2,
    },
    /** Cabecera SERIE modo entreno: cabe en columna estrecha sin partir líneas */
    thEntrenoSerie: {
      fontFamily: f.mono,
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0.35,
      color: c.textMuted,
    },
    chatHit: {
      padding: s.xs,
      justifyContent: 'center',
    },
    chatLogo: {
      width: 22,
      height: 22,
    },
    aiModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    aiModalSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: r.lg,
      borderTopRightRadius: r.lg,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: c.borderVisible,
      overflow: 'hidden',
    },
    aiModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    aiModalTitle: {
      fontFamily: f.mono,
      fontSize: 11,
      lineHeight: 13,
      letterSpacing: 0.85,
      color: c.textSecondary,
    },
    aiModalClose: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiModalBody: {
      flex: 1,
      minHeight: 0,
      padding: s.md,
    },
    aiBubble: {
      alignSelf: 'flex-start',
      maxWidth: '92%',
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    aiBubbleText: {
      fontFamily: f.sans,
      fontSize: 14,
      lineHeight: 21,
      color: c.textDisplay,
    },
    aiInputFooter: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: s.sm,
      paddingHorizontal: s.md,
      paddingTop: s.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    aiInputField: {
      flex: 1,
      minWidth: 0,
      fontFamily: f.sans,
      fontSize: 16,
      lineHeight: 24,
      color: c.textDisplay,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.technical,
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      maxHeight: 120,
    },
    aiSendBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: r.technical,
      backgroundColor: c.primary,
    },
    aiSendBtnDisabled: {
      opacity: 0.35,
    },
    notaHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 28,
      paddingHorizontal: s.sm,
      paddingVertical: 0,
      gap: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    notaHeaderLabel: {
      fontFamily: f.mono,
      fontSize: 11,
      lineHeight: 13,
      letterSpacing: 0.6,
      color: c.textMuted,
    },
    notaHeaderSpacer: {
      flex: 1,
    },
    notaInputOuter: {
      paddingHorizontal: s.sm,
      paddingTop: s.xs,
      paddingBottom: s.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    notaInput: {
      fontFamily: f.mono,
      fontSize: 12,
      lineHeight: 17,
      color: c.textSecondary,
      backgroundColor: c.surfaceElevated,
      borderRadius: r.sm,
      padding: s.sm,
      maxHeight: 80,
    },
    cardioHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      gap: s.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    cardioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.sm,
      paddingVertical: s.sm,
      gap: s.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    cardioCompact: {
      justifyContent: 'center',
      paddingHorizontal: 0,
      gap: s.xs,
    },
    cardioColAnt: { flex: 1.2, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
    cardioRecordSlot: { width: 32, alignItems: 'center', justifyContent: 'center' },
    cardioColTiempo: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
    cardioColKm: { flex: 0.75, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
    cardioColTiempoCompact: { width: 100, alignItems: 'center', justifyContent: 'center' },
    cardioColKmCompact: { width: 80, alignItems: 'center', justifyContent: 'center' },
    cardioInput: {
      fontFamily: f.mono,
      fontSize: 14,
      lineHeight: 20,
      color: c.textDisplay,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingHorizontal: 8,
      paddingVertical: 6,
      width: 72,
      textAlign: 'center' as const,
      includeFontPadding: false,
    },
  });
}

function accentSerie(c: Theme, ui: TipoSerieUi): string | undefined {
  switch (ui) {
    case 'warm_up':
      return c.warning;
    case 'top_set':
      return c.primary;
    case 'back_off':
      return c.danger;
    case 'superserie':
      return c.macroProtein;
    default:
      return undefined;
  }
}

function actualizarSet(sets: BorradorSerieLinea[], setId: string, patch: Partial<BorradorSerieLinea>): BorradorSerieLinea[] {
  return sets.map((x) => (x.setId === setId ? { ...x, ...patch } : x));
}

function esTrackingCardio(mode: BorradorEjercicioLinea['tracking_mode']): boolean {
  return mode === 'cardio_time' || mode === 'cardio_time_distance';
}

function normalizarDecimalInput(texto: string): string {
  let out = '';
  let separadorUsado = false;
  for (const ch of texto) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    if ((ch === ',' || ch === '.') && !separadorUsado) {
      out += ch;
      separadorUsado = true;
    }
  }
  return out;
}

function normalizarTiempoInput(texto: string): string {
  return texto.replace(/[^\d]/g, '');
}

function normalizarEnteroInput(texto: string): string {
  return texto.replace(/[^\d]/g, '');
}

export function EjercicioRutinaCard({
  data,
  onChange,
  onMoveUp,
  onMoveDown,
  onReplace,
  onDelete,
  canMoveUp,
  canMoveDown,
  modo = 'rutina',
  textoAnteriorSeries,
  recordFlagsSeries,
  nota,
  onNotaChange,
}: Props) {
  const router = useRouter();
  const { c, f, ts, s, r, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);
  const esEntreno = modo === 'entreno';
  const esCardioCard = esTrackingCardio(data.tracking_mode);
  const esCardioEntreno = esEntreno && esCardioCard;
  const cardioTieneDistancia = data.tracking_mode === 'cardio_time_distance';
  const { height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const aiSheetH = Math.round(windowH * 0.85);

  const [menuEjercicio, setMenuEjercicio] = useState(false);
  const [menuSetId, setMenuSetId] = useState<string | null>(null);
  const [modalIaAbierto, setModalIaAbierto] = useState(false);
  const [iaPregunta, setIaPregunta] = useState('');
  const [notaAbierta, setNotaAbierta] = useState(false);

  const opcionesEjercicio: OpcionMenuItem[] = useMemo(
    () => [
      { key: 'up', label: 'Subir', onPress: onMoveUp, separatorBefore: false },
      { key: 'down', label: 'Bajar', onPress: onMoveDown, separatorBefore: false },
      { key: 'rep', label: 'Reemplazar', onPress: onReplace, separatorBefore: false },
      { key: 'del', label: 'Eliminar ejercicio', onPress: onDelete, destructive: true, separatorBefore: true },
    ],
    [onMoveUp, onMoveDown, onReplace, onDelete],
  );

  const opcionesTipo = (setId: string): OpcionMenuItem[] => {
    const aplicarTipo = (tipoUi: TipoSerieUi) => {
      onChange({
        ...data,
        sets: actualizarSet(data.sets, setId, { tipoUi }),
      });
    };
    const eliminarSerie = () => {
      if (data.sets.length <= 1) return;
      onChange({
        ...data,
        sets: data.sets.filter((x) => x.setId !== setId).map((x, i) => ({ ...x /* renumber handled in display by index */ })),
      });
    };

    return [
      { key: 'lineal', label: 'Lineal', onPress: () => aplicarTipo('lineal') },
      { key: 'wu', label: 'Warm Up', onPress: () => aplicarTipo('warm_up') },
      { key: 'ts', label: 'Top Set', onPress: () => aplicarTipo('top_set') },
      { key: 'bo', label: 'Back Off', onPress: () => aplicarTipo('back_off') },
      { key: 'ss', label: 'Superserie', onPress: () => aplicarTipo('superserie') },
      {
        key: 'del',
        label: 'Eliminar serie',
        onPress: eliminarSerie,
        destructive: true,
        separatorBefore: true,
      },
    ];
  };

  const añadirSerie = () => {
    onChange({
      ...data,
      sets: [
        ...data.sets,
        { setId: lid(), tipoUi: 'lineal', kg: '', reps: '', rir: '' },
      ],
    });
  };

  const fotoUri =
    data.foto_url != null && String(data.foto_url).trim() !== '' ? String(data.foto_url).trim() : '';

  const renderRecordIcons = (flags: SetRecordFlags | undefined) => {
    if (!tieneRecordFlags(flags)) return null;

    return (
      <View style={styles.recordIconsSlot} pointerEvents="none">
        {flags?.maxWeight ? <PrRecordIcon width={14} height={14} style={styles.recordIcon} /> : null}
        {flags?.maxVolume ? <VolumeRecordIcon width={14} height={14} style={styles.recordIcon} /> : null}
        {flags?.maxDuration ? <TimeRecordIcon width={14} height={14} style={styles.recordIcon} /> : null}
        {flags?.maxDistance ? <KmRecordIcon width={14} height={14} style={styles.recordIcon} /> : null}
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        {esEntreno ? (
          fotoUri ? (
            <Image
              source={{ uri: fotoUri }}
              style={styles.thumbEntrenoImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              autoplay={false}
              recyclingKey={data.exerciseId}
            />
          ) : (
            <View style={styles.thumbEntreno}>
              <Ionicons name="barbell-outline" size={20} color={c.textMuted} />
            </View>
          )
        ) : fotoUri ? (
          <Image
            source={{ uri: fotoUri }}
            style={styles.thumb}
            contentFit="cover"
            cachePolicy="memory-disk"
            autoplay={false}
            recyclingKey={data.exerciseId}
          />
        ) : (
          <View style={styles.thumb}>
            <Ionicons name="barbell-outline" size={22} color={c.textSecondary} />
          </View>
        )}
        <View style={styles.headText}>
          {esEntreno ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/(entrenamiento)/consulta-ejercicio',
                  params: { id: data.exerciseId },
                })
              }
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Ver ficha de ${data.nombre}`}
            >
              <Text style={[styles.nombre, styles.nombreEntrenoLink]} numberOfLines={2}>
                {data.nombre}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.nombre} numberOfLines={2}>
              {data.nombre}
            </Text>
          )}
        </View>
        <Pressable
          style={styles.chatHit}
          onPress={() => setModalIaAbierto(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Chat sobre el ejercicio"
        >
          {isDark ? (
            <LogoDark width={22} height={22} style={styles.chatLogo} />
          ) : (
            <LogoLight width={22} height={22} style={styles.chatLogo} />
          )}
        </Pressable>
        <Pressable style={styles.menuHit} onPress={() => setMenuEjercicio(true)} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={22} color={c.textSecondary} />
        </Pressable>
      </View>

      {esEntreno && onNotaChange ? (
        <>
          <Pressable
            style={styles.notaHeaderRow}
            onPress={() => setNotaAbierta((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: notaAbierta }}
            accessibilityLabel="Nota del ejercicio"
          >
            <Ionicons name="document-text-outline" size={14} color={c.textMuted} />
            <Text style={styles.notaHeaderLabel}>NOTA</Text>
            <View style={styles.notaHeaderSpacer} />
            <Ionicons
              name={notaAbierta ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={c.textMuted}
            />
          </Pressable>
          {notaAbierta ? (
            <View style={styles.notaInputOuter}>
              <TextInput
                style={styles.notaInput}
                multiline
                scrollEnabled
                placeholder="Añade una nota para este ejercicio..."
                placeholderTextColor={c.textMuted}
                value={nota ?? ''}
                onChangeText={onNotaChange}
                textAlignVertical="top"
              />
            </View>
          ) : null}
        </>
      ) : null}

      {esCardioEntreno && data.sets[0] ? (
        <>
          <View style={styles.cardioHead}>
            <View style={styles.cardioColAnt}>
              <Text style={[styles.th, styles.entrenoThCenter]}>ANTERIOR</Text>
            </View>
            <View style={styles.cardioRecordSlot} />
            <View style={styles.cardioColTiempo}>
              <Text style={[styles.th, styles.entrenoThCenter]}>TIEMPO</Text>
            </View>
            {cardioTieneDistancia ? (
              <View style={styles.cardioColKm}>
                <Text style={[styles.th, styles.entrenoThCenter]}>KM</Text>
              </View>
            ) : null}
            <View style={styles.entrenoColCheck} />
          </View>
          <View style={[styles.cardioRow, data.sets[0].completada ? styles.rowHecho : null]}>
            <View style={styles.cardioColAnt}>
              <Text style={[styles.antTxt, styles.entrenoThCenter]} numberOfLines={1} ellipsizeMode="tail">
                {textoAnteriorSeries?.[0] ?? '—'}
              </Text>
            </View>
            <View style={styles.cardioRecordSlot}>{renderRecordIcons(recordFlagsSeries?.[0])}</View>
            <View style={styles.cardioColTiempo}>
              <TextInput
                style={[styles.cardioInput, data.sets[0].completada ? styles.inputHecho : null]}
                placeholder="min"
                placeholderTextColor={c.textMuted}
                value={data.sets[0].duracionSeg ?? ''}
                onChangeText={(t) =>
                  onChange({
                    ...data,
                    sets: actualizarSet(data.sets, data.sets[0]!.setId, { duracionSeg: normalizarTiempoInput(t) }),
                  })
                }
                keyboardType="number-pad"
              />
            </View>
            {cardioTieneDistancia ? (
              <View style={styles.cardioColKm}>
                <TextInput
                  style={[styles.cardioInput, data.sets[0].completada ? styles.inputHecho : null]}
                  placeholder="—"
                  placeholderTextColor={c.textMuted}
                  value={data.sets[0].distanciaKm ?? ''}
                  onChangeText={(t) =>
                    onChange({
                      ...data,
                      sets: actualizarSet(data.sets, data.sets[0]!.setId, { distanciaKm: normalizarDecimalInput(t) }),
                    })
                  }
                  keyboardType="decimal-pad"
                />
              </View>
            ) : null}
            <Pressable
              style={styles.entrenoColCheck}
              onPress={() =>
                onChange({
                  ...data,
                  sets: actualizarSet(data.sets, data.sets[0]!.setId, { completada: !data.sets[0]!.completada }),
                })
              }
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: Boolean(data.sets[0].completada) }}
            >
              <Ionicons
                name={data.sets[0].completada ? 'checkbox' : 'square-outline'}
                size={22}
                color={data.sets[0].completada ? c.success : c.textMuted}
              />
            </Pressable>
          </View>
        </>
      ) : null}

      {!esEntreno && esCardioCard && data.sets[0] ? (
        <>
          <View style={[styles.cardioHead, styles.cardioCompact]}>
            <View style={cardioTieneDistancia ? styles.cardioColTiempoCompact : styles.cardioColTiempo}>
              <Text style={[styles.th, styles.entrenoThCenter]}>TIEMPO (min)</Text>
            </View>
            {cardioTieneDistancia ? (
              <View style={styles.cardioColKmCompact}>
                <Text style={[styles.th, styles.entrenoThCenter]}>KM</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.cardioRow, styles.cardioCompact]}>
            <View style={cardioTieneDistancia ? styles.cardioColTiempoCompact : styles.cardioColTiempo}>
              <TextInput
                style={styles.cardioInput}
                placeholder="—"
                placeholderTextColor={c.textMuted}
                value={data.sets[0].duracionSeg ?? ''}
                onChangeText={(t) =>
                  onChange({
                    ...data,
                    sets: actualizarSet(data.sets, data.sets[0]!.setId, { duracionSeg: normalizarTiempoInput(t) }),
                  })
                }
                keyboardType="number-pad"
              />
            </View>
            {cardioTieneDistancia ? (
              <View style={styles.cardioColKmCompact}>
                <TextInput
                  style={styles.cardioInput}
                  placeholder="—"
                  placeholderTextColor={c.textMuted}
                  value={data.sets[0].distanciaKm ?? ''}
                  onChangeText={(t) =>
                    onChange({
                      ...data,
                      sets: actualizarSet(data.sets, data.sets[0]!.setId, { distanciaKm: normalizarDecimalInput(t) }),
                    })
                  }
                  keyboardType="decimal-pad"
                />
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {!esCardioCard && esEntreno ? (
        <View style={styles.tableHead}>
          <View style={styles.entrenoColSerie}>
            <Text style={[styles.thEntrenoSerie, styles.entrenoThCenter]} numberOfLines={1}>
              S
            </Text>
          </View>
          <View style={styles.entrenoColAnt}>
            <Text style={[styles.th, styles.entrenoThCenter]}>ANTERIOR</Text>
          </View>
          <View style={styles.entrenoColKg}>
            <Text style={[styles.th, styles.entrenoThCenter]}>KG</Text>
          </View>
          <View style={styles.entrenoColReps}>
            <Text style={[styles.th, styles.entrenoThCenter]}>REPS</Text>
          </View>
          <View style={styles.entrenoColRir}>
            <Text style={[styles.th, styles.entrenoThCenter]}>RIR</Text>
          </View>
          <View style={styles.entrenoColCheck} />
          <View style={styles.colMenu} />
        </View>
      ) : !esCardioCard ? (
        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.colSerie]}>SERIE</Text>
          <Text style={[styles.th, styles.colKg]}>KG</Text>
          <Text style={[styles.th, styles.colReps]}>REPS</Text>
          <View style={styles.colMenu} />
        </View>
      ) : null}

      {!esCardioCard ? data.sets.map((set, index) => {
        const abrev = abrevTipoSerieUi(set.tipoUi);
        const accent = accentSerie(c, set.tipoUi);
        const hecho = Boolean(set.completada);
        return (
          <View
            key={set.setId}
            style={[
              styles.row,
              accent ? { borderLeftWidth: 3, borderLeftColor: accent, paddingLeft: s.xs } : null,
              esEntreno && hecho ? styles.rowHecho : null,
            ]}
          >
            {esEntreno ? (
              <View style={styles.entrenoColSerie}>
                <View style={styles.serieNumWrap}>
                  {renderRecordIcons(recordFlagsSeries?.[index])}
                  <Text style={[styles.serieNum, hecho ? { opacity: 0.65 } : null]}>{index + 1}</Text>
                  {abrev ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeTxt}>{abrev}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={[styles.serieNumWrap, styles.colSerie]}>
                {tieneRecordFlags(recordFlagsSeries?.[index]) ? renderRecordIcons(recordFlagsSeries?.[index]) : null}
                <Text style={[styles.serieNum, hecho ? { opacity: 0.65 } : null]}>{index + 1}</Text>
                {abrev ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>{abrev}</Text>
                  </View>
                ) : null}
              </View>
            )}
            {esEntreno ? (
              <View style={styles.entrenoColAnt}>
                <Text
                  style={[styles.antTxt, styles.entrenoThCenter]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {(textoAnteriorSeries != null ? textoAnteriorSeries[index] : null) ?? '—'}
                </Text>
              </View>
            ) : null}
            {esEntreno ? (
              <View style={styles.entrenoColKg}>
                <View style={styles.entrenoInputInner}>
                  <TextInput
                    style={[
                      styles.cellInput,
                      styles.cellInputEntrenoCenter,
                      hecho ? styles.inputHecho : null,
                    ]}
                    placeholder="—"
                    placeholderTextColor={c.textMuted}
                    value={set.kg}
                    onChangeText={(t) =>
                      onChange({
                        ...data,
                        sets: actualizarSet(data.sets, set.setId, { kg: normalizarDecimalInput(t) }),
                      })
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.colKg}>
                <TextInput
                  style={[styles.cellInput, hecho ? styles.inputHecho : null]}
                  placeholder="—"
                  placeholderTextColor={c.textMuted}
                  value={set.kg}
                  onChangeText={(t) =>
                    onChange({
                      ...data,
                      sets: actualizarSet(data.sets, set.setId, { kg: normalizarDecimalInput(t) }),
                    })
                  }
                  keyboardType="decimal-pad"
                />
              </View>
            )}
            {esEntreno ? (
              <View style={styles.entrenoColReps}>
                <View style={styles.entrenoInputInner}>
                  <TextInput
                    style={[
                      styles.cellInput,
                      styles.cellInputEntrenoCenter,
                      hecho ? styles.inputHecho : null,
                    ]}
                    placeholder="—"
                    placeholderTextColor={c.textMuted}
                    value={set.reps}
                    onChangeText={(t) =>
                      onChange({
                        ...data,
                        sets: actualizarSet(data.sets, set.setId, { reps: normalizarEnteroInput(t) }),
                      })
                    }
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.colReps}>
                <TextInput
                  style={[styles.cellInput, hecho ? styles.inputHecho : null]}
                  placeholder="—"
                  placeholderTextColor={c.textMuted}
                  value={set.reps}
                  onChangeText={(t) =>
                    onChange({
                      ...data,
                      sets: actualizarSet(data.sets, set.setId, { reps: normalizarEnteroInput(t) }),
                    })
                  }
                  keyboardType="number-pad"
                />
              </View>
            )}
            {esEntreno ? (
              <View style={styles.entrenoColRir}>
                <View style={styles.entrenoInputInner}>
                  <TextInput
                    style={[
                      styles.cellInput,
                      styles.cellInputEntrenoCenter,
                      styles.rirInput,
                      hecho ? styles.inputHecho : null,
                    ]}
                    placeholder="—"
                    placeholderTextColor={c.textMuted}
                    value={set.rir ?? ''}
                    onChangeText={(t) =>
                      onChange({
                        ...data,
                        sets: actualizarSet(data.sets, set.setId, { rir: normalizarEnteroInput(t) }),
                      })
                    }
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            ) : null}
            {esEntreno ? (
              <Pressable
                style={styles.entrenoColCheck}
                onPress={() =>
                  onChange({
                    ...data,
                    sets: actualizarSet(data.sets, set.setId, { completada: !hecho }),
                  })
                }
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: hecho }}
              >
                <Ionicons
                  name={hecho ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={hecho ? c.success : c.textMuted}
                />
              </Pressable>
            ) : null}
            <Pressable style={styles.colMenu} onPress={() => setMenuSetId(set.setId)} hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={20} color={c.textMuted} />
            </Pressable>
          </View>
        );
      }) : null}

      {!esCardioCard ? (
      <Pressable style={styles.addSerie} onPress={añadirSerie}>
        <Text style={styles.addSerieTxt}>+ AGREGAR SERIE</Text>
      </Pressable>
      ) : null}

      <OpcionesMenuModal
        visible={menuEjercicio}
        onClose={() => setMenuEjercicio(false)}
        options={opcionesEjercicio.filter((o) => {
          if (o.key === 'up' && !canMoveUp) return false;
          if (o.key === 'down' && !canMoveDown) return false;
          return true;
        })}
      />

      <Modal
        visible={modalIaAbierto}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setModalIaAbierto(false);
          setIaPregunta('');
        }}
      >
        <KeyboardAvoidingView
          style={styles.aiModalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setModalIaAbierto(false);
              setIaPregunta('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View
            style={[
              styles.aiModalSheet,
              {
                height: aiSheetH,
                paddingBottom: insets.bottom + s.sm,
              },
            ]}
          >
            <View style={styles.aiModalHeader}>
              <Text style={styles.aiModalTitle}>ACTIVA AI</Text>
              <Pressable
                style={styles.aiModalClose}
                onPress={() => {
                  setModalIaAbierto(false);
                  setIaPregunta('');
                }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={24} color={c.textDisplay} />
              </Pressable>
            </View>
            <ScrollView style={styles.aiModalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.aiBubble}>
                <Text style={styles.aiBubbleText}>
                  Pregunta tus dudas sobre {data.nombre}
                </Text>
              </View>
            </ScrollView>
            <View style={styles.aiInputFooter}>
              <TextInput
                style={styles.aiInputField}
                value={iaPregunta}
                onChangeText={setIaPregunta}
                placeholder="Escribe tu pregunta..."
                placeholderTextColor={c.textMuted}
                multiline
              />
              <Pressable
                style={[
                  styles.aiSendBtn,
                  iaPregunta.trim() === '' && styles.aiSendBtnDisabled,
                ]}
                disabled={iaPregunta.trim() === ''}
                onPress={() => {}}
                accessibilityRole="button"
                accessibilityLabel="Enviar"
              >
                <Ionicons name="send" size={20} color={c.textOnPrimary} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <OpcionesMenuModal
        visible={!esCardioCard && menuSetId != null}
        onClose={() => setMenuSetId(null)}
        options={menuSetId ? opcionesTipo(menuSetId) : []}
      />
    </View>
  );
}
