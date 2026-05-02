import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Objetivo, Plan } from '@/types/database.types';

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

const COLORS = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  cardSoft: '#F2FAFF',
  cardBlue: '#EAF8FF',
  accent: '#16B7D7',
  accentBlue: '#5B9BF6',
  text: '#172234',
  muted: '#7A8492',
  faint: '#AAB2BD',
  border: '#E9EEF3',
  danger: '#F05252',
  dangerBg: '#FFF1F1',
  green: '#5CB85C',
  orange: '#FF9E3D',
  shadow: '#D8E3EE',
};

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

function useProfileData(userId: string | undefined) {
  const [data, setData] = useState<ProfileData>({
    profile: null,
    goals: null,
    latestMetric: null,
    planLimits: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setData({ profile: null, goals: null, latestMetric: null, planLimits: null });
      setError('No hay una sesion activa.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
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

      setData({
        profile,
        goals: (goalsRes.data as GoalRow | null) ?? null,
        latestMetric: (metricRes.data as MetricRow | null) ?? null,
        planLimits: (limitsRes.data as PlanLimitRow | null) ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el perfil.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { data, loading, error, reload: load };
}

export default function PerfilIndex() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data, loading, error, reload } = useProfileData(user?.id);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getAvatarUrl(user ?? null));
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [modal, setModal] = useState<ModalState>({
    visible: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    setAvatarUrl(getAvatarUrl(user ?? null));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void reload();
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

  const changeEmail = () => {
    router.push('/(tabs)/(perfil)/ajustes');
  };

  const changePassword = () => {
    if (!user?.email) return;

    setModal({
      visible: true,
      title: 'Cambiar contraseña',
      message: 'Te enviaremos un email para restablecer tu contraseña.',
      confirmText: 'Enviar',
      onConfirm: async () => {
        const email = user.email?.trim().toLowerCase();
        if (!email) return;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
        if (resetError) {
          showInfo('Error', resetError.message ?? 'No se pudo enviar el email.');
        } else {
          showInfo('Listo', 'Email de restablecimiento enviado.');
        }
      },
    });
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
          <ActivityIndicator color={COLORS.accent} size="large" />
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
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Perfil</Text>
              <Text style={styles.subtitle}>
                Gestiona tu cuenta y <Text style={styles.subtitleAccent}>tu progreso.</Text>
              </Text>
            </View>
            <Pressable
              style={styles.settingsButton}
              onPress={() => router.push('/(tabs)/(perfil)/ajustes')}
              accessibilityRole="button"
              accessibilityLabel="Ajustes"
            >
              <Ionicons name="settings" size={19} color={COLORS.text} />
            </Pressable>
          </View>

          <View style={styles.userCard}>
            <View style={styles.userTop}>
              <View style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
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
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>

              <View style={styles.identityBlock}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.usernameText} numberOfLines={1}>
                  {displayUsername}
                </Text>
                <View style={styles.motivationChip}>
                  <Ionicons name="flash" size={13} color={COLORS.accent} />
                  <Text style={styles.motivationText} numberOfLines={1}>
                    Disciplina hoy, resultados mañana.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatChip icon="scale-outline" value={`${decimal(data.latestMetric?.peso_kg)} kg`} label="Peso" />
              <StatChip icon="pencil-outline" value={`${decimal(altura)} cm`} label="Altura" />
              <StatChip icon="calendar-outline" value={edad != null ? `${rounded(edad)} años` : '-- años'} label="Edad" />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <SectionHeader
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
                <MacroItem
                  type="protein"
                  color={COLORS.accent}
                  value={`${rounded(data.goals?.proteinas_objetivo) ?? '--'} g`}
                  label="Proteína"
                />
                <MacroItem
                  type="carbs"
                  color={COLORS.green}
                  value={`${rounded(data.goals?.carbos_objetivo) ?? '--'} g`}
                  label="Carbohidratos"
                />
                <MacroItem
                  type="fat"
                  color={COLORS.orange}
                  value={`${rounded(data.goals?.grasas_objetivo) ?? '--'} g`}
                  label="Grasa"
                />
              </View>
            </View>
          </View>

          <View style={styles.listCard}>
            <SectionHeader icon="pulse-outline" title="Mi actividad" />
            <ListRow
              icon="barbell-outline"
              title="Ejercicios"
              subtitle="Consulta y gestiona tus ejercicios."
              onPress={() => router.push('/(tabs)/(perfil)/perfil-ejercicios')}
            />
            <ListRow
              icon="bar-chart-outline"
              title="Entrenos"
              subtitle="Historial y estadísticas de entrenos."
              last
              onPress={() => router.push('/(tabs)/(perfil)/perfil-entrenos')}
            />
          </View>

          <View style={styles.listCard}>
            <SectionHeader icon="person-outline" title="Cuenta" />
            <ListRow icon="mail-outline" title="Cambiar email" onPress={changeEmail} />
            <ListRow icon="lock-closed-outline" title="Cambiar contraseña" onPress={changePassword} />
            <ListRow
              icon="shield-checkmark-outline"
              title="Plan actual"
              badge={planBadge}
              last
              onPress={() => router.push('/(tabs)/(perfil)/plan')}
            />

            <Pressable style={styles.signOutButton} onPress={signOut} accessibilityRole="button">
              <Ionicons name="log-out-outline" size={17} color={COLORS.danger} />
              <Text style={styles.signOutText}>Cerrar sesión</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modal.title}</Text>
            <Text style={styles.modalText}>{modal.message}</Text>
            <View style={styles.modalActions}>
              {modal.confirmText ? (
                <Pressable style={styles.modalGhost} onPress={closeModal}>
                  <Text style={styles.modalGhostText}>Cancelar</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.modalPrimary, modal.danger && styles.modalDanger]}
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
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  action,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleWrap}>
        <Ionicons name={icon} size={16} color={COLORS.accent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <Pressable style={styles.sectionAction} onPress={onPress} accessibilityRole="button">
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={13} color={COLORS.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function StatChip({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={17} color={COLORS.accent} />
      <View>
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function MacroItem({
  type,
  color,
  value,
  label,
}: {
  type: 'protein' | 'carbs' | 'fat';
  color: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.macroItem}>
      {type === 'protein' ? (
        <MaterialCommunityIcons name="food-drumstick-outline" size={18} color={color} />
      ) : type === 'carbs' ? (
        <MaterialCommunityIcons name="barley" size={18} color={color} />
      ) : (
        <Ionicons name="water-outline" size={18} color={color} />
      )}
      <View>
        <Text style={styles.macroValue}>{value}</Text>
        <Text style={styles.macroLabel}>{label}</Text>
      </View>
    </View>
  );
}

function ListRow({
  icon,
  title,
  subtitle,
  badge,
  last,
  onPress,
}: {
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
        <Ionicons name={icon} size={17} color={COLORS.text} />
      </View>
      <View style={styles.listTextWrap}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? <Text style={styles.planBadge}>{badge}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={COLORS.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 18,
  },
  retryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.muted,
  },
  subtitleAccent: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  settingsButton: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  userCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  userTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  avatarWrap: {
    width: 96,
    height: 96,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: COLORS.cardSoft,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.accent,
  },
  cameraButton: {
    position: 'absolute',
    right: -1,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  identityBlock: {
    flex: 1,
    minWidth: 0,
  },
  nameText: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    color: COLORS.text,
  },
  usernameText: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.muted,
  },
  motivationChip: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    maxWidth: '100%',
  },
  motivationText: {
    flexShrink: 1,
    fontSize: 12,
    color: COLORS.muted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
  },
  statChip: {
    flex: 1,
    minHeight: 62,
    borderRadius: 8,
    backgroundColor: COLORS.cardSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    minHeight: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accent,
  },
  planInner: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: COLORS.cardBlue,
  },
  planMainRow: {
    minHeight: 98,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  goalBlock: {
    flex: 1,
    paddingRight: 12,
  },
  smallLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 7,
  },
  goalText: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    color: COLORS.text,
  },
  planDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 18,
    backgroundColor: '#D8EEF9',
  },
  kcalBlock: {
    width: 126,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcalText: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
    color: COLORS.accent,
  },
  kcalLabel: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.muted,
  },
  macroRow: {
    minHeight: 61,
    borderTopWidth: 1,
    borderTopColor: '#D8EEF9',
    flexDirection: 'row',
  },
  macroItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 6,
  },
  macroValue: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
  },
  macroLabel: {
    marginTop: 1,
    fontSize: 10,
    color: COLORS.muted,
  },
  listRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  listIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardSoft,
  },
  listTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
  },
  listSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.muted,
  },
  planBadge: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.accent,
  },
  signOutButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerBg,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.danger,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.46)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 18,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalGhost: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalGhostText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  modalDanger: {
    backgroundColor: COLORS.danger,
  },
  modalPrimaryText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
