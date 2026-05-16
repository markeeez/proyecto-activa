import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { User } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type MacroData = {
  key: string;
  label: string;
  current: number;
  total: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  kcalConsumed: number;
  kcalTotal: number;
  macros: MacroData[];
  user: User | null | undefined;
  initialDark: boolean;
  fallbackMessage: string;
};

const ACCENTS = ['#00D4FF', '#42E66D', '#F2CE24', '#FF8A2A', '#FF4FA3', '#9B5CFF', '#000000'] as const;
const DEFAULT_ACCENT = ACCENTS[0];

const DEFAULT_CARD_WIDTH = 520;
const DEFAULT_CARD_HEIGHT = 300;
const MIN_CARD_RATIO = 0.5;
const MAX_CARD_RATIO = 2.2;
const INNER_CARD_WIDTH = DEFAULT_CARD_WIDTH - 32;
const INNER_CARD_HEIGHT = DEFAULT_CARD_HEIGHT - 32;

type ShareTheme = 'light' | 'dark';

function formatMacro(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n));
}

function macroIconFor(key: string, color: string) {
  if (key === 'proteinas') {
    return <MaterialCommunityIcons name="food-drumstick-outline" size={18} color={color} />;
  }
  if (key === 'carbos') {
    return <MaterialCommunityIcons name="barley" size={18} color={color} />;
  }
  return <Ionicons name="water-outline" size={18} color={color} />;
}

