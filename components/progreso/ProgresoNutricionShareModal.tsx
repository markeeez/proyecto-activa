import { Ionicons } from '@expo/vector-icons';
import { useFont } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { Bar, CartesianChart } from 'victory-native';

import LogoDark from '@/assets/images/logos/logo_sb.svg';
import LogoLight from '@/assets/images/logos/logo_light_sb.svg';
import VerticeLogo from '@/assets/images/logos/VERTICE.svg';
import VerticeLogoLight from '@/assets/images/logos/VERTICE_light.svg';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const SPACE_MONO_CHART = require('@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf');

export type MetricaShare = 'kcal' | 'carbos' | 'proteinas' | 'grasas';
export type RangoShare = '1w' | '3m' | '1y';

export type BarraShare = { x: number; y: number; label: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  datos: BarraShare[];
  metrica: MetricaShare;
  rango: RangoShare;
  promedio: number;
  username: string;
  initialDark: boolean;
  fallbackMessage: string;
};

const CARD_WIDTH = 520;
const CARD_HEIGHT = 400;

const RANGO_LABEL: Record<RangoShare, string> = {
  '1w': 'Últimos 7 días',
  '3m': 'Últimos 3 meses',
  '1y': 'Último año',
};

const METRICA_TITULO: Record<MetricaShare, string> = {
  kcal: 'Consumo calórico',
  carbos: 'Carbohidratos',
  proteinas: 'Proteínas',
  grasas: 'Grasas',
};

const METRICA_UNIDAD: Record<MetricaShare, string> = {
  kcal: 'kcal',
  carbos: 'g',
  proteinas: 'g',
  grasas: 'g',
};

const ACCENT = '#00D4FF';

type ShareTheme = 'light' | 'dark';

