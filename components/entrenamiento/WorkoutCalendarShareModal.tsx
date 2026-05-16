import { Ionicons } from '@expo/vector-icons';
import type { User } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { captureRef } from 'react-native-view-shot';

import LogoDark from '@/assets/images/logo_sb.svg';
import LogoLight from '@/assets/images/logo_light_sb.svg';
import VerticeLogo from '@/assets/images/VERTICE.svg';
import VerticeLogoLight from '@/assets/images/VERTICE_light.svg';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

type Props = {
  visible: boolean;
  onClose: () => void;
  mes: Date;
  diasEntrenados: Set<string>;
  resumen: { sesiones: number; segundos: number; volumenKg: number };
  user: User | null | undefined;
  initialDark: boolean;
  fallbackMessage: string;
};

function formatearTiempoSegundos(totalSegundos: number): string {
  if (totalSegundos <= 0) return '0 min';
  if (totalSegundos < 60) return `${totalSegundos} s`;
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  if (minutos < 60) return segundos === 0 ? `${minutos} min` : `${minutos} min ${segundos} s`;
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  return minutosRestantes === 0 ? `${horas} h` : `${horas} h ${minutosRestantes} min`;
}

function formatearVolumen(kg: number): string {
  const rounded = Math.round(kg);
  return `${rounded.toLocaleString('es-ES')} kg`;
}

const ACCENTS = ['#00D4FF', '#42E66D', '#F2CE24', '#FF8A2A', '#FF4FA3', '#9B5CFF', '#000000'] as const;
const DEFAULT_ACCENT = ACCENTS[0];

const DEFAULT_CARD_WIDTH = 620;
const DEFAULT_CARD_HEIGHT = 480;
const MIN_CARD_RATIO = 0.5;
const MAX_CARD_RATIO = 2.2;
const INNER_CARD_WIDTH = DEFAULT_CARD_WIDTH - 32;
const INNER_CARD_HEIGHT = DEFAULT_CARD_HEIGHT - 32;

const DIAS_CORTO = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

