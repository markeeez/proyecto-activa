import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useThemeMode } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Objetivo, Plan } from '@/types/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileRow = {
  id: string;
  username: string | null;
  nombre: string | null;
  apellidos: string | null;
  plan: Plan | null;
  is_active: boolean | null;
  edad?: number | null;
  altura_cm?: number | null;
};

type GoalRow = {
  objetivo: Objetivo | string | null;
  calorias_objetivo: number | null;
  proteinas_objetivo: number | null;
  carbos_objetivo: number | null;
  grasas_objetivo: number | null;
};

type MetricRow = {
  peso_kg: number | null;
  altura_cm?: number | null;
  fecha: string | null;
};

type PlanLimitRow = {
  plan: Plan | string;
  acceso_ia: boolean | null;
  ai_mensajes_mes: number | null;
};

type ProfileData = {
  profile: ProfileRow | null;
  goals: GoalRow | null;
  latestMetric: MetricRow | null;
  planLimits: PlanLimitRow | null;
};

type ModalState = {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm?: () => Promise<void> | void;
};

type EditMetricState = {
  visible: boolean;
  field: 'altura_cm' | 'edad';
  label: string;
  unit: string;
  current: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarUrl(user: ReturnType<typeof useAuth>['user']): string | null {
  const meta = user?.user_metadata as { avatar_url?: string } | undefined;
  const url = meta?.avatar_url;
  return url && String(url).trim() ? String(url).trim() : null;
}

function initials(
  nombre: string | null | undefined,
  apellidos: string | null | undefined,
  username: string | null | undefined,
  email: string | null | undefined,
): string {
  const first = nombre?.trim();
  const last = apellidos?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first && first.length >= 2) return first.slice(0, 2).toUpperCase();
  const user = username?.trim();
  if (user && user.length >= 2) return user.slice(0, 2).toUpperCase();
  const local = (email ?? '').split('@')[0];
  return local.length >= 2 ? local.slice(0, 2).toUpperCase() : '?';
}

function fullName(profile: ProfileRow | null, user: ReturnType<typeof useAuth>['user']): string {
  const nombre = profile?.nombre?.trim();
  const apellidos = profile?.apellidos?.trim();
  if (nombre) return apellidos ? `${nombre} ${apellidos}` : nombre;

  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const metaName = meta?.full_name ?? meta?.name;
  if (metaName && String(metaName).trim()) return String(metaName).trim();

  return 'Usuario';
}

function username(profile: ProfileRow | null, user: ReturnType<typeof useAuth>['user']): string {
  const profileUsername = profile?.username?.trim();
  if (profileUsername) return `@${profileUsername}`;

  const meta = user?.user_metadata as { username?: string } | undefined;
  if (meta?.username?.trim()) return `@${meta.username.trim()}`;

  const emailName = user?.email?.split('@')[0];
  return emailName ? `@${emailName}` : '@usuario';
}

function objectiveText(value: GoalRow['objetivo']): string {
  switch (value) {
    case 'perder_peso':
      return 'Perder grasa';
    case 'mantener':
      return 'Mantener peso';
    case 'ganar_masa':
      return 'Ganar masa muscular';
    case 'mejorar_rendimiento':
      return 'Mejorar rendimiento';
    default:
      return value ? String(value) : 'Sin objetivo';
  }
}

function rounded(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value));
}

function decimal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '--';
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