export function DailyGoalShareModal({
  visible,
  onClose,
  kcalConsumed,
  kcalTotal,
  macros,
  user,
  initialDark,
  fallbackMessage,
}: Props) {
  const { c, s, r } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [theme, setTheme] = useState<ShareTheme>(initialDark ? 'dark' : 'light');
  const [personalizando, setPersonalizando] = useState(false);
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
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
    setAccent(ACCENTS[0]);
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

  const usernameLabel = useMemo(() => {
    const metadata = user?.user_metadata as { username?: string } | undefined;
    const username =
      profileUsername?.trim() ||
      metadata?.username?.trim() ||
      user?.email?.split('@')[0]?.trim() ||
      'usuario';
    return `@${username}`;
  }, [user, profileUsername]);

  const isDarkCard = personalizando || theme === 'dark';
  const cardText = isDarkCard ? '#FFFFFF' : '#080808';
  const cardMuted = isDarkCard ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.55)';
  const cardLine = isDarkCard ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)';
  const cardBg = isDarkCard ? '#050505' : '#F4F6F7';
  const panelBg = isDarkCard ? '#101010' : '#FFFFFF';
  const Logo = isDarkCard ? LogoDark : LogoLight;
  const FooterLogo = isDarkCard ? VerticeLogo : VerticeLogoLight;
  const dotColor = isDarkCard ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
  const accentChanged = personalizando && accent !== DEFAULT_ACCENT;
  const valueColor = accentChanged ? accent : cardText;
  const iconColor = personalizando ? DEFAULT_ACCENT : accent;

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
  const horizontalLimit = Math.max(120, windowWidth - 72);
  const maxPreviewHeight = Math.max(120, windowHeight - 280);
  const previewWidth = Math.min(horizontalLimit, maxPreviewHeight * cardRatio, 360);
  const previewHeight = previewWidth / cardRatio;
  const previewScale = Math.max(0.01, (previewWidth - 14) / cardWidth);

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

  const elegirFoto = useCallback(async (source: 'gallery' | 'camera') => {
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
  }, []);

  const compartir = useCallback(async () => {
    if (compartiendo) return;
    setCompartiendo(true);
    let uri: string | null = null;
    try {
      uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
    } catch (captureError) {
      console.warn('[DailyGoalShareModal] capture failed', captureError);
    }

    try {
      if (uri) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            dialogTitle: 'Compartir objetivo diario',
            mimeType: 'image/png',
            UTI: 'public.png',
          });
        } else {
          await Share.share({ url: uri, message: fallbackMessage });
        }
        onClose();
      } else {
        await Share.share({ message: fallbackMessage });
        onClose();
      }
    } catch (shareError) {
      console.warn('[DailyGoalShareModal] share failed', shareError);
      Alert.alert('No se pudo compartir', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setCompartiendo(false);
    }
  }, [compartiendo, fallbackMessage, onClose]);

  const kcalTotalRounded = Math.round(kcalTotal);
  const dateLabel = useMemo(() => {
    if (!visible) return '';
    const str = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [visible]);

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
                <Text style={[styles.title, { color: c.textDisplay }]}>Objetivo diario</Text>
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
                      <View style={[styles.topRow, personalizando && styles.topRowCentered]}>
                        <Logo width={42} height={42} />
                        {!personalizando ? (
                          <View style={styles.dotsCluster}>
                            {Array.from({ length: 16 }).map((_, i) => (
                              <View
                                key={i}
                                style={[styles.dot, { backgroundColor: i < 8 ? accent : dotColor }]}
                              />
                            ))}
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.contentRow}>
                        <View style={styles.leftCol}>
                          <Text style={[styles.dateLabel, { color: iconColor }]} numberOfLines={1}>
                            {dateLabel}
                          </Text>
                          <Text style={[styles.kcalValue, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
                            {Math.round(kcalConsumed)}
                          </Text>
                          <Text style={[styles.kcalUnit, { color: cardMuted }]}>
                            de {kcalTotalRounded} kcal
                          </Text>
                        </View>

                        <View style={[styles.verticalDivider, { backgroundColor: cardLine }]} />

                        <View style={styles.rightCol}>
                          {macros.map((m) => (
                            <MacroRow
                              key={m.key}
                              icon={macroIconFor(m.key, iconColor)}
                              value={`${formatMacro(m.current)} / ${formatMacro(m.total)} g`}
                              label={m.label.toUpperCase()}
                              text={valueColor}
                              muted={cardMuted}
                            />
                          ))}
                        </View>
                      </View>

                      <View style={styles.footerBrand}>
                        <View style={[styles.footerLine, { backgroundColor: cardLine }]} />
                        <FooterLogo width={78} height={12} />
                        <View style={[styles.footerLine, { backgroundColor: cardLine }]} />
                      </View>

                      <Text style={[styles.usernameFooter, { color: cardMuted }]} numberOfLines={1}>
                        {usernameLabel}
                      </Text>
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

function MacroRow({
  icon,
  value,
  label,
  text,
  muted,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  text: string;
  muted: string;
}) {
  return (
    <View style={styles.macroRow}>
      {icon}
      <View style={styles.macroTextCol}>
        <Text style={[styles.macroValue, { color: text }]}>{value}</Text>
        <Text style={[styles.macroLabel, { color: muted }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    borderWidth: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  eyebrow: {
    fontFamily: FontFamily.monoBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: FontFamily.sansBold,
    fontSize: 18,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFrame: {
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 1,
    padding: 7,
    overflow: 'hidden',
  },
  previewScaler: {
    flex: 1,
    transformOrigin: 'top left',
  },
  shareCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  photoShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  innerCard: {
    flex: 1,
    margin: 16,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
  },
  innerCardPersonalizado: {
    position: 'absolute',
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRowCentered: {
    justifyContent: 'center',
  },
  dotsCluster: {
    width: 72,
    flexDirection: 'row',
    flexWrap: 'wrap-reverse',
    justifyContent: 'flex-end',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  leftCol: {
    width: 220,
    paddingRight: 24,
    justifyContent: 'center',
  },
  dateLabel: {
    marginBottom: 8,
    fontFamily: FontFamily.monoBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  kcalValue: {
    fontFamily: FontFamily.sansBold,
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: -1.4,
  },
  kcalUnit: {
    marginTop: 2,
    fontFamily: FontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  macroTextCol: {
    flex: 1,
    minWidth: 0,
  },
  macroValue: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    lineHeight: 16,
  },
  macroLabel: {
    marginTop: 2,
    fontFamily: FontFamily.monoBold,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 0.6,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  rightCol: {
    width: 180,
    paddingLeft: 24,
    justifyContent: 'center',
  },
  footerBrand: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  usernameFooter: {
    marginTop: 6,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  controls: {
    marginTop: 14,
    gap: 12,
  },
  switchRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
  },
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
  secondaryBtnText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
  },
  palette: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSecondary: {
    borderWidth: 1,
  },
  actionSecondaryText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
  },
  actionPrimaryText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
  },
});