type ShareTheme = 'light' | 'dark';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function construirSemanasDelMes(mes: Date): Date[][] {
  const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const dow = primerDia.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  const inicio = new Date(primerDia);
  inicio.setDate(inicio.getDate() - offset);

  const filas: Date[][] = [];
  const cursor = new Date(inicio);
  while (cursor.getMonth() <= mes.getMonth() || cursor <= primerDia) {
    const fila: Date[] = [];
    for (let i = 0; i < 7; i++) {
      fila.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    filas.push(fila);
    if (cursor.getMonth() > mes.getMonth() && cursor.getFullYear() >= mes.getFullYear()) break;
  }
  return filas;
}

export function WorkoutCalendarShareModal({
  visible,
  onClose,
  mes,
  diasEntrenados,
  resumen,
  user,
  initialDark,
  fallbackMessage,
}: Props) {
  const { c, s, r } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [theme, setTheme] = useState<ShareTheme>(initialDark ? 'dark' : 'light');
  const [personalizando, setPersonalizando] = useState(false);
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoAspect, setPhotoAspect] = useState<{ w: number; h: number } | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [overlayScale, setOverlayScale] = useState(1);
  const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });
  const overlayOffsetRef = useRef(overlayOffset);
  const panStartRef = useRef(overlayOffset);
  const overlayScaleRef = useRef(overlayScale);
  const pinchStartRef = useRef(overlayScale);
  const shareCardRef = useRef<View>(null);

  useEffect(() => {
    if (!visible) return;
    setTheme(initialDark ? 'dark' : 'light');
    setPersonalizando(false);
    setAccent(DEFAULT_ACCENT);
    setPhotoUri(null);
    setPhotoAspect(null);
    setOverlayScale(1);
    setOverlayOffset({ x: 0, y: 0 });
  }, [visible, initialDark]);

  useEffect(() => {
    overlayOffsetRef.current = overlayOffset;
  }, [overlayOffset]);

  useEffect(() => {
    overlayScaleRef.current = overlayScale;
  }, [overlayScale]);

  useEffect(() => {
    if (!visible || !user?.id) {
      setProfileUsername(null);
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();
        if (!cancelado) {
          const username = (profile?.username as string | undefined)?.trim() ?? '';
          setProfileUsername(username || null);
        }
      } catch {
        if (!cancelado) setProfileUsername(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [visible, user?.id]);

  const isDarkCard = personalizando || theme === 'dark';
  const cardText = isDarkCard ? '#FFFFFF' : '#080808';
  const cardMuted = isDarkCard ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.55)';
  const cardLine = isDarkCard ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)';
  const cardBg = isDarkCard ? '#050505' : '#F4F6F7';
  const panelBg = isDarkCard ? '#101010' : '#FFFFFF';
  const Logo = isDarkCard ? LogoDark : LogoLight;
  const FooterLogo = isDarkCard ? VerticeLogo : VerticeLogoLight;
  const accentChanged = personalizando && accent !== DEFAULT_ACCENT;
  const valueColor = accentChanged ? accent : cardText;

  const { cardWidth, cardHeight } = useMemo(() => {
    if (personalizando && photoAspect && photoAspect.w > 0 && photoAspect.h > 0) {
      const ratio = Math.max(MIN_CARD_RATIO, Math.min(MAX_CARD_RATIO, photoAspect.w / photoAspect.h));
      if (ratio >= 1) {
        const base = DEFAULT_CARD_HEIGHT;
        return { cardWidth: Math.round(base * ratio), cardHeight: base };
      }
      const base = DEFAULT_CARD_WIDTH;
      return { cardWidth: base, cardHeight: Math.round(base / ratio) };
    }
    return { cardWidth: DEFAULT_CARD_WIDTH, cardHeight: DEFAULT_CARD_HEIGHT };
  }, [personalizando, photoAspect]);

  const cardRatio = cardWidth / cardHeight;
  const horizontalLimit = windowWidth - 72;
  const maxPreviewHeight = windowHeight - 280;
  const previewWidth = Math.min(horizontalLimit, maxPreviewHeight * cardRatio, 400);
  const previewHeight = previewWidth / cardRatio;
  const previewScale = (previewWidth - 14) / cardWidth;

  const panLimitX = Math.max(40, (cardWidth - INNER_CARD_WIDTH) / 2 + INNER_CARD_WIDTH / 2);
  const panLimitY = Math.max(40, (cardHeight - INNER_CARD_HEIGHT) / 2 + INNER_CARD_HEIGHT / 2);

  const overlayGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Pan()
          .enabled(personalizando)
          .runOnJS(true)
          .minDistance(0)
          .onStart(() => {
            panStartRef.current = overlayOffsetRef.current;
          })
          .onUpdate((event) => {
            const nextX = panStartRef.current.x + event.translationX / previewScale;
            const nextY = panStartRef.current.y + event.translationY / previewScale;
            setOverlayOffset({
              x: Math.max(-panLimitX, Math.min(panLimitX, nextX)),
              y: Math.max(-panLimitY, Math.min(panLimitY, nextY)),
            });
          }),
        Gesture.Pinch()
          .enabled(personalizando)
          .runOnJS(true)
          .onStart(() => {
            pinchStartRef.current = overlayScaleRef.current;
          })
          .onUpdate((event) => {
            setOverlayScale(Math.max(0.3, Math.min(2, pinchStartRef.current * event.scale)));
          }),
      ),
    [personalizando, previewScale, panLimitX, panLimitY],
  );

  const elegirFoto = async (source: 'gallery' | 'camera') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permiso necesario',
        source === 'camera' ? 'Activa la cámara para tomar una foto.' : 'Activa la galería para elegir una foto.',
      );
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    if (asset.width && asset.height) {
      setPhotoAspect({ w: asset.width, h: asset.height });
    } else {
      setPhotoAspect(null);
    }
    setOverlayScale(1);
    setOverlayOffset({ x: 0, y: 0 });
  };

  const compartir = async () => {
    if (compartiendo) return;
    setCompartiendo(true);
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            dialogTitle: 'Compartir calendario',
            mimeType: 'image/png',
          });
        } else {
          await Share.share({ message: fallbackMessage });
        }
      } catch (sharingError) {
        console.warn('[WorkoutCalendarShareModal] native image share unavailable', sharingError);
        await Share.share({ message: fallbackMessage });
      }
      onClose();
    } catch (error) {
      console.warn('[WorkoutCalendarShareModal] fallback share', error);
      await Share.share({ message: fallbackMessage });
    } finally {
      setCompartiendo(false);
    }
  };

  const hoy = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const semanas = useMemo(() => construirSemanasDelMes(mes), [mes]);

  const mesLabel = mes.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
  const usernameLabel = profileUsername ? `@${profileUsername}` : '@tuusuario';

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
                <Text style={[styles.title, { color: c.textDisplay }]}>Calendario</Text>
              </View>
              <Pressable
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={20} color={c.textDisplay} />
              </Pressable>
            </View>

            <View
              style={[
                styles.previewFrame,
                { width: previewWidth, height: previewHeight, backgroundColor: c.background, borderColor: c.border },
              ]}
            >
              <GestureDetector gesture={overlayGesture}>
                <View style={[styles.previewScaler, { transform: [{ scale: previewScale }] }]}>
                  <View
                    ref={shareCardRef}
                    collapsable={false}
                    style={[
                      styles.shareCard,
                      { width: cardWidth, height: cardHeight, backgroundColor: cardBg },
                    ]}
                  >
                    {personalizando && photoUri ? (
                      <Image
                        source={{ uri: photoUri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : null}
                    {personalizando ? <View style={styles.photoShade} /> : null}

                    <View
                      style={[
                        personalizando
                          ? [
                              styles.innerCardPersonalizado,
                              {
                                width: INNER_CARD_WIDTH,
                                height: INNER_CARD_HEIGHT,
                                left: (cardWidth - INNER_CARD_WIDTH) / 2,
                                top: (cardHeight - INNER_CARD_HEIGHT) / 2,
                                transform: [
                                  { translateX: overlayOffset.x },
                                  { translateY: overlayOffset.y },
                                  { scale: overlayScale },
                                ],
                              },
                            ]
                          : [styles.innerCard, { backgroundColor: panelBg }],
                      ]}
                    >
                      <View style={styles.contentCol}>
                        {/* Header centrado: logo + username */}
                        <View style={styles.brandHeader}>
                          <Logo width={32} height={32} />
                          <Text style={[styles.username, { color: valueColor }]} numberOfLines={1}>
                            {usernameLabel}
                          </Text>
                        </View>

                        <View style={styles.calendarSide}>
                          <View style={styles.calHeader}>
                            <View style={styles.calChevron}>
                              <Ionicons name="chevron-back" size={18} color={cardMuted} />
                            </View>
                            <Text style={[styles.calTitle, { color: valueColor }]} numberOfLines={1}>
                              {mesLabel}
                            </Text>
                            <View style={styles.calChevron}>
                              <Ionicons name="chevron-forward" size={18} color={cardMuted} />
                            </View>
                          </View>

                          <View style={styles.weekRow}>
                            {DIAS_CORTO.map((d) => (
                              <Text key={d} style={[styles.weekLabel, { color: cardMuted }]}>{d}</Text>
                            ))}
                          </View>

                          <View style={styles.gridWrap}>
                            {semanas.map((fila, fi) => (
                              <View key={fi} style={styles.weekRow}>
                                {fila.map((dia, di) => {
                                  const ymd = toYmd(dia);
                                  const esMismoMes = dia.getMonth() === mes.getMonth();
                                  const entreno = esMismoMes && diasEntrenados.has(ymd);
                                  const esHoy = mismoDia(dia, hoy);
                                  return (
                                    <View key={di} style={styles.dayCell}>
                                      <View
                                        style={[
                                          styles.dayInner,
                                          entreno && { backgroundColor: accent },
                                          !entreno && esHoy && esMismoMes && { borderWidth: 1, borderColor: accent },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.dayText,
                                            { color: !esMismoMes ? cardMuted : valueColor },
                                            entreno && { color: isDarkCard ? '#000' : '#FFF', fontFamily: FontFamily.sansBold },
                                          ]}
                                        >
                                          {dia.getDate()}
                                        </Text>
                                      </View>
                                    </View>
                                  );
                                })}
                              </View>
                            ))}
                          </View>

                          <View style={styles.monthSummary}>
                            <View style={styles.summaryTitleRow}>
                              <View style={[styles.summaryLine, { backgroundColor: cardLine }]} />
                              <Text style={[styles.summaryTitle, { color: accent }]}>RESUMEN MENSUAL</Text>
                              <View style={[styles.summaryLine, { backgroundColor: cardLine }]} />
                            </View>
                            <View style={styles.metricsRow}>
                              <SummaryMetric
                                icon="barbell-outline"
                                value={String(resumen.sesiones)}
                                label="Sesiones"
                                color={valueColor}
                                muted={cardMuted}
                                accent={accent}
                              />
                              <SummaryMetric
                                icon="time-outline"
                                value={formatearTiempoSegundos(resumen.segundos)}
                                label="Tiempo"
                                color={valueColor}
                                muted={cardMuted}
                                accent={accent}
                              />
                              <SummaryMetric
                                icon="bar-chart"
                                value={formatearVolumen(resumen.volumenKg)}
                                label="Volumen"
                                color={valueColor}
                                muted={cardMuted}
                                accent={accent}
                              />
                            </View>
                          </View>

                          <View style={styles.footerBrand}>
                            <View style={[styles.footerLine, { backgroundColor: cardLine }]} />
                            <FooterLogo width={68} height={10} />
                            <View style={[styles.footerLine, { backgroundColor: cardLine }]} />
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </GestureDetector>
            </View>

            <View style={styles.controls}>
              {!personalizando ? (
                <View style={styles.switchRow}>
                  <Text style={[styles.controlText, { color: c.textDisplay }]}>Modo oscuro</Text>
                  <Switch
                    value={theme === 'dark'}
                    onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
                    trackColor={{ false: c.borderVisible, true: c.primaryBg }}
                    thumbColor={theme === 'dark' ? c.primary : c.textMuted}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.photoActions}>
                    <Pressable
                      style={[styles.secondaryBtn, { borderColor: c.borderVisible }]}
                      onPress={() => void elegirFoto('gallery')}
                    >
                      <Ionicons name="images-outline" size={17} color={c.textDisplay} />
                      <Text style={[styles.secondaryBtnText, { color: c.textDisplay }]}>Galería</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.secondaryBtn, { borderColor: c.borderVisible }]}
                      onPress={() => void elegirFoto('camera')}
                    >
                      <Ionicons name="camera-outline" size={17} color={c.textDisplay} />
                      <Text style={[styles.secondaryBtnText, { color: c.textDisplay }]}>Cámara</Text>
                    </Pressable>
                  </View>
                  <View style={styles.palette}>
                    {ACCENTS.map((color) => (
                      <Pressable
                        key={color}
                        style={[
                          styles.swatch,
                          {
                            backgroundColor: color,
                            borderColor: accent === color ? c.textDisplay : c.borderVisible,
                          },
                        ]}
                        onPress={() => setAccent(color)}
                        accessibilityRole="button"
                        accessibilityLabel={`Color ${color}`}
                      />
                    ))}
                  </View>
                </>
              )}

              <View style={[styles.actionRow, { gap: s.sm }]}>
                <Pressable
                  style={[styles.actionBtn, styles.actionSecondary, { borderColor: c.borderVisible }]}
                  onPress={() => setPersonalizando((value) => !value)}
                  disabled={compartiendo}
                >
                  <Text style={[styles.actionSecondaryText, { color: c.textDisplay }]}>
                    {personalizando ? 'Plantilla' : 'Personalizar'}
                  </Text>
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

