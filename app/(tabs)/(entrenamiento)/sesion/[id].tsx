/**
 * Detalle de sesión finalizada — solo lectura.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import type { TipoSerie } from '@/types/database.types';
import {
  entrenamientoService,
  type DetalleSesion,
  type DetalleSesionSet,
} from '@/services/entrenamiento.service';

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatFechaCabecera(ymd: string): string {
  const dt = parseYmdLocal(ymd);
  const s = dt.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatHora(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDuracionSesion(hora_inicio: string | null, hora_fin: string | null): string {
  if (hora_fin == null) return 'En curso';
  const m = entrenamientoService.calcularDuracionMinutos(hora_inicio, hora_fin);
  if (m <= 0) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}min`;
}

function badgeTipoSerie(t: TipoSerie): string {
  switch (t) {
    case 'warm_up':
      return 'WU';
    case 'top_set':
      return 'TS';
    case 'back_off':
      return 'BO';
    case 'superset':
      return 'SS';
    case 'lineal':
    default:
      return 'LIN';
  }
}

function celdaKg(set: DetalleSesionSet): string {
  if (set.tipo_peso === 'bodyweight' && set.peso_kg == null) return 'BW';
  if (set.peso_kg == null) return '—';
  return String(set.peso_kg);
}

const TIPOS_SERIE_LEYENDA = [
  { siglas: 'LIN', nombre: 'Lineal', desc: 'Serie estándar progresiva' },
  { siglas: 'WU', nombre: 'Warm Up', desc: 'Serie de calentamiento, no cuenta para el volumen' },
  { siglas: 'TS', nombre: 'Top Set', desc: 'Serie de mayor intensidad del ejercicio' },
  { siglas: 'BO', nombre: 'Back Off', desc: 'Serie a menor intensidad tras el top set' },
  { siglas: 'SS', nombre: 'Superset', desc: 'Combinada con el ejercicio siguiente' },
] as const;

export default function DetalleSesionPantalla() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const sessionId = Array.isArray(idParam) ? idParam[0] : idParam;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, f, ts, s, r } = useTheme();

  const [detalle, setDetalle] = useState<DetalleSesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [modalTipos, setModalTipos] = useState(false);

  const cargar = useCallback(async () => {
    if (!sessionId) {
      setError('Sesión no válida.');
      setCargando(false);
      setDetalle(null);
      return;
    }
    setCargando(true);
    setError(null);
    const data = await entrenamientoService.obtenerDetalleSesion(sessionId);
    if (!data) {
      setError('No se pudo cargar la sesión.');
      setDetalle(null);
    } else {
      setDetalle(data);
    }
    setCargando(false);
  }, [sessionId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: c.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + s.xs,
          paddingBottom: s.sm,
          paddingHorizontal: s.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          backgroundColor: c.surface,
        },
        headerSide: {
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerTitle: {
          flex: 1,
          ...ts.subheading,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          textAlign: 'center',
        },
        gapHeaderMetrics: {
          height: s.md,
        },
        metricsWrap: {
          marginHorizontal: s.md,
          marginBottom: s.md,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.borderVisible,
          borderRadius: r.lg,
          overflow: 'hidden',
        },
        metricsRow: {
          flexDirection: 'row',
        },
        metricsCell: {
          flex: 1,
          minWidth: 0,
          padding: s.md,
          justifyContent: 'center',
        },
        metricsCellSepV: {
          borderRightWidth: 1,
          borderRightColor: c.border,
        },
        metricsCellSepH: {
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        metricLbl: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.65,
          marginBottom: s.xs,
        },
        metricValFecha: {
          ...ts.body,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
        },
        metricValDur: {
          ...ts.heading,
          fontFamily: f.monoBold,
          color: c.textDisplay,
          letterSpacing: -0.2,
        },
        metricValHora: {
          ...ts.body,
          fontFamily: f.mono,
          color: c.textDisplay,
        },
        metricValEnCurso: {
          ...ts.body,
          fontFamily: f.mono,
          color: c.primary,
          letterSpacing: 0.5,
        },
        scroll: {
          flex: 1,
        },
        scrollContent: {
          paddingHorizontal: s.md,
          paddingTop: 0,
          paddingBottom: insets.bottom + s.xl,
        },
        cardEj: {
          borderWidth: 1,
          borderColor: c.borderVisible,
          borderRadius: r.md,
          backgroundColor: c.surface,
          padding: s.md,
          marginBottom: s.md,
        },
        ejRowHead: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: s.sm,
          marginBottom: s.sm,
        },
        ejImg48: {
          width: 48,
          height: 48,
          borderRadius: 8,
        },
        ejImgPh: {
          width: 48,
          height: 48,
          borderRadius: 8,
          backgroundColor: c.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        ejCabTextCol: {
          flex: 1,
          minWidth: 0,
        },
        ejTitulo: {
          ...ts.body,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          marginBottom: 2,
        },
        ejNombreLink: {
          color: c.primary,
        },
        ejMusculo: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
        },
        ejNotaFila: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: s.xs,
          paddingVertical: s.xs,
          marginBottom: s.xs,
        },
        ejNotaTxt: {
          flex: 1,
          minWidth: 0,
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          fontStyle: 'italic',
        },
        tablaHead: {
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          paddingBottom: s.xs,
          marginBottom: s.xs,
        },
        colSerie: {
          flex: 0.5,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        colKg: {
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        colReps: {
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        colTipo: {
          flex: 0.8,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        thTipoHeadRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        thTextTipo: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.5,
          textAlign: 'center',
        },
        thText: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.5,
          textAlign: 'center',
          width: '100%',
        },
        fila: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 4,
        },
        tdText: {
          ...ts.body,
          fontFamily: f.mono,
          color: c.textDisplay,
          textAlign: 'center',
          width: '100%',
        },
        badge: {
          paddingHorizontal: 4,
          paddingVertical: 2,
          borderRadius: r.technical,
          backgroundColor: c.primaryBg,
          borderWidth: 1,
          borderColor: c.primary,
        },
        badgeTxt: {
          ...ts.caption,
          fontFamily: f.monoBold,
          fontSize: 9,
          color: c.primary,
          letterSpacing: 0.3,
        },
        vacioEj: {
          ...ts.bodySm,
          fontFamily: f.sans,
          color: c.textMuted,
          fontStyle: 'italic',
        },
        centerState: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: s.lg,
          gap: s.md,
        },
        errTxt: {
          ...ts.body,
          fontFamily: f.sans,
          color: c.danger,
          textAlign: 'center',
        },
        retryBtn: {
          paddingVertical: s.sm,
          paddingHorizontal: s.lg,
          borderRadius: r.technical,
          borderWidth: 1,
          borderColor: c.primary,
          backgroundColor: c.primaryBg,
        },
        retryTxt: {
          ...ts.label,
          fontFamily: f.mono,
          color: c.primary,
          letterSpacing: 0.6,
        },
        delModalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          paddingHorizontal: s.lg,
          position: 'relative',
        },
        delModalDismissLayer: {
          ...StyleSheet.absoluteFillObject,
        },
        delModalCard: {
          backgroundColor: c.surface,
          borderRadius: r.lg,
          borderWidth: 1,
          borderColor: c.borderVisible,
          padding: s.lg,
          zIndex: 1,
          maxWidth: '100%',
        },
        delModalTitle: {
          ...ts.subheading,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          marginBottom: s.sm,
        },
        delModalBody: {
          ...ts.body,
          fontFamily: f.sans,
          color: c.textSecondary,
          marginBottom: s.lg,
        },
        delModalRow: {
          flexDirection: 'row',
          gap: s.sm,
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        },
        delBtnGhost: {
          paddingVertical: s.sm,
          paddingHorizontal: s.md,
          borderRadius: r.technical,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: 'transparent',
        },
        delBtnGhostTxt: {
          ...ts.label,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.5,
        },
        delBtnDanger: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s.sm,
          minWidth: 120,
          paddingVertical: s.sm,
          paddingHorizontal: s.md,
          borderRadius: r.technical,
          backgroundColor: c.danger,
        },
        delBtnDangerTxt: {
          ...ts.label,
          fontFamily: f.mono,
          color: '#FFFFFF',
          letterSpacing: 0.5,
        },
        tiposModalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          paddingHorizontal: s.lg,
          position: 'relative',
        },
        tiposModalCard: {
          backgroundColor: c.surface,
          borderRadius: r.lg,
          borderWidth: 1,
          borderColor: c.borderVisible,
          padding: s.lg,
          zIndex: 1,
          maxWidth: '100%',
          maxHeight: '88%',
        },
        tiposModalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: s.md,
          gap: s.sm,
        },
        tiposModalTitle: {
          ...ts.subheading,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          flex: 1,
        },
        tiposModalScroll: {
          maxHeight: 360,
        },
        tipoLeyendaFila: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: s.sm,
          marginBottom: s.md,
        },
        tipoLeyendaTxtCol: {
          flex: 1,
          minWidth: 0,
        },
        tipoLeyendaNombre: {
          ...ts.body,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          marginBottom: 2,
        },
        tipoLeyendaDesc: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.4,
        },
        tiposModalCerrar: {
          marginTop: s.md,
          paddingVertical: s.sm,
          paddingHorizontal: s.md,
          borderRadius: r.technical,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: 'transparent',
          alignItems: 'center',
        },
        tiposModalCerrarTxt: {
          ...ts.label,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.5,
        },
      }),
    [c, f, ts, s, r, insets.bottom, insets.top],
  );

  const onConfirmarEliminar = useCallback(async () => {
    if (!sessionId || eliminando) return;
    setEliminando(true);
    try {
      await entrenamientoService.eliminarSesion(sessionId);
      setModalEliminar(false);
      router.replace({
        pathname: '/(tabs)/(entrenamiento)',
        params: { reload: Date.now().toString() },
      });
    } catch {
      setEliminando(false);
      Alert.alert('Error', 'No se pudo eliminar la sesión.');
    }
  }, [sessionId, eliminando, router]);

  const tituloSesion = (detalle?.nombre ?? 'Sesión').trim() || 'Sesión';

  if (cargando && !detalle && !error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.safe, styles.centerState]}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </>
    );
  }

  if (error && !detalle) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.safe}>
          <View style={styles.header}>
            <Pressable
              style={styles.headerSide}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Volver"
            >
              <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Sesión
            </Text>
            <View style={styles.headerSide} />
          </View>
          <View style={styles.centerState}>
            <Text style={styles.errTxt}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={cargar}>
              <Text style={styles.retryTxt}>REINTENTAR</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  if (!detalle) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerSide}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {tituloSesion}
          </Text>
          <View style={styles.headerSide}>
            {eliminando ? (
              <ActivityIndicator size="small" color={c.danger} />
            ) : (
              <Pressable
                onPress={() => setModalEliminar(true)}
                disabled={eliminando}
                accessibilityRole="button"
                accessibilityLabel="Eliminar entreno"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
              >
                <Ionicons name="trash-outline" size={22} color={c.danger} />
              </Pressable>
            )}
          </View>
        </View>

        <Modal
          visible={modalEliminar}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!eliminando) setModalEliminar(false);
          }}
        >
          <View style={styles.delModalBackdrop}>
            <Pressable
              style={styles.delModalDismissLayer}
              onPress={() => {
                if (!eliminando) setModalEliminar(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            />
            <View style={styles.delModalCard}>
              <Text style={styles.delModalTitle}>Eliminar entreno</Text>
              <Text style={styles.delModalBody}>
                Esta acción no se puede deshacer. Se eliminará el entreno y todos sus datos.
              </Text>
              <View style={styles.delModalRow}>
                <Pressable
                  style={styles.delBtnGhost}
                  onPress={() => {
                    if (!eliminando) setModalEliminar(false);
                  }}
                  disabled={eliminando}
                  accessibilityRole="button"
                >
                  <Text style={styles.delBtnGhostTxt}>CANCELAR</Text>
                </Pressable>
                <Pressable
                  style={styles.delBtnDanger}
                  onPress={onConfirmarEliminar}
                  disabled={eliminando}
                  accessibilityRole="button"
                >
                  {eliminando ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.delBtnDangerTxt}>ELIMINAR</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={modalTipos}
          transparent
          animationType="fade"
          onRequestClose={() => setModalTipos(false)}
        >
          <View style={styles.tiposModalBackdrop}>
            <Pressable
              style={styles.delModalDismissLayer}
              onPress={() => setModalTipos(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            />
            <View style={styles.tiposModalCard}>
              <View style={styles.tiposModalHeader}>
                <Text style={styles.tiposModalTitle}>Tipos de serie</Text>
                <Pressable
                  onPress={() => setModalTipos(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color={c.textDisplay} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.tiposModalScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {TIPOS_SERIE_LEYENDA.map((row) => (
                  <View key={row.siglas} style={styles.tipoLeyendaFila}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeTxt}>{row.siglas}</Text>
                    </View>
                    <View style={styles.tipoLeyendaTxtCol}>
                      <Text style={styles.tipoLeyendaNombre}>{row.nombre}</Text>
                      <Text style={styles.tipoLeyendaDesc}>{row.desc}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Pressable
                style={styles.tiposModalCerrar}
                onPress={() => setModalTipos(false)}
                accessibilityRole="button"
              >
                <Text style={styles.tiposModalCerrarTxt}>CERRAR</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={styles.gapHeaderMetrics} />

        <View style={styles.metricsWrap}>
          <View style={styles.metricsRow}>
            <View style={[styles.metricsCell, styles.metricsCellSepV, styles.metricsCellSepH]}>
              <Text style={styles.metricLbl}>FECHA</Text>
              <Text style={styles.metricValFecha}>{formatFechaCabecera(detalle.fecha)}</Text>
            </View>
            <View style={[styles.metricsCell, styles.metricsCellSepH]}>
              <Text style={styles.metricLbl}>DURACIÓN</Text>
              <Text style={styles.metricValDur}>
                {formatDuracionSesion(detalle.hora_inicio, detalle.hora_fin)}
              </Text>
            </View>
          </View>
          <View style={styles.metricsRow}>
            <View style={[styles.metricsCell, styles.metricsCellSepV]}>
              <Text style={styles.metricLbl}>INICIO</Text>
              <Text style={styles.metricValHora}>{formatHora(detalle.hora_inicio)}</Text>
            </View>
            <View style={styles.metricsCell}>
              <Text style={styles.metricLbl}>FIN</Text>
              {detalle.hora_fin == null ? (
                <Text style={styles.metricValEnCurso}>EN CURSO</Text>
              ) : (
                <Text style={styles.metricValHora}>{formatHora(detalle.hora_fin)}</Text>
              )}
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {detalle.ejercicios.map((ej) => {
            const setsHechas = ej.sets.filter((st) => st.completada);
            return (
              <View key={ej.id} style={styles.cardEj}>
                <View style={styles.ejRowHead}>
                  {ej.foto_url != null && ej.foto_url.trim() !== '' ? (
                    <Image
                      source={{ uri: ej.foto_url.trim() }}
                      style={styles.ejImg48}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      autoplay={false}
                      recyclingKey={ej.exercise_id}
                    />
                  ) : (
                    <View style={styles.ejImgPh}>
                      <Ionicons name="barbell-outline" size={20} color={c.textMuted} />
                    </View>
                  )}
                  <View style={styles.ejCabTextCol}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(tabs)/(entrenamiento)/consulta-ejercicio',
                          params: { id: ej.exercise_id },
                        })
                      }
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`Ver ficha de ${ej.nombre}`}
                    >
                      <Text style={[styles.ejTitulo, styles.ejNombreLink]}>{ej.nombre}</Text>
                    </Pressable>
                    {ej.musculo_primario ? (
                      <Text style={styles.ejMusculo}>{ej.musculo_primario}</Text>
                    ) : null}
                  </View>
                </View>
                {ej.notas != null && ej.notas.trim() !== '' ? (
                  <View style={styles.ejNotaFila}>
                    <Ionicons name="document-text-outline" size={14} color={c.textSecondary} />
                    <Text style={styles.ejNotaTxt}>{ej.notas.trim()}</Text>
                  </View>
                ) : null}
                {setsHechas.length === 0 ? (
                  <Text style={styles.vacioEj}>Sin series registradas</Text>
                ) : (
                  <>
                    <View style={styles.tablaHead}>
                      <View style={styles.colSerie}>
                        <Text style={styles.thText}>SERIE</Text>
                      </View>
                      <View style={styles.colKg}>
                        <Text style={styles.thText}>KG</Text>
                      </View>
                      <View style={styles.colReps}>
                        <Text style={styles.thText}>REPS</Text>
                      </View>
                      <View style={styles.colTipo}>
                        <View style={styles.thTipoHeadRow}>
                          <Text style={styles.thTextTipo}>TIPO</Text>
                          <Pressable
                            onPress={() => setModalTipos(true)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Información sobre tipos de serie"
                          >
                            <Ionicons
                              name="information-circle-outline"
                              size={14}
                              color={c.textSecondary}
                            />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                    {setsHechas.map((st, idx) => (
                      <View key={`${ej.id}-set-${idx}`} style={styles.fila}>
                        <View style={styles.colSerie}>
                          <Text style={styles.tdText}>{st.numero_serie}</Text>
                        </View>
                        <View style={styles.colKg}>
                          <Text style={styles.tdText}>{celdaKg(st)}</Text>
                        </View>
                        <View style={styles.colReps}>
                          <Text style={styles.tdText}>
                            {st.repeticiones != null ? String(st.repeticiones) : '—'}
                          </Text>
                        </View>
                        <View style={styles.colTipo}>
                          <View style={styles.badge}>
                            <Text style={styles.badgeTxt}>{badgeTipoSerie(st.tipo_serie)}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}
