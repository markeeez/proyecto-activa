import KmRecordIcon from '@/assets/images/trophies/km_record_trophy_icon.svg';
import PrRecordIcon from '@/assets/images/trophies/pr_trophy_icon.svg';
import TimeRecordIcon from '@/assets/images/trophies/time_record_trophy_icon.svg';
import VolumeRecordIcon from '@/assets/images/trophies/volume_record_trophy_icon.svg';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecordShareModal } from '@/components/progreso/RecordShareModal';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import type { RecordType, RecordUsuario } from '@/lib/entrenamientoRecords';
import { entrenamientoService } from '@/services/entrenamiento.service';

const RECORD_LABELS: Record<RecordType, string> = {
  max_weight: 'Peso máximo',
  max_volume: 'Volumen máximo',
  max_duration: 'Tiempo máximo',
  max_distance: 'Km máximo',
};

const RECORD_SUBTITLES: Record<RecordType, string> = {
  max_weight: 'Fuerza',
  max_volume: 'Volumen',
  max_duration: 'Resistencia',
  max_distance: 'Cardio',
};

const TIPOS: RecordType[] = ['max_weight', 'max_volume', 'max_duration', 'max_distance'];

function formatFecha(iso: string): string {
  const d = new Date(iso);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDuracion(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} min`;
}

function formatValor(recordType: RecordType, value: number): string {
  switch (recordType) {
    case 'max_weight':
      return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`;
    case 'max_volume':
      return `${value.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kg`;
    case 'max_duration':
      return formatDuracion(Math.round(value));
    case 'max_distance':
      return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} km`;
  }
}

function formatSerie(record: RecordUsuario): string {
  const { recordType, serie } = record;
  if (!serie) return '';
  if (recordType === 'max_duration') {
    const dur = serie.duracionSeg != null ? formatDuracion(serie.duracionSeg) : '-';
    return `Serie: 1 x ${dur}`;
  }
  if (recordType === 'max_distance') {
    const km = serie.distanciaKm != null
      ? `${serie.distanciaKm.toLocaleString('es-ES', { maximumFractionDigits: 2 })} km`
      : '-';
    return `Serie: 1 x ${km}`;
  }
  const reps = serie.repeticiones != null ? serie.repeticiones : '-';
  if (serie.tipoPeso === 'bodyweight') return `Serie: BW x ${reps}`;
  if (serie.tipoPeso === 'assisted') return `Serie: Asist. x ${reps}`;
  const peso = serie.pesoKg != null ? `${serie.pesoKg} kg` : '-';
  return `Serie: ${reps} x ${peso}`;
}

function textoCompartir(record: RecordUsuario): string {
  return `${record.exerciseNombre} - ${RECORD_LABELS[record.recordType]}: ${formatValor(record.recordType, record.value)}\n${formatSerie(record)}\n${formatFecha(record.achievedAt)}`;
}

function RecordIcon({ recordType, size }: { recordType: RecordType; size: number }) {
  switch (recordType) {
    case 'max_weight':
      return <PrRecordIcon width={size} height={size} />;
    case 'max_volume':
      return <VolumeRecordIcon width={size} height={size} />;
    case 'max_duration':
      return <TimeRecordIcon width={size} height={size} />;
    case 'max_distance':
      return <KmRecordIcon width={size} height={size} />;
  }
}

function SkeletonItem({ bgColor, borderColor }: { bgColor: string; borderColor: string }) {
  return (
    <View style={[stylesStatic.skeletonCard, { backgroundColor: bgColor, borderColor }]}>
      <View style={[stylesStatic.skeletonCircle, { backgroundColor: borderColor }]} />
      <View style={stylesStatic.skeletonTextWrap}>
        <View style={[stylesStatic.skeletonLine, { backgroundColor: borderColor, width: '62%' }]} />
        <View style={[stylesStatic.skeletonLineSm, { backgroundColor: borderColor, width: '44%' }]} />
        <View style={[stylesStatic.skeletonPill, { backgroundColor: borderColor, width: '58%' }]} />
      </View>
      <View style={stylesStatic.skeletonRight}>
        <View style={[stylesStatic.skeletonLine, { backgroundColor: borderColor, width: 64 }]} />
        <View style={[stylesStatic.skeletonLineSm, { backgroundColor: borderColor, width: 52 }]} />
      </View>
    </View>
  );
}

export default function RecordsScreen() {
  const insets = useSafeAreaInsets();
  const { c, f, ts, s, r, isDark } = useTheme();
  const { user } = useAuth();

  const [records, setRecords] = useState<RecordUsuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ordenFecha, setOrdenFecha] = useState<'desc' | 'asc'>('desc');
  const [filtroTipo, setFiltroTipo] = useState<RecordType | null>(null);
  const [mostrarTipos, setMostrarTipos] = useState(false);
  const [recordCompartir, setRecordCompartir] = useState<RecordUsuario | null>(null);

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    setCargando(true);
    try {
      const data = await entrenamientoService.obtenerTodosLosRecords(user.id);
      setRecords(data);
    } finally {
      setCargando(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const recordsFiltrados = useMemo(() => {
    const filtrados = filtroTipo ? records.filter((x) => x.recordType === filtroTipo) : records;
    return ordenFecha === 'asc' ? [...filtrados].reverse() : filtrados;
  }, [records, filtroTipo, ordenFecha]);

  const styles = useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      paddingHorizontal: s.md,
      paddingTop: insets.top + 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    titleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      ...ts.heading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      letterSpacing: 0,
    },
    titleBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: isDark ? 'rgba(0, 212, 255, 0.08)' : c.primaryBg,
    },
    filtersRow: {
      flexDirection: 'row',
      gap: s.sm,
      marginBottom: mostrarTipos ? s.sm : s.lg,
    },
    filterButton: {
      flex: 1,
      height: 42,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    filterButtonActive: {
      borderColor: c.primary,
      backgroundColor: isDark ? 'rgba(0, 212, 255, 0.08)' : c.primaryBg,
    },
    filterText: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      letterSpacing: 0,
    },
    filterTextActive: {
      color: c.primary,
    },
    typePanel: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: s.sm,
      marginBottom: s.lg,
    },
    typeChip: {
      minHeight: 32,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeChipActive: {
      borderColor: c.primary,
      backgroundColor: isDark ? 'rgba(0, 212, 255, 0.08)' : c.primaryBg,
    },
    typeChipText: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      letterSpacing: 0,
    },
    typeChipTextActive: {
      color: c.primary,
    },
    listHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: s.sm,
    },
    listTitle: {
      fontSize: 14,
      lineHeight: 18,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      letterSpacing: 0,
    },
    contador: {
      fontSize: 11,
      lineHeight: 15,
      fontFamily: f.sansBold,
      color: c.primary,
      letterSpacing: 0,
    },
    card: {
      minHeight: 94,
      marginHorizontal: s.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    iconWrap: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    cardInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    cardNombre: {
      fontSize: 13,
      lineHeight: 16,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      letterSpacing: 0,
    },
    cardTipo: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sans,
      color: c.textSecondary,
      letterSpacing: 0,
    },
    seriePill: {
      alignSelf: 'flex-start',
      marginTop: 5,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: r.technical,
      backgroundColor: c.surfaceElevated,
    },
    cardSerie: {
      fontSize: 10,
      lineHeight: 13,
      fontFamily: f.sans,
      color: c.textMuted,
      letterSpacing: 0,
    },
    cardRight: {
      width: 86,
      alignItems: 'flex-end',
      gap: 2,
    },
    cardValor: {
      fontSize: 17,
      lineHeight: 22,
      fontFamily: f.sansBold,
      color: c.primary,
      letterSpacing: 0,
      fontVariant: ['tabular-nums'],
    },
    cardFecha: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sans,
      color: c.textMuted,
      letterSpacing: 0,
    },
    shareBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      marginTop: 6,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: isDark ? '#141414' : c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: s.xl,
      gap: s.sm,
    },
    emptyTitle: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'center',
      letterSpacing: 0,
    },
    emptyText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textMuted,
      textAlign: 'center',
      letterSpacing: 0,
    },
    listContent: {
      paddingBottom: insets.bottom + 92,
      gap: s.sm,
    },
  }), [c, f, ts, s, r, insets, isDark, mostrarTipos]);

  const renderItem = useCallback(({ item }: { item: RecordUsuario }) => (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <RecordIcon recordType={item.recordType} size={30} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardNombre} numberOfLines={1}>{RECORD_LABELS[item.recordType]}</Text>
        <Text style={styles.cardTipo} numberOfLines={1}>{item.exerciseNombre}</Text>
        <View style={styles.seriePill}>
          <Text style={styles.cardSerie} numberOfLines={1}>{formatSerie(item)}</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardValor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
          {formatValor(item.recordType, item.value)}
        </Text>
        <Text style={styles.cardFecha} numberOfLines={1}>{formatFecha(item.achievedAt)}</Text>
        <Pressable
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
          onPress={() => setRecordCompartir(item)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Compartir ${RECORD_LABELS[item.recordType]}`}
        >
          <Ionicons name="share-outline" size={18} color={c.textDisplay} />
        </Pressable>
      </View>
    </View>
  ), [styles, c.textDisplay]);

  const listHeader = (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Records</Text>
          <View style={styles.titleBadge}>
            <Ionicons name="radio-button-on-outline" size={13} color={c.primary} />
          </View>
        </View>
      </View>

      <View style={styles.filtersRow}>
        <Pressable
          style={({ pressed }) => [
            styles.filterButton,
            styles.filterButtonActive,
            pressed && { opacity: 0.76 },
          ]}
          onPress={() => setOrdenFecha((p) => (p === 'desc' ? 'asc' : 'desc'))}
          accessibilityRole="button"
        >
          <Ionicons name="calendar-outline" size={15} color={c.primary} />
          <Text style={[styles.filterText, styles.filterTextActive]}>Filtrar por fecha</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.filterButton,
            filtroTipo != null && styles.filterButtonActive,
            pressed && { opacity: 0.76 },
          ]}
          onPress={() => setMostrarTipos((p) => !p)}
          accessibilityRole="button"
        >
          <Ionicons name="filter-outline" size={15} color={filtroTipo != null ? c.primary : c.textMuted} />
          <Text style={[styles.filterText, filtroTipo != null && styles.filterTextActive]} numberOfLines={1}>
            {filtroTipo ? RECORD_LABELS[filtroTipo] : 'Filtrar por tipo'}
          </Text>
        </Pressable>
      </View>

      {mostrarTipos ? (
        <View style={styles.typePanel}>
          <Pressable
            style={[styles.typeChip, filtroTipo == null && styles.typeChipActive]}
            onPress={() => {
              setFiltroTipo(null);
              setMostrarTipos(false);
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.typeChipText, filtroTipo == null && styles.typeChipTextActive]}>Todos</Text>
          </Pressable>
          {TIPOS.map((tipo) => (
            <Pressable
              key={tipo}
              style={[styles.typeChip, filtroTipo === tipo && styles.typeChipActive]}
              onPress={() => {
                setFiltroTipo((p) => (p === tipo ? null : tipo));
                setMostrarTipos(false);
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.typeChipText, filtroTipo === tipo && styles.typeChipTextActive]}>
                {RECORD_LABELS[tipo]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          {filtroTipo ? RECORD_SUBTITLES[filtroTipo] : 'Todos los records'}
        </Text>
        {!cargando ? <Text style={styles.contador}>{recordsFiltrados.length} records</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {cargando ? (
        <View>
          {listHeader}
          <View style={{ paddingHorizontal: s.md, gap: s.sm }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonItem key={i} bgColor={c.surface} borderColor={c.border} />
            ))}
          </View>
        </View>
      ) : recordsFiltrados.length === 0 ? (
        <View style={{ flex: 1 }}>
          {listHeader}
          <View style={styles.emptyWrap}>
            <Ionicons name="trophy-outline" size={30} color={c.primary} />
            <Text style={styles.emptyTitle}>
              {records.length === 0 ? 'Sin records todavía' : 'Sin resultados'}
            </Text>
            <Text style={styles.emptyText}>
              {records.length === 0
                ? 'Completa un entreno para empezar a registrar tus mejores marcas.'
                : 'No hay records con este filtro.'}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={recordsFiltrados}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <RecordShareModal
        visible={recordCompartir != null}
        onClose={() => setRecordCompartir(null)}
        record={recordCompartir}
        user={user}
        initialDark={isDark}
        fallbackMessage={recordCompartir ? textoCompartir(recordCompartir) : ''}
      />
    </View>
  );
}

const stylesStatic = StyleSheet.create({
  skeletonCard: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  skeletonCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  skeletonTextWrap: {
    flex: 1,
    gap: 6,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 5,
  },
  skeletonLineSm: {
    height: 11,
    borderRadius: 5,
  },
  skeletonPill: {
    height: 18,
    borderRadius: 4,
    marginTop: 4,
  },
  skeletonRight: {
    width: 86,
    alignItems: 'flex-end',
    gap: 7,
  },
});