function SummaryMetric({
  icon,
  value,
  label,
  color,
  muted,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
  muted: string;
  accent: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricTop}>
        <Ionicons name={icon} size={14} color={accent} />
        <Text style={[styles.metricValue, { color }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={[styles.metricLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: { borderWidth: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  eyebrow: { fontFamily: FontFamily.monoBold, fontSize: 10, letterSpacing: 0.8 },
  title: { fontFamily: FontFamily.sansBold, fontSize: 18 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  previewFrame: {
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 1,
    padding: 7,
    overflow: 'hidden',
  },
  previewScaler: { flex: 1, transformOrigin: 'top left' },
  shareCard: { borderRadius: 18, overflow: 'hidden' },
  photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  innerCard: {
    flex: 1,
    margin: 16,
    borderRadius: 18,
    padding: 18,
  },
  innerCardPersonalizado: {
    position: 'absolute',
    borderRadius: 18,
    padding: 18,
  },
  contentCol: {
    flex: 1,
    flexDirection: 'column',
  },

  // Header centrado: logo + username
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  username: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    letterSpacing: 0.2,
  },

  // Calendar
  calendarSide: {
    flex: 1,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calChevron: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.monoBold,
    fontSize: 14,
    letterSpacing: 1,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.mono,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  gridWrap: {
    marginTop: 2,
    gap: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayInner: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 16,
  },
  monthSummary: {
    marginTop: 12,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  summaryTitle: {
    fontFamily: FontFamily.monoBold,
    fontSize: 9,
    letterSpacing: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metric: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 3,
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 0,
  },
  metricValue: {
    flexShrink: 1,
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    lineHeight: 16,
  },
  metricLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.4,
  },
  footerBrand: {
    marginTop: 'auto',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerLine: { flex: 1, height: StyleSheet.hairlineWidth },

  // Controls
  controls: { marginTop: 14, gap: 12 },
  switchRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlText: { fontFamily: FontFamily.sansMedium, fontSize: 14 },
  photoActions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnText: { fontFamily: FontFamily.sansMedium, fontSize: 12 },
  palette: { flexDirection: 'row', justifyContent: 'space-between' },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  actionRow: { flexDirection: 'row' },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSecondary: { borderWidth: 1 },
  actionSecondaryText: { fontFamily: FontFamily.sansBold, fontSize: 13 },
  actionPrimaryText: { fontFamily: FontFamily.sansBold, fontSize: 13 },
});
