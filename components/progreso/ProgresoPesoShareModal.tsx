import { Ionicons } from '@expo/vector-icons';
import { useFont } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { captureRef } from 'react-native-view-shot';
import { CartesianChart, Line } from 'victory-native';

import LogoDark from '@/assets/images/logo_sb.svg';
import LogoLight from '@/assets/images/logo_light_sb.svg';
import VerticeLogo from '@/assets/images/VERTICE.svg';
import VerticeLogoLight from '@/assets/images/VERTICE_light.svg';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { parseFechaLocal } from '@/lib/fechaNutricion';

const SPACE_MONO_CHART = require('@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf');

export type RangoShare = '1w' | '3m' | '1y';
export type PuntoPesoShare = { x: string; y: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  datos: PuntoPesoShare[];
  rango: RangoShare;
  pesoHoy: number | null;
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

const ACCENT = '#00D4FF';

type ShareTheme = 'light' | 'dark';

export function ProgresoPesoShareModal({
  visible,
  onClose,
  datos,
  rango,
  pesoHoy,
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

  const compartir = async () => {
    if (compartiendo) return;
    setCompartiendo(true);
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { dialogTitle: 'Compartir peso', mimeType: 'image/png' });
        } else {
          await Share.share({ message: fallbackMessage });
        }
      } catch (sharingError) {
        console.warn('[ProgresoPesoShareModal] native image share unavailable', sharingError);
        await Share.share({ message: fallbackMessage });
      }
      onClose();
    } catch (error) {
      console.warn('[ProgresoPesoShareModal] fallback share', error);
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
                <Text style={[styles.title, { color: c.textDisplay }]}>Peso corporal</Text>
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
                          PESO CORPORAL
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
                        {pesoHoy != null ? pesoHoy.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '—'}
                      </Text>
                      <Text style={[styles.heroUnit, { color: cardMuted }]}>
                        {pesoHoy != null ? 'kg hoy' : 'sin registro hoy'}
                      </Text>
                    </View>

                    <View style={styles.chartWrap}>
                      <ChartLinea datos={datos} color={ACCENT} colorEje={cardMuted} colorGrid={cardLine} />
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

function ChartLinea({
  datos,
  color,
  colorEje,
  colorGrid,
}: {
  datos: PuntoPesoShare[];
  color: string;
  colorEje: string;
  colorGrid: string;
}) {
  const font = useFont(SPACE_MONO_CHART, 9);
  if (datos.length < 2) {
    return (
      <View style={[styles.chartEmpty, { borderColor: colorGrid }]}>
        <Text style={[styles.chartEmptyTxt, { color: colorEje }]}>Sin datos suficientes</Text>
      </View>
    );
  }
  const ys = datos.map((d) => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.max(1, (maxY - minY) * 0.12);
  return (
    <CartesianChart<PuntoPesoShare, 'x', 'y'>
      data={datos}
      xKey="x"
      yKeys={['y']}
      domain={{ y: [Math.max(0, minY - pad), maxY + pad] }}
      domainPadding={{ left: 10, right: 12, top: 16, bottom: 4 }}
      axisOptions={
        font
          ? {
              font,
              formatXLabel: (v) => {
                const d = parseFechaLocal(String(v));
                return `${d.getDate()}/${d.getMonth() + 1}`;
              },
              formatYLabel: (v) => Number(v).toFixed(1),
              labelColor: { x: colorEje, y: colorEje },
              lineColor: { grid: { x: colorGrid, y: colorGrid }, frame: colorGrid },
            }
          : undefined
      }
    >
      {({ points }) => (
        <Line points={points.y} color={color} strokeWidth={2.4} curveType="natural" />
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
  actionBtn: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionPrimaryText: { fontFamily: FontFamily.sansBold, fontSize: 13 },
});