export function ProgresoNutricionShareModal({
  visible,
  onClose,
  datos,
  metrica,
  rango,
  promedio,
  username,
  initialDark,
  fallbackMessage,
}: Props) {
  const { c, s, r } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [theme, setTheme] = useState<ShareTheme>(initialDark ? 'dark' : 'light');
  const [compartiendo, setCompartiendo] = useState(false);
  const shareCardRef = useRef<View>(null);

  useEffect(() => {
    if (!visible) return;
    setTheme(initialDark ? 'dark' : 'light');
  }, [visible, initialDark]);

  const isDarkCard = theme === 'dark';
  const cardText = isDarkCard ? '#FFFFFF' : '#080808';
  const cardMuted = isDarkCard ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.55)';
  const cardLine = isDarkCard ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)';
  const cardBg = isDarkCard ? '#050505' : '#F4F6F7';
  const panelBg = isDarkCard ? '#101010' : '#FFFFFF';
  const Logo = isDarkCard ? LogoDark : LogoLight;
  const FooterLogo = isDarkCard ? VerticeLogo : VerticeLogoLight;
  const dotColor = isDarkCard ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';

  const cardRatio = CARD_WIDTH / CARD_HEIGHT;
  const horizontalLimit = windowWidth - 72;
  const maxPreviewHeight = windowHeight - 280;
  const previewWidth = Math.min(horizontalLimit, maxPreviewHeight * cardRatio, 360);
  const previewHeight = previewWidth / cardRatio;
  const previewScale = (previewWidth - 14) / CARD_WIDTH;

  const capturarUri = async (): Promise<string | null> => {
    try {
      return await captureRef(shareCardRef, { format: 'png', quality: 1, result: 'tmpfile' });
    } catch (e) {
      console.warn('[ProgresoNutricionShareModal] capture failed', e);
      return null;
    }
  };

  const guardarEnGaleria = async () => {
    if (compartiendo) return;
    setCompartiendo(true);
    try {
      const uri = await capturarUri();
      if (!uri) { Alert.alert('Error', 'No se pudo capturar la imagen.'); return; }
      const existingPerm = await MediaLibrary.getPermissionsAsync();
      const { status } = existingPerm.granted ? existingPerm : await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para guardar la imagen.'); return; }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Guardado', 'Imagen guardada en tu galería.');
      onClose();
    } catch (e) {
      console.warn('[ProgresoNutricionShareModal] save failed', e);
      Alert.alert('Error', 'No se pudo guardar la imagen.');
    } finally {
      setCompartiendo(false);
    }
  };

  const compartir = async () => {
    if (compartiendo) return;
    setCompartiendo(true);
    try {
      const uri = await capturarUri();
      if (!uri) { await Share.share({ message: fallbackMessage }); onClose(); return; }
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { dialogTitle: 'Compartir gráfico', mimeType: 'image/png' });
        } else {
          await Share.share({ message: fallbackMessage });
        }
      } catch (sharingError) {
        console.warn('[ProgresoNutricionShareModal] native image share unavailable', sharingError);
        await Share.share({ message: fallbackMessage });
      }
      onClose();
    } catch (error) {
      console.warn('[ProgresoNutricionShareModal] fallback share', error);
      await Share.share({ message: fallbackMessage });
    } finally {
      setCompartiendo(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.modalRoot}>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar compartir"
          />
          <View
            style={[
              styles.sheet,
              { backgroundColor: c.surface, borderColor: c.borderVisible, borderRadius: r.lg, maxHeight: windowHeight - 28 },
            ]}
          >
            <View style={styles.header}>
              <View>
                <Text style={[styles.eyebrow, { color: c.textSecondary }]}>COMPARTIR</Text>
                <Text style={[styles.title, { color: c.textDisplay }]}>{METRICA_TITULO[metrica]}</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
                <Ionicons name="close" size={20} color={c.textDisplay} />
              </Pressable>
            </View>

            <View
              style={[
                styles.previewFrame,
                { width: previewWidth, height: previewHeight, backgroundColor: c.background, borderColor: c.border },
              ]}
            >
              <View style={[styles.previewScaler, { transform: [{ scale: previewScale }] }]}>
                <View
                  ref={shareCardRef}
                  collapsable={false}
                  style={[styles.shareCard, { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: cardBg }]}
                >
                  <View style={[styles.innerCard, { backgroundColor: panelBg }]}>
                    <View style={styles.topRow}>
                      <Logo width={42} height={42} />
                      <View style={styles.dotsCluster}>
                        {Array.from({ length: 16 }).map((_, i) => (
                          <View key={i} style={[styles.dot, { backgroundColor: i < 8 ? ACCENT : dotColor }]} />
                        ))}
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaCol}>
                        <Text style={[styles.metaLabel, { color: cardMuted }]}>MÉTRICA</Text>
                        <Text style={[styles.metaValue, { color: cardText }]} numberOfLines={1}>
                          {METRICA_TITULO[metrica].toUpperCase()}
                        </Text>
                      </View>
                      <View style={[styles.metaDivider, { backgroundColor: cardLine }]} />
                      <View style={styles.metaCol}>
                        <Text style={[styles.metaLabel, { color: cardMuted }]}>RANGO</Text>
                        <Text style={[styles.metaValue, { color: cardText }]} numberOfLines={1}>
                          {RANGO_LABEL[rango].toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.heroRow}>
                      <Text style={[styles.heroValue, { color: cardText }]} numberOfLines={1} adjustsFontSizeToFit>
                        {Math.round(promedio).toLocaleString('es-ES')}
                      </Text>
                      <Text style={[styles.heroUnit, { color: cardMuted }]}>
                        {METRICA_UNIDAD[metrica]} promedio diario
                      </Text>
                    </View>

                    <View style={styles.chartWrap}>
                      <ChartBarras datos={datos} color={ACCENT} colorEje={cardMuted} colorGrid={cardLine} />
                    </View>

                    <View style={styles.footerBrand}>
                      <Text style={[styles.username, { color: cardText }]} numberOfLines={1}>
                        {username}
                      </Text>
                      <View style={[styles.footerLine, { backgroundColor: cardLine }]} />
                      <FooterLogo width={78} height={12} />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.controls}>
              <View style={styles.switchRow}>
                <Text style={[styles.controlText, { color: c.textDisplay }]}>Modo oscuro</Text>
                <Switch
                  value={theme === 'dark'}
                  onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
                  trackColor={{ false: c.borderVisible, true: c.primaryBg }}
                  thumbColor={theme === 'dark' ? c.primary : c.textMuted}
                />
              </View>

              <View style={[styles.actionRow, { gap: s.sm }]}>
                <Pressable
                  style={[styles.actionBtn, styles.actionSecondary, { borderColor: c.borderVisible }]}
                  onPress={() => void guardarEnGaleria()}
                  disabled={compartiendo}
                >
                  <Ionicons name="download-outline" size={16} color={c.textDisplay} />
                  <Text style={[styles.actionSecondaryText, { color: c.textDisplay }]}>Guardar</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: c.primary }]}
                  onPress={() => void compartir()}
                  disabled={compartiendo}
                >
                  {compartiendo ? (
                    <ActivityIndicator size="small" color={c.textOnPrimary} />
                  ) : (
                    <Text style={[styles.actionPrimaryText, { color: c.textOnPrimary }]}>Compartir</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ChartBarras({
  datos,
  color,
  colorEje,
  colorGrid,
}: {
  datos: BarraShare[];
  color: string;
  colorEje: string;
  colorGrid: string;
}) {
  const font = useFont(SPACE_MONO_CHART, 9);
  if (datos.length === 0) {
    return (
      <View style={[styles.chartEmpty, { borderColor: colorGrid }]}>
        <Text style={[styles.chartEmptyTxt, { color: colorEje }]}>Sin datos en este rango</Text>
      </View>
    );
  }
  const maxY = Math.max(1, ...datos.map((d) => d.y));
  const n = datos.length;
  const step = n <= 8 ? 1 : n <= 16 ? 2 : 3;
  const formatXLabel = (raw: string | number) => {
    const idx = Math.min(n - 1, Math.max(0, Math.round(Number(raw))));
    const ultima = idx === n - 1;
    if (idx % step !== 0 && !ultima) return '';
    return datos[idx]?.label ?? '';
  };
  return (
    <CartesianChart<BarraShare, 'x', 'y'>
      data={datos}
      xKey="x"
      yKeys={['y']}
      domain={{ y: [0, maxY * 1.12] }}
      domainPadding={{ left: 18, right: 18, top: 16, bottom: 4 }}
      axisOptions={
        font
          ? {
              font,
              formatXLabel,
              formatYLabel: (v) => Math.round(Number(v)).toLocaleString('es-ES'),
              labelColor: { x: colorEje, y: colorEje },
              lineColor: { grid: { x: colorGrid, y: colorGrid }, frame: colorGrid },
            }
          : undefined
      }
    >
      {({ points, chartBounds }) => (
        <Bar
          chartBounds={chartBounds}
          points={points.y}
          roundedCorners={{ topLeft: 3, topRight: 3 }}
          color={color}
        />
      )}
    </CartesianChart>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'center', paddingHorizontal: 18 },
  sheet: { borderWidth: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  eyebrow: { fontFamily: FontFamily.monoBold, fontSize: 10, letterSpacing: 0.8 },
  title: { fontFamily: FontFamily.sansBold, fontSize: 18 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  previewFrame: { alignSelf: 'center', borderRadius: 22, borderWidth: 1, padding: 7, overflow: 'hidden' },
  previewScaler: { flex: 1, transformOrigin: 'top left' },
  shareCard: { borderRadius: 18, overflow: 'hidden' },
  innerCard: { flex: 1, margin: 16, borderRadius: 18, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dotsCluster: { width: 72, flexDirection: 'row', flexWrap: 'wrap-reverse', justifyContent: 'flex-end', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 14 },
  metaCol: { flex: 1, minWidth: 0 },
  metaLabel: { fontFamily: FontFamily.monoBold, fontSize: 9, letterSpacing: 0.8 },
  metaValue: { marginTop: 3, fontFamily: FontFamily.sansBold, fontSize: 12, letterSpacing: 0.4 },
  metaDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  heroValue: { fontFamily: FontFamily.sansBold, fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  heroUnit: { fontFamily: FontFamily.mono, fontSize: 11, letterSpacing: 0.4, flex: 1, minWidth: 0 },
  chartWrap: { flex: 1, marginTop: 8, minHeight: 0 },
  chartEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  chartEmptyTxt: { fontFamily: FontFamily.mono, fontSize: 11 },
  footerBrand: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  username: { fontFamily: FontFamily.monoBold, fontSize: 11, letterSpacing: 0.4, maxWidth: '40%' },
  footerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  controls: { marginTop: 14, gap: 12 },
  switchRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlText: { fontFamily: FontFamily.sansMedium, fontSize: 14 },
  actionRow: { flexDirection: 'row' },
  actionBtn: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  actionSecondary: { borderWidth: 1 },
  actionPrimaryText: { fontFamily: FontFamily.sansBold, fontSize: 13 },
  actionSecondaryText: { fontFamily: FontFamily.sansMedium, fontSize: 13 },
});
