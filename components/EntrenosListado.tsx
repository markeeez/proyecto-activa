import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { entrenamientoService, type EntrenoResumen } from '@/services/entrenamiento.service';

const PAGE_SIZE = 15;

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDuracion(horaInicio: string | null, horaFin: string | null): string {
  const placeholder = '\u2014';
  if (!horaInicio || !horaFin) return placeholder;
  const inicioMs = new Date(horaInicio).getTime();
  const finMs = new Date(horaFin).getTime();
  if (Number.isNaN(inicioMs) || Number.isNaN(finMs) || finMs <= inicioMs) return placeholder;
  const duracionMs = finMs - inicioMs;
  const totalSegundos = Math.max(1, Math.round(duracionMs / 1000));
  if (totalSegundos < 60) return `${totalSegundos}s`;
  const mins = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  if (mins < 60) return segundos === 0 ? `${mins}min` : `${mins}min ${segundos}s`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}min`;
}

function formatVolumen(volumenKg: number): string {
  if (!Number.isFinite(volumenKg) || volumenKg <= 0) return '—';
  return `${Math.round(volumenKg).toLocaleString('es-ES')} kg`;
}

export function EntrenosListado() {
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [entrenos, setEntrenos] = useState<EntrenoResumen[]>([]);
  const [pagina, setPagina] = useState(0);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [hayMas, setHayMas] = useState(true);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [menuEntreno, setMenuEntreno] = useState<EntrenoResumen | null>(null);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });
  const [confirmEntreno, setConfirmEntreno] = useState<EntrenoResumen | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: c.background },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        listContent: { paddingTop: s.md, paddingBottom: s.xxl },
        card: {
          backgroundColor: c.surface,
          borderRadius: r.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          marginHorizontal: s.md,
          marginBottom: s.md,
          overflow: 'hidden',
        },
        cardPressed: {
          opacity: 0.78,
        },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: s.md,
          paddingVertical: s.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
          gap: s.sm,
        },
        headerLeft: { flex: 1, minWidth: 0 },
        fecha: { fontSize: 12, lineHeight: 16, fontFamily: f.mono, color: c.textSecondary, marginBottom: 4 },
        nombre: { ...ts.body, fontFamily: f.sansMedium, color: c.primary },
        dotsBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        statsRow: {
          flexDirection: 'row',
          gap: s.xl,
          paddingHorizontal: s.md,
          paddingVertical: s.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        },
        statLabel: { fontSize: 11, lineHeight: 14, fontFamily: f.mono, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
        statValue: { ...ts.body, fontFamily: f.sans, color: c.textDisplay, marginTop: 2 },
        previewWrap: { paddingHorizontal: s.md, paddingTop: s.sm, paddingBottom: s.sm },
        ejercicioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: s.xs },
        img: { width: 36, height: 36, borderRadius: r.sm },
        imgPh: { width: 36, height: 36, borderRadius: r.sm, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
        ejercicioTxt: { ...ts.bodySm, fontFamily: f.sans, color: c.textDisplay, marginLeft: s.sm, flex: 1 },
        toggleMore: { paddingVertical: s.sm, paddingHorizontal: s.md, alignSelf: 'flex-start' },
        toggleMoreTxt: { fontSize: 11, lineHeight: 14, fontFamily: f.mono, color: c.primary },
        footerLoad: { padding: s.md, alignItems: 'center' },
        finTxt: { fontSize: 11, lineHeight: 14, fontFamily: f.mono, color: c.textSecondary, textAlign: 'center', padding: s.md, textTransform: 'uppercase' },
        empty: { ...ts.bodySm, fontFamily: f.sans, color: c.textMuted, textAlign: 'center', padding: s.lg },
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: s.lg },
        modalCard: { backgroundColor: c.surface, borderRadius: r.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderVisible, padding: s.md },
        confirmTitle: { fontSize: 11, lineHeight: 14, fontFamily: f.mono, color: c.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: s.xs },
        confirmBody: { ...ts.bodySm, fontFamily: f.sans, color: c.textDisplay, marginBottom: s.md },
        btnRow: { flexDirection: 'row', gap: s.sm },
        btnGhost: { flex: 1, borderWidth: 1, borderColor: c.borderVisible, borderRadius: r.pill, alignItems: 'center', justifyContent: 'center', paddingVertical: s.sm },
        btnGhostTxt: { ...ts.bodySm, fontFamily: f.sansMedium, color: c.textDisplay },
        btnDanger: { flex: 1, borderWidth: 1, borderColor: c.danger, borderRadius: r.pill, alignItems: 'center', justifyContent: 'center', paddingVertical: s.sm },
        btnDangerTxt: { ...ts.bodySm, fontFamily: f.sansMedium, color: c.danger },
        menuLayer: {
          ...StyleSheet.absoluteFillObject,
          zIndex: 40,
        },
        menuDismiss: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'transparent',
        },
        menuPopover: {
          position: 'absolute',
          width: 190,
          borderWidth: 1,
          borderColor: c.borderVisible,
          borderRadius: r.md,
          backgroundColor: c.surfaceElevated,
          paddingVertical: s.xs,
          paddingHorizontal: s.sm,
          zIndex: 41,
        },
        menuTitle: {
          fontSize: 12,
          lineHeight: 15,
          fontFamily: f.sansBold,
          color: c.textDisplay,
          paddingHorizontal: s.xs,
          paddingVertical: s.xs,
        },
        menuDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: c.borderVisible,
          marginVertical: 2,
        },
        menuOption: {
          minHeight: 34,
          flexDirection: 'row',
          alignItems: 'center',
          gap: s.xs,
          borderRadius: r.sm,
          paddingHorizontal: s.xs,
        },
        menuOptionDanger: {
          fontSize: 12,
          lineHeight: 15,
          fontFamily: f.sansMedium,
          color: c.danger,
        },
      }),
    [c, f, ts, s, r],
  );

  const cargarPagina = useCallback(
    async (p: number, append: boolean) => {
      if (!user?.id) return;
      const rows = await entrenamientoService.obtenerEntrenosPaginados(user.id, p, PAGE_SIZE);
      setHayMas(rows.length === PAGE_SIZE);
      setPagina(p);
      setEntrenos((prev) => (append ? [...prev, ...rows] : rows));
    },
    [user?.id],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!user?.id) {
        setEntrenos([]);
        setCargandoInicial(false);
        return;
      }
      setCargandoInicial(true);
      try {
        const rows = await entrenamientoService.obtenerEntrenosPaginados(user.id, 0, PAGE_SIZE);
        if (!alive) return;
        setEntrenos(rows);
        setHayMas(rows.length === PAGE_SIZE);
        setPagina(0);
      } finally {
        if (alive) setCargandoInicial(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Recargar la primera página cada vez que la pantalla entra en foco.
  // Cubre el caso de borrar desde sesion/[id].tsx y volver aquí.
  useFocusEffect(
    useCallback(() => {
      void cargarPagina(0, false);
    }, [cargarPagina]),
  );

  const onEndReached = useCallback(async () => {
    if (!user?.id || cargandoMas || cargandoInicial || !hayMas) return;
    setCargandoMas(true);
    try {
      await cargarPagina(pagina + 1, true);
    } finally {
      setCargandoMas(false);
    }
  }, [user?.id, cargandoMas, cargandoInicial, hayMas, cargarPagina, pagina]);

  const onEliminar = useCallback(async () => {
    if (!confirmEntreno || eliminandoId) return;
    const id = confirmEntreno.id;
    const prev = entrenos;
    setEliminandoId(id);
    setConfirmEntreno(null);
    setEntrenos((rows) => rows.filter((x) => x.id !== id));
    try {
      await entrenamientoService.eliminarEntreno(id);
    } catch {
      setEntrenos(prev);
    } finally {
      setEliminandoId(null);
    }
  }, [confirmEntreno, eliminandoId, entrenos]);

  if (cargandoInicial) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={entrenos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<Text style={styles.empty}>No hay entrenos todavía.</Text>}
        ListFooterComponent={
          cargandoMas ? (
            <View style={styles.footerLoad}>
              <ActivityIndicator size="small" color={c.primary} />
            </View>
          ) : !hayMas && entrenos.length > 0 ? (
            <Text style={styles.finTxt}>[FIN]</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const expanded = Boolean(expandidos[item.id]);
          const visibles = expanded ? item.ejercicios : item.ejercicios.slice(0, 3);
          const hiddenCount = Math.max(0, item.totalEjercicios - 3);
          const title = item.nombre?.trim() || item.rutinaNombre?.trim() || 'Entreno';
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(`/(tabs)/(perfil)/sesion/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir entreno ${title}`}
            >
              <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                  <Text style={styles.fecha}>{formatFecha(item.fecha)}</Text>
                  <Text style={styles.nombre}>{title}</Text>
                </View>
                <Pressable
                  style={styles.dotsBtn}
                  onPress={(event) => {
                    event.stopPropagation();
                    setMenuAnchor({
                      x: event.nativeEvent.pageX,
                      y: event.nativeEvent.pageY,
                    });
                    setMenuEntreno(item);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir menú de entreno"
                >
                  <Ionicons name="ellipsis-vertical" size={22} color={c.textMuted} />
                </Pressable>
              </View>
              <View style={styles.statsRow}>
                <View>
                  <Text style={styles.statLabel}>Tiempo</Text>
                  <Text style={styles.statValue}>{formatDuracion(item.horaInicio, item.horaFin)}</Text>
                </View>
                <View>
                  <Text style={styles.statLabel}>Volumen</Text>
                  <Text style={styles.statValue}>{formatVolumen(item.volumenKg)}</Text>
                </View>
              </View>
              <View style={styles.previewWrap}>
                {visibles.map((ex) => (
                  <View key={`${item.id}-${ex.ejercicioId}`} style={styles.ejercicioRow}>
                    {ex.fotoUrl ? (
                      <Image source={{ uri: ex.fotoUrl }} style={styles.img} contentFit="cover" cachePolicy="memory-disk" autoplay={false} />
                    ) : (
                      <View style={styles.imgPh}>
                        <Ionicons name="barbell-outline" size={16} color={c.textMuted} />
                      </View>
                    )}
                    <Text style={styles.ejercicioTxt}>{`${ex.numSeries} series ${ex.nombre}`}</Text>
                  </View>
                ))}
                {item.totalEjercicios > 3 ? (
                  <Pressable
                    style={styles.toggleMore}
                    onPress={(event) => {
                      event.stopPropagation();
                      setExpandidos((p) => ({ ...p, [item.id]: !expanded }));
                    }}
                  >
                    <Text style={styles.toggleMoreTxt}>
                      {expanded ? 'Ver menos' : `Ver ${hiddenCount} más ejercicios`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      {menuEntreno && (
        <View style={styles.menuLayer} pointerEvents="box-none">
          <Pressable style={styles.menuDismiss} onPress={() => setMenuEntreno(null)} />
          <View
            style={[
              styles.menuPopover,
              {
                top: Math.min(menuAnchor.y + 10, windowHeight - 96),
                left: Math.min(Math.max(menuAnchor.x - 176, s.md), windowWidth - 206),
              },
            ]}
          >
            <Text style={styles.menuTitle} numberOfLines={1}>
              {menuEntreno.nombre?.trim() || menuEntreno.rutinaNombre?.trim() || 'Entreno'}
            </Text>
            <View style={styles.menuDivider} />
            <Pressable
              style={styles.menuOption}
              onPress={() => {
                setConfirmEntreno(menuEntreno);
                setMenuEntreno(null);
              }}
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={17} color={c.danger} />
              <Text style={styles.menuOptionDanger}>Eliminar entreno</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal visible={confirmEntreno != null} transparent animationType="fade" onRequestClose={() => setConfirmEntreno(null)}>
        <Pressable style={styles.overlay} onPress={() => setConfirmEntreno(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.confirmTitle}>Eliminar entreno</Text>
            <Text style={styles.confirmBody}>
              ¿Seguro que quieres eliminar este entreno? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.btnRow}>
              <Pressable style={styles.btnGhost} onPress={() => setConfirmEntreno(null)}>
                <Text style={styles.btnGhostTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.btnDanger} onPress={() => void onEliminar()} disabled={Boolean(eliminandoId)}>
                {eliminandoId ? <ActivityIndicator size="small" color={c.danger} /> : <Text style={styles.btnDangerTxt}>Eliminar</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