async function uploadAvatar(userId: string, uri: string, mimeType: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result ?? '');
        const base64 = dataUrl.split(',')[1] ?? '';
        const binary = atob(base64);
        const buffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) buffer[i] = binary.charCodeAt(i);
        resolve(buffer);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const path = `${userId}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { upsert: true, contentType: mimeType });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// ─── Data hook ────────────────────────────────────────────────────────────────

async function fetchProfileData(userId: string): Promise<ProfileData> {
  const profileRes = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileRes.error) throw profileRes.error;
  const profile = (profileRes.data as ProfileRow | null) ?? null;
  const plan = profile?.plan ?? 'free';

  const [goalsRes, metricRes, limitsRes] = await Promise.all([
    supabase
      .from('user_goals')
      .select('objetivo, calorias_objetivo, proteinas_objetivo, carbos_objetivo, grasas_objetivo')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_body_metrics')
      .select('peso_kg, altura_cm, fecha')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('plan_limits')
      .select('plan, acceso_ia, ai_mensajes_mes')
      .eq('plan', plan)
      .maybeSingle(),
  ]);

  if (goalsRes.error) throw goalsRes.error;
  if (metricRes.error) throw metricRes.error;
  if (limitsRes.error) throw limitsRes.error;

  return {
    profile,
    goals: (goalsRes.data as GoalRow | null) ?? null,
    latestMetric: (metricRes.data as MetricRow | null) ?? null,
    planLimits: (limitsRes.data as PlanLimitRow | null) ?? null,
  };
}

function useProfileData(userId: string | undefined) {
  const [data, setData] = useState<ProfileData>({
    profile: null,
    goals: null,
    latestMetric: null,
    planLimits: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // true only on the very first load — subsequent refreshes are silent
  const hasLoaded = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!userId) {
      setData({ profile: null, goals: null, latestMetric: null, planLimits: null });
      setError('No hay una sesion activa.');
      setLoading(false);
      return;
    }

    // Show spinner only on first load; after that refresh in background
    const showSpinner = !silent || !hasLoaded.current;
    if (showSpinner) setLoading(true);
    setError(null);

    try {
      const next = await fetchProfileData(userId);
      setData(next);
      hasLoaded.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el perfil.';
      setError(message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [userId]);

  // Optimistic patch — updates local state immediately without a network round-trip.
  // The caller is responsible for persisting to the server in the background.
  const patch = useCallback((fields: Partial<ProfileRow>) => {
    setData((prev) => ({
      ...prev,
      profile: prev.profile ? { ...prev.profile, ...fields } : prev.profile,
    }));
  }, []);

  return { data, loading, error, reload: load, patch };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(
  c: Theme,
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: s.lg,
    },
    errorTitle: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      marginBottom: s.sm,
      textAlign: 'center',
    },
    errorText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: s.lg,
    },
    retryButton: {
      backgroundColor: c.primary,
      borderRadius: r.sm,
      paddingHorizontal: s.md,
      paddingVertical: 11,
    },
    retryText: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textOnPrimary,
    },
    scrollContent: {
      paddingHorizontal: s.md,
      gap: s.md,
    },
    // Header
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.xxs,
    },
    pageTitle: {
      ...ts.displayMd,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    pageSubtitle: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginTop: 2,
    },
    pageSubtitleAccent: {
      fontFamily: f.sansBold,
      color: c.primary,
    },
    settingsButton: {
      width: 44,
      height: 44,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    // User card
    userCard: {
      backgroundColor: c.surface,
      borderRadius: r.md,
      padding: s.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    userTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.md,
    },
    avatarWrap: { width: 88, height: 88 },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 2,
      borderColor: c.surface,
      backgroundColor: c.surfaceElevated,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      ...ts.heading,
      fontFamily: f.sansBold,
      color: c.primary,
    },
    cameraButton: {
      position: 'absolute',
      right: -2,
      bottom: 4,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      borderWidth: 2,
      borderColor: c.surface,
    },
    identityBlock: { flex: 1, minWidth: 0 },
    nameText: {
      ...ts.heading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    usernameText: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginTop: 3,
    },
    motivationChip: {
      marginTop: s.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      alignSelf: 'stretch',
      gap: s.xs,
    },
    motivationText: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
      flex: 1,
      flexShrink: 1,
    },
    statsRow: {
      flexDirection: 'row',
      gap: s.sm,
      marginTop: s.md,
    },
    statChip: {
      flex: 1,
      minHeight: 60,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
      paddingHorizontal: s.sm,
    },
    statValue: {
      ...ts.caption,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'center',
    },
    statLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      textAlign: 'center',
    },
    // Section card (plan activo)
    sectionCard: {
      backgroundColor: c.surface,
      borderRadius: r.md,
      padding: s.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    sectionHeader: {
      minHeight: 27,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.sm,
    },
    sectionTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    sectionTitle: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    sectionActionText: {
      ...ts.caption,
      fontFamily: f.sansBold,
      color: c.primary,
    },
    // Plan inner
    planInner: {
      overflow: 'hidden',
      borderRadius: r.sm,
      backgroundColor: c.primaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    planMainRow: {
      minHeight: 90,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.md,
    },
    goalBlock: { flex: 1, paddingRight: s.sm },
    smallLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      marginBottom: s.sm,
    },
    goalText: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    planDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      marginVertical: s.md,
      backgroundColor: c.border,
    },
    kcalBlock: {
      width: 120,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kcalText: {
      ...ts.displayMd,
      fontFamily: f.sansBold,
      color: c.primary,
    },
    kcalLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      marginTop: 2,
    },
    macroRow: {
      minHeight: 58,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      flexDirection: 'row',
    },
    macroItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.xs,
      paddingHorizontal: s.xs,
    },
    macroValue: {
      ...ts.caption,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    macroLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      marginTop: 1,
    },
    // List card
    listCard: {
      backgroundColor: c.surface,
      borderRadius: r.md,
      paddingHorizontal: s.md,
      paddingTop: s.md,
      paddingBottom: s.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    listRow: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: s.sm,
    },
    listRowLast: { borderBottomWidth: 0 },
    listIcon: {
      width: 32,
      height: 32,
      borderRadius: r.technical,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceElevated,
    },
    listTextWrap: { flex: 1, minWidth: 0 },
    listTitle: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.text,
    },
    listSubtitle: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginTop: 2,
    },
    planBadge: {
      ...ts.label,
      fontFamily: f.monoBold,
      color: c.primary,
    },
    signOutButton: {
      marginTop: s.sm,
      height: 46,
      borderRadius: r.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
      backgroundColor: c.dangerBg,
    },
    signOutText: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.danger,
    },
    // Theme toggle
    themeToggleWrap: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
      marginTop: s.xs,
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
    },
    // Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.68)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: s.lg,
    },
    modalCard: {
      width: '100%',
      borderRadius: 18,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      paddingTop: s.lg,
      paddingBottom: s.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      overflow: 'hidden',
    },
    modalAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: c.primary,
    },
    modalTitle: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      marginBottom: s.sm,
      letterSpacing: 0,
    },
    modalText: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginBottom: s.md,
      lineHeight: 25,
    },
    modalActions: { flexDirection: 'row', gap: s.sm },
    modalGhost: {
      flex: 1,
      height: 44,
      borderRadius: r.technical,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    modalGhostText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
    modalPrimary: {
      flex: 1,
      height: 44,
      borderRadius: r.technical,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    modalPrimaryText: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
    },
    // Edit metric modal
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: r.sm,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      marginBottom: s.md,
      gap: s.sm,
    },
    metricInput: {
      flex: 1,
      ...ts.heading,
      fontSize: 28,
      lineHeight: 34,
    },
    metricUnit: {
      ...ts.bodySm,
    },
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type Styles = ReturnType<typeof makeStyles>;
type ThemeRef = { c: Theme; f: ReturnType<typeof useTheme>['f'] };

function SectionHeader({
  th,
  styles,
  icon,
  title,
  action,
  onPress,
}: {
  th: ThemeRef;
  styles: Styles;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleWrap}>
        <Ionicons name={icon} size={15} color={th.c.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <Pressable style={styles.sectionAction} onPress={onPress} accessibilityRole="button">
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={12} color={th.c.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function StatChip({
  styles,
  th,
  icon,
  value,
  label,
  editable,
  onPress,
}: {
  styles: Styles;
  th: ThemeRef;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  editable?: boolean;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <Ionicons name={icon} size={16} color={th.c.primary} />
      <View>
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </>
  );

  if (editable && onPress) {
    return (
      <Pressable style={styles.statChip} onPress={onPress} accessibilityRole="button">
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.statChip}>{inner}</View>;
}

function MacroItem({
  styles,
  th,
  type,
  value,
  label,
}: {
  styles: Styles;
  th: ThemeRef;
  type: 'protein' | 'carbs' | 'fat';
  value: string;
  label: string;
}) {
  const color =
    type === 'protein' ? th.c.macroProtein :
    type === 'carbs'   ? th.c.macroCarbs   :
                         th.c.macroFat;

  return (
    <View style={styles.macroItem}>
      {type === 'protein' ? (
        <MaterialCommunityIcons name="food-drumstick-outline" size={17} color={color} />
      ) : type === 'carbs' ? (
        <MaterialCommunityIcons name="barley" size={17} color={color} />
      ) : (
        <Ionicons name="water-outline" size={17} color={color} />
      )}
      <View>
        <Text style={styles.macroValue}>{value}</Text>
        <Text style={styles.macroLabel}>{label}</Text>
      </View>
    </View>
  );
}

function ListRow({
  styles,
  th,
  icon,
  title,
  subtitle,
  badge,
  last,
  onPress,
}: {
  styles: Styles;
  th: ThemeRef;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  badge?: string;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.listRow, last && styles.listRowLast]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.listIcon}>
        <Ionicons name={icon} size={16} color={th.c.textSecondary} />
      </View>
      <View style={styles.listTextWrap}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? <Text style={styles.planBadge}>{badge}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={th.c.textMuted} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PerfilIndex() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDark, setMode } = useThemeMode();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);
  const th: ThemeRef = useMemo(() => ({ c, f }), [c, f]);

  const { data, loading, error, reload, patch } = useProfileData(user?.id);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getAvatarUrl(user ?? null));
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [modal, setModal] = useState<ModalState>({ visible: false, title: '', message: '' });
  const [editMetric, setEditMetric] = useState<EditMetricState>({
    visible: false,
    field: 'altura_cm',
    label: 'Altura',
    unit: 'cm',
    current: null,
  });
  const [editValue, setEditValue] = useState('');
  const [savingMetric, setSavingMetric] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setAvatarUrl(getAvatarUrl(user ?? null));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      // Silent refresh on focus — keeps stale data visible while fetching
      void reload(true);
    }, [reload]),
  );

  const displayName = useMemo(() => fullName(data.profile, user ?? null), [data.profile, user]);
  const displayUsername = useMemo(() => username(data.profile, user ?? null), [data.profile, user]);
  const profileInitials = useMemo(
    () => initials(data.profile?.nombre, data.profile?.apellidos, data.profile?.username, user?.email ?? null),
    [data.profile, user?.email],
  );

  const altura = data.latestMetric?.altura_cm ?? data.profile?.altura_cm ?? null;
  const edad = data.profile?.edad ?? null;
  const plan = data.profile?.plan ?? data.planLimits?.plan ?? 'free';
  const planBadge = String(plan).toUpperCase();

  const closeModal = () => setModal((prev) => ({ ...prev, visible: false }));
  const showInfo = (title: string, message: string) => setModal({ visible: true, title, message });

  const changeAvatar = async () => {
    if (!user?.id) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const publicUrl = await uploadAvatar(user.id, asset.uri, asset.mimeType ?? 'image/jpeg');
      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (authError) throw authError;
      setAvatarUrl(publicUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar la foto.';
      showInfo('Error', message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const openEditMetric = (field: 'altura_cm' | 'edad', current: number | null) => {
    const isAltura = field === 'altura_cm';
    setEditValue(current != null ? String(Math.round(current)) : '');
    setEditMetric({
      visible: true,
      field,
      label: isAltura ? 'Altura' : 'Edad',
      unit: isAltura ? 'cm' : 'años',
      current,
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const saveMetricField = async () => {
    if (!user?.id) return;
    const raw = editValue.trim();
    const parsed = parseInt(raw, 10);
    if (!raw || isNaN(parsed) || parsed <= 0) return;

    const field = editMetric.field;
    const previous = field === 'altura_cm' ? data.profile?.altura_cm : data.profile?.edad;

    // Optimistic update — UI reflects the change instantly
    patch({ [field]: parsed });
    setEditMetric((prev) => ({ ...prev, visible: false }));
    setSavingMetric(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [field]: parsed })
        .eq('id', user.id);
      if (updateError) throw updateError;
    } catch (err) {
      // Rollback optimistic update and surface the error
      patch({ [field]: previous ?? null });
      const message = err instanceof Error ? err.message : 'No se pudo guardar.';
      showInfo('Error', message);
    } finally {
      setSavingMetric(false);
    }
  };

  const signOut = () => {
    setModal({
      visible: true,
      title: 'Cerrar sesión',
      message: '¿Quieres cerrar tu sesión actual?',
      confirmText: 'Cerrar sesión',
      danger: true,
      onConfirm: async () => {
        await supabase.auth.signOut();
        router.replace('/(auth)/iniciar-sesion');
      },
    });
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>No se pudo cargar el perfil</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={reload}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 112 },
          ]}
        >
          {/* Header */}
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.pageTitle}>Perfil</Text>
              <Text style={styles.pageSubtitle}>
                Gestiona tu cuenta y{' '}
                <Text style={styles.pageSubtitleAccent}>tu progreso.</Text>
              </Text>
            </View>
            <Pressable
              style={styles.settingsButton}
              onPress={() => router.push('/(tabs)/(perfil)/ajustes')}
              accessibilityRole="button"
              accessibilityLabel="Ajustes"
            >
              <Ionicons name="settings-outline" size={18} color={c.textSecondary} />
            </Pressable>
          </View>

          {/* User card */}
          <View style={styles.userCard}>
            <View style={styles.userTop}>
              <View style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitials}>{profileInitials}</Text>
                  </View>
                )}
                <Pressable
                  style={styles.cameraButton}
                  onPress={changeAvatar}
                  disabled={uploadingAvatar}
                  accessibilityRole="button"
                  accessibilityLabel="Editar foto"
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator color={c.textOnPrimary} size="small" />
                  ) : (
                    <Ionicons name="camera" size={13} color={c.textOnPrimary} />
                  )}
                </Pressable>
              </View>

              <View style={styles.identityBlock}>
                <Text style={styles.nameText} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.usernameText} numberOfLines={1}>{displayUsername}</Text>
                <View style={styles.motivationChip}>
                  <Ionicons name="flash" size={12} color={c.primary} />
                  <Text style={styles.motivationText} numberOfLines={2}>
                    Disciplina hoy, resultados mañana.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatChip styles={styles} th={th} icon="scale-outline" value={`${decimal(data.latestMetric?.peso_kg)} kg`} label="Peso" />
              <StatChip styles={styles} th={th} icon="body-outline" value={`${decimal(altura)} cm`} label="Altura" editable onPress={() => openEditMetric('altura_cm', altura)} />
              <StatChip styles={styles} th={th} icon="calendar-outline" value={edad != null ? `${rounded(edad)} años` : '--'} label="Edad" editable onPress={() => openEditMetric('edad', edad)} />
            </View>
          </View>

          {/* Plan activo */}
          <View style={styles.sectionCard}>
            <SectionHeader
              th={th}
              styles={styles}
              icon="compass-outline"
              title="Plan activo"
              action="Personalizar"
              onPress={() => router.push('/(tabs)/(progreso)/personalizar-plan')}
            />
            <View style={styles.planInner}>
              <View style={styles.planMainRow}>
                <View style={styles.goalBlock}>
                  <Text style={styles.smallLabel}>Objetivo</Text>
                  <Text style={styles.goalText} numberOfLines={2}>
                    {objectiveText(data.goals?.objetivo ?? null)}
                  </Text>
                </View>
                <View style={styles.planDivider} />
                <View style={styles.kcalBlock}>
                  <Text style={styles.kcalText}>{rounded(data.goals?.calorias_objetivo) ?? '--'}</Text>
                  <Text style={styles.kcalLabel}>kcal/día</Text>
                </View>
              </View>
              <View style={styles.macroRow}>
                <MacroItem styles={styles} th={th} type="protein" value={`${rounded(data.goals?.proteinas_objetivo) ?? '--'} g`} label="Proteína" />
                <MacroItem styles={styles} th={th} type="carbs"   value={`${rounded(data.goals?.carbos_objetivo) ?? '--'} g`} label="Carbos" />
                <MacroItem styles={styles} th={th} type="fat"     value={`${rounded(data.goals?.grasas_objetivo) ?? '--'} g`} label="Grasa" />
              </View>
            </View>
          </View>

          {/* Mi actividad */}
          <View style={styles.listCard}>
            <SectionHeader th={th} styles={styles} icon="pulse-outline" title="Mi actividad" />
            <ListRow
              styles={styles} th={th}
              icon="barbell-outline"
              title="Ejercicios"
              subtitle="Consulta y gestiona tus ejercicios."
              onPress={() => router.push('/(tabs)/(perfil)/perfil-ejercicios')}
            />
            <ListRow
              styles={styles} th={th}
              icon="bar-chart-outline"
              title="Entrenos"
              subtitle="Historial y estadísticas de entrenos."
              last
              onPress={() => router.push('/(tabs)/(perfil)/perfil-entrenos')}
            />
          </View>

          {/* Cuenta */}
          <View style={styles.listCard}>
            <SectionHeader th={th} styles={styles} icon="person-outline" title="Cuenta" />
            <ListRow styles={styles} th={th} icon="mail-outline"        title="Cambiar email"      onPress={() => router.push('/(tabs)/(perfil)/cambiar-email')} />
            <ListRow styles={styles} th={th} icon="lock-closed-outline" title="Cambiar contraseña" onPress={() => router.push('/(tabs)/(perfil)/cambiar-contrasena')} />
            <ListRow styles={styles} th={th} icon="shield-checkmark-outline" title="Plan actual" badge={planBadge} last onPress={() => router.push('/(tabs)/(perfil)/plan')} />

            <Pressable style={styles.signOutButton} onPress={signOut} accessibilityRole="button">
              <Ionicons name="log-out-outline" size={16} color={c.danger} />
              <Text style={styles.signOutText}>Cerrar sesión</Text>
            </Pressable>
          </View>

          {/* Theme toggle */}
          <View style={styles.themeToggleWrap}>
            <Ionicons name="sunny-outline" size={17} color={c.textMuted} />
            <Switch
              value={isDark}
              onValueChange={(value) => setMode(value ? 'dark' : 'light')}
              trackColor={{ false: c.surfaceElevated, true: c.primaryBg }}
              thumbColor={c.primary}
            />
            <Ionicons name="moon-outline" size={17} color={c.textMuted} />
          </View>
        </ScrollView>
      )}

      {/* Modal info/confirm */}
      <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalAccent} />
            <Text style={styles.modalTitle}>{modal.title}</Text>
            <Text style={styles.modalText}>{modal.message}</Text>
            <View style={styles.modalActions}>
              {modal.confirmText ? (
                <Pressable style={styles.modalGhost} onPress={closeModal}>
                  <Text style={styles.modalGhostText}>Cancelar</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.modalPrimary, modal.danger && { backgroundColor: c.danger }]}
                onPress={async () => {
                  const action = modal.onConfirm;
                  closeModal();
                  await action?.();
                }}
              >
                <Text style={styles.modalPrimaryText}>{modal.confirmText ?? 'Aceptar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit metric modal */}
      <Modal
        visible={editMetric.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditMetric((prev) => ({ ...prev, visible: false }))}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalAccent} />
            <Text style={styles.modalTitle}>{editMetric.label}</Text>
            <Text style={styles.modalText}>
              Introduce tu {editMetric.label.toLowerCase()} en {editMetric.unit}.
            </Text>
            <View style={[styles.inputRow, { borderColor: c.borderVisible, backgroundColor: c.surfaceElevated }]}>
              <TextInput
                ref={inputRef}
                style={[styles.metricInput, { color: c.textDisplay, fontFamily: f.sansBold }]}
                value={editValue}
                onChangeText={(t) => setEditValue(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="--"
                placeholderTextColor={c.textMuted}
                returnKeyType="done"
                onSubmitEditing={saveMetricField}
              />
              <Text style={[styles.metricUnit, { color: c.textSecondary, fontFamily: f.mono }]}>
                {editMetric.unit}
              </Text>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalGhost}
                onPress={() => setEditMetric((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimary, (!editValue.trim() || savingMetric) && { opacity: 0.5 }]}
                onPress={saveMetricField}
                disabled={!editValue.trim() || savingMetric}
              >
                {savingMetric ? (
                  <ActivityIndicator color={c.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
