import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import type { User } from '@supabase/supabase-js';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { captureRef } from 'react-native-view-shot';

import LogoDark from '@/assets/images/logos/logo_sb.svg';
import LogoLight from '@/assets/images/logos/logo_light_sb.svg';
import VerticeLogo from '@/assets/images/logos/VERTICE.svg';
import VerticeLogoLight from '@/assets/images/logos/VERTICE_light.svg';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import type { DetalleSesion } from '@/services/entrenamiento.service';
import {
  crearWorkoutShareData,
  WORKOUT_SHARE_CARD_HEIGHT,
  WORKOUT_SHARE_CARD_WIDTH,
  type WorkoutShareTheme,
} from '@/lib/workoutShare';

const ACCENTS = ['#00D4FF', '#42E66D', '#F2CE24', '#FF8A2A', '#FF4FA3', '#9B5CFF', '#000000'] as const;
const DEFAULT_ACCENT = ACCENTS[0];

const MIN_CARD_RATIO = 0.5;
const MAX_CARD_RATIO = 2.2;
const INNER_CARD_WIDTH = WORKOUT_SHARE_CARD_WIDTH - 32;
const INNER_CARD_HEIGHT = WORKOUT_SHARE_CARD_HEIGHT - 32;

type Props = {
  visible: boolean;
  onClose: () => void;
  detalle: DetalleSesion;
  tituloSesion: string;
  kcalEstimadas: number | null;
  user: User | null | undefined;
  initialDark: boolean;
  fallbackMessage: string;
};

export function WorkoutShareModal({
  visible,
  onClose,
  detalle,
  tituloSesion,
  kcalEstimadas,
  user,
  initialDark,
  fallbackMessage,
}: Props) {
  const { c, s, r } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [theme, setTheme] = useState<WorkoutShareTheme>(initialDark ? 'dark' : 'light');
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

  const data = useMemo(
    () => crearWorkoutShareData(detalle, tituloSesion, kcalEstimadas, user, profileUsername),
    [detalle, tituloSesion, kcalEstimadas, user, profileUsername],
  );

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
        const base = WORKOUT_SHARE_CARD_HEIGHT;
        return { cardWidth: Math.round(base * ratio), cardHeight: base };
      }
      const base = WORKOUT_SHARE_CARD_WIDTH;
      return { cardWidth: base, cardHeight: Math.round(base / ratio) };
    }
    return { cardWidth: WORKOUT_SHARE_CARD_WIDTH, cardHeight: WORKOUT_SHARE_CARD_HEIGHT };
  }, [personalizando, photoAspect]);

  const cardRatio = cardWidth / cardHeight;
  const horizontalLimit = windowWidth - 72;
  const maxPreviewHeight = windowHeight - 280;
  const previewWidth = Math.min(horizontalLimit, maxPreviewHeight * cardRatio, 360);
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
    let uri: string | null = null;
    try {
      uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
    } catch (captureError) {
      console.warn('[WorkoutShareModal] capture failed', captureError);
    }

    try {
      if (uri) {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            dialogTitle: 'Compartir entreno',
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
      console.warn('[WorkoutShareModal] share failed', shareError);
      Alert.alert('No se pudo compartir', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setCompartiendo(false);
    }
  };

  const musculosVisibles = data.muscles.slice(0, 4);
  const musculosRestantes = data.muscles.length - musculosVisibles.length;

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
                <Text style={[styles.title, { color: c.textDisplay }]}>Entreno</Text>
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
                      <View style={styles.topRow}>
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
                          <Text
                            style={[styles.kcalValue, { color: valueColor }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                          >
                            {data.durationLabel}
                          </Text>
                          <Text style={[styles.kcalUnit, { color: cardMuted }]}>
                            {data.durationUnit ? data.durationUnit : 'duración'}
                          </Text>

                          <View style={[styles.macroSeparator, { backgroundColor: cardLine }]} />

                          <Text style={[styles.itemsHeaderLeft, { color: iconColor }]}>MÚSCULOS</Text>

                          {musculosVisibles.length === 0 ? (
                            <Text style={[styles.emptyItems, { color: cardMuted }]}>
                              Sin músculos registrados
                            </Text>
                          ) : (
                            <View style={styles.itemsList}>
                              {musculosVisibles.map((muscle) => (
                                <View key={muscle} style={styles.itemRow}>
                                  <View style={[styles.itemBullet, { backgroundColor: iconColor }]} />
                                  <Text
                                    style={[styles.itemName, { color: valueColor }]}
                                    numberOfLines={1}
                                  >
                                    {muscle}
                                  </Text>
                                </View>
                              ))}
                              {musculosRestantes > 0 ? (
                                <Text style={[styles.itemsMore, { color: cardMuted }]}>
                                  + {musculosRestantes} más
                                </Text>
                              ) : null}
                            </View>
                          )}
                        </View>

                        <View style={[styles.verticalDivider, { backgroundColor: cardLine }]} />

                        <View style={styles.rightCol}>
                          <Text style={[styles.workoutName, { color: valueColor }]} numberOfLines={2}>
                            {data.title}
                          </Text>
                          <Text style={[styles.dateText, { color: cardMuted }]} numberOfLines={1}>
                            {data.dateLabel}
                          </Text>

                          <View style={styles.statsBlock}>
                            <StatRow
                              icon={<Ionicons name="barbell-outline" size={18} color={iconColor} />}
                              value={String(data.exerciseCount)}
                              label="EJERCICIOS"
                              text={valueColor}
                              muted={cardMuted}
                            />
                            <StatRow
                              icon={
                                <MaterialCommunityIcons
                                  name="weight-kilogram"
                                  size={18}
                                  color={iconColor}
                                />
                              }
                              value={data.volumeLabel === '-' ? '—' : `${data.volumeLabel} kg`}
                              label="VOLUMEN"
                              text={valueColor}
                              muted={cardMuted}
                            />
                            <StatRow
                              icon={<Ionicons name="flame-outline" size={18} color={iconColor} />}
                              value={data.kcalLabel === '-' ? '—' : `${data.kcalLabel} kcal`}
                              label="CALORÍAS"
                              text={valueColor}
                              muted={cardMuted}
                            />
                          </View>
                        </View>
                      </View>

                      <View style={styles.footerBrand}>
                        <View style={[styles.footerLine, { backgroundColor: cardLine }]} />
                        <FooterLogo width={78} height={12} />
                        <View style={[styles.footerLine, { backgroundColor: cardLine }]} />
                      </View>

                      <Text style={[styles.usernameFooter, { color: cardMuted }]} numberOfLines={1}>
                        {data.usernameLabel}
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

function StatRow({
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
    marginTop: 16,
  },
  leftCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 14,
  },
  kcalValue: {
    fontFamily: FontFamily.sansBold,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.2,
  },
  kcalUnit: {
    marginTop: -2,
    fontFamily: FontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  macroSeparator: {
    height: StyleSheet.hairlineWidth,
    marginTop: 14,
    marginBottom: 12,
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
    marginRight: 18,
  },
  rightCol: {
    width: 175,
    minWidth: 0,
  },
  statsBlock: {
    marginTop: 14,
  },
  itemsHeaderLeft: {
    fontFamily: FontFamily.monoBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  workoutName: {
    fontFamily: FontFamily.sansBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  dateText: {
    marginTop: 4,
    fontFamily: FontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  itemsList: {
    marginTop: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  itemBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  itemName: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  itemsMore: {
    marginTop: 4,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  emptyItems: {
    marginTop: 10,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    fontStyle: 'italic',
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
