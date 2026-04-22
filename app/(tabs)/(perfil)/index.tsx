/**
 * PANTALLA: Perfil principal — identidad, datos, plan, cuenta.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import type { GeneroOnboarding } from '@/app/(onboarding)/datos';
import { useThemeMode } from '@/context/ThemeContext';
import type { Objetivo, Plan } from '@/types/database.types';

type ProfileRow = {
  id: string;
  username: string | null;
  nombre: string | null;
  apellidos: string | null;
  genero: string | null;
  edad: number | null;
  altura_cm: number | null;
  factor_actividad: number | null;
  plan: Plan;
};

type GoalsRow = {
  objetivo: Objetivo;
  calorias_objetivo: number;
  proteinas_objetivo: number;
  carbos_objetivo: number;
  grasas_objetivo: number;
};

function getMetaAvatar(user: ReturnType<typeof useAuth>['user']): string | null {
  const m = user?.user_metadata as { avatar_url?: string } | undefined;
  const u = m?.avatar_url;
  return u && String(u).trim() ? String(u).trim() : null;
}

function inicialesNombre(
  nombre: string | null | undefined,
  apellidos: string | null | undefined,
  username: string | null | undefined,
  email: string | undefined,
): string {
  const n = (nombre ?? '').trim();
  const a = (apellidos ?? '').trim();
  if (n && a) return (n[0] + a[0]).toUpperCase();
  if (n.length >= 2) return (n[0] + n[1]).toUpperCase();
  if (n.length === 1) return (n[0] + (a[0] ?? n[0])).toUpperCase();
  const usr = (username ?? '').trim();
  if (usr.length >= 2) return usr.slice(0, 2).toUpperCase();
  if (usr.length === 1) return usr[0].toUpperCase();
  const e = email ?? '';
  const at = e.indexOf('@');
  const local = at > 0 ? e.slice(0, at) : e;
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return '?';
}

function textoObjetivo(o: Objetivo): string {
  switch (o) {
    case 'perder_peso':
      return 'Perder grasa';
    case 'mantener':
      return 'Mantener peso';
    case 'ganar_masa':
      return 'Ganar masa muscular';
    case 'mejorar_rendimiento':
      return 'Mejorar rendimiento';
    default:
      return String(o);
  }
}

function generoLabel(g: string | null | undefined): string {
  if (g === 'hombre') return 'Hombre';
  if (g === 'mujer') return 'Mujer';
  return '—';
}

function planBadgeText(plan: Plan | null | undefined): string {
  switch (plan) {
    case 'plus':
      return 'PLUS';
    case 'premium':
      return 'PREMIUM';
    case 'free':
    default:
      return 'FREE';
  }
}

function planBadgeColor(c: Theme, plan: Plan | null | undefined): string {
  switch (plan) {
    case 'plus':
      return c.planPlus;
    case 'premium':
      return c.planPremium;
    default:
      return c.planFree;
  }
}

function fmtPesoChip(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  const t = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  return `${t} kg`;
}

function fmtCmChip(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Math.round(Number(v))} cm`;
}

function fmtEdadChip(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Math.round(Number(v))} años`;
}

function makeStyles(
  c: Theme,
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      paddingBottom: s.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitulo: {
      ...ts.heading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    scrollContent: {
      paddingHorizontal: s.md,
      paddingBottom: s['3xl'],
      gap: s.lg,
    },
    avatarWrap: { alignItems: 'center' },
    avatarImg: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    avatarIniciales: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    avatarInicialesTxt: {
      ...ts.heading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    linkCaption: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.primary,
      marginTop: s.sm,
    },
    nombreTxt: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
      marginTop: s.md,
    },
    usernameTxt: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: s.xs,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: s.sm,
      marginTop: s.md,
    },
    chip: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.pill,
      paddingVertical: 4,
      paddingHorizontal: 12,
    },
    chipTxt: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    card: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      padding: s.md,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.md,
    },
    cardTitulo: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.88,
    },
    linkPrimary: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.primary,
    },
    rowLectura: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: s.sm,
      gap: s.md,
    },
    rowLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      flexShrink: 0,
    },
    rowValor: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textDisplay,
      flex: 1,
      textAlign: 'right',
    },
    segmentRow: { flexDirection: 'row', gap: s.xs, marginBottom: s.md },
    segmentBtn: {
      flex: 1,
      paddingVertical: s.md,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      backgroundColor: c.surface,
    },
    segmentBtnOn: {
      borderColor: c.primary,
      backgroundColor: c.primaryBg,
    },
    segmentTxt: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    segmentTxtOn: { color: c.primary },
    input: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      marginBottom: s.md,
      backgroundColor: c.surface,
    },
    labelEdit: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: s.sm,
      letterSpacing: 0.6,
    },
    btnPrimary: {
      paddingVertical: s.md,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.primary,
      marginTop: s.sm,
    },
    btnPrimaryTxt: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
      letterSpacing: 0.3,
    },
    btnGhost: {
      paddingVertical: s.sm,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: 'transparent',
      marginTop: s.xs,
    },
    btnGhostTxt: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: 0.3,
    },
    objetivoCentro: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
      marginBottom: s.md,
    },
    kcalBlock: { alignItems: 'center', marginBottom: s.md },
    kcalNumero: {
      ...ts.displayLg,
      fontFamily: f.mono,
      color: c.primary,
    },
    kcalSuffix: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginTop: s.xs,
    },
    macrosRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: s.sm,
    },
    sinPlanTxt: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: s.md,
    },
    cuentaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    cuentaRowLast: {
      borderBottomWidth: 0,
    },
    cuentaRowLabel: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
    cuentaRowDanger: {
      color: c.danger,
    },
    planBadge: {
      ...ts.caption,
      fontFamily: f.monoBold,
      letterSpacing: 0.5,
    },
    devOnboarding: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginTop: s.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
    },
    devOnboardingTxt: { ...ts.caption, fontFamily: f.mono, color: c.textMuted },
    themeToggleSection: {
      alignItems: 'center',
      marginVertical: s.md,
    },
    themeToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
    },
    themeIcon: { opacity: 0.9 },
  });
}

export default function PerfilIndex() {
  const insets = useSafeAreaInsets();
  const { isDark, setMode } = useThemeMode();
  const { c, f, ts, s, r } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [cargando, setCargando] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [goals, setGoals] = useState<GoalsRow | null>(null);
  const [pesoUltimo, setPesoUltimo] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getMetaAvatar(user ?? null));

  const [editandoDatos, setEditandoDatos] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);

  const [editGenero, setEditGenero] = useState<GeneroOnboarding>('hombre');
  const [editEdad, setEditEdad] = useState('');
  const [editAltura, setEditAltura] = useState('');

  useEffect(() => {
    setAvatarUrl(getMetaAvatar(user ?? null));
  }, [user?.user_metadata, user]);

  const cargar = useCallback(async () => {
    if (!user?.id) {
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const [profRes, goalsRes, metRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('user_goals').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('user_body_metrics')
          .select('peso_kg')
          .eq('user_id', user.id)
          .not('peso_kg', 'is', null)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (profRes.data) setProfile(profRes.data as ProfileRow);
      else setProfile(null);

      if (goalsRes.data) {
        const g = goalsRes.data as Record<string, unknown>;
        setGoals({
          objetivo: g.objetivo as Objetivo,
          calorias_objetivo: Number(g.calorias_objetivo) || 0,
          proteinas_objetivo: Number(g.proteinas_objetivo) || 0,
          carbos_objetivo: Number(g.carbos_objetivo) || 0,
          grasas_objetivo: Number(g.grasas_objetivo) || 0,
        });
      } else setGoals(null);

      const pk = metRes.data?.peso_kg;
      setPesoUltimo(pk != null && Number.isFinite(Number(pk)) ? Number(pk) : null);
    } finally {
      setCargando(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const abrirEdicion = () => {
    if (!profile) return;
    const gen = profile.genero === 'mujer' ? 'mujer' : 'hombre';
    setEditGenero(gen);
    setEditEdad(profile.edad != null ? String(profile.edad) : '');
    setEditAltura(profile.altura_cm != null ? String(profile.altura_cm) : '');
    setEditandoDatos(true);
  };

  const cancelarEdicion = () => {
    setEditandoDatos(false);
  };

  const guardarDatos = async () => {
    if (!user?.id || !profile) return;
    const edadN = parseInt(editEdad.trim(), 10);
    const altN = parseFloat(editAltura.trim().replace(',', '.'));
    if (!editEdad.trim() || !Number.isFinite(edadN) || edadN <= 0) {
      Alert.alert('Error', 'Indica una edad válida.');
      return;
    }
    if (!editAltura.trim() || !Number.isFinite(altN) || altN <= 0) {
      Alert.alert('Error', 'Indica una altura válida.');
      return;
    }
    setGuardandoPerfil(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          genero: editGenero,
          edad: edadN,
          altura_cm: altN,
        })
        .eq('id', user.id);
      if (error) {
        Alert.alert('Error', error.message ?? 'No se pudieron guardar los datos.');
        return;
      }
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              genero: editGenero,
              edad: edadN,
              altura_cm: altN,
            }
          : prev,
      );
      setEditandoDatos(false);
      await cargar();
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const cambiarFoto = async () => {
    if (!user?.id) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    const contentType = a.mimeType || 'image/jpeg';
    setSubiendoAvatar(true);
    try {
      const resFetch = await fetch(a.uri);
      const buf = await resFetch.arrayBuffer();
      const { error: upErr } = await supabase.storage.from('avatars').upload(`${user.id}/avatar.jpg`, buf, {
        upsert: true,
        contentType,
      });
      if (upErr) {
        Alert.alert('Error', upErr.message ?? 'No se pudo subir la foto.');
        return;
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar.jpg`);
      const publicUrl = pub.publicUrl;
      const { error: authErr } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (authErr) {
        Alert.alert('Error', authErr.message ?? 'No se pudo guardar la foto de perfil.');
        return;
      }
      setAvatarUrl(publicUrl);
    } finally {
      setSubiendoAvatar(false);
    }
  };

  const nombreMostrar = useMemo(() => {
    if (profile?.nombre?.trim()) {
      const ap = profile.apellidos?.trim();
      return ap ? `${profile.nombre.trim()} ${ap}` : profile.nombre.trim();
    }
    const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
    const fn = meta?.full_name ?? meta?.name;
    if (fn && String(fn).trim()) return String(fn).trim();
    return '—';
  }, [profile, user?.user_metadata]);

  const usernameMostrar = useMemo(() => {
    if (profile?.username?.trim()) return profile.username.trim();
    const meta = user?.user_metadata as { username?: string } | undefined;
    if (meta?.username?.trim()) return meta.username.trim();
    return '—';
  }, [profile, user?.user_metadata]);

  const onCambiarEmail = () => {
    if (!user?.email) return;
    Alert.alert(
      'Cambiar email',
      'Se enviará un email de cambio a la dirección actual.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            const { error } = await supabase.auth.updateUser({ email: user.email });
            if (error) {
              Alert.alert('Error', error.message ?? 'No se pudo enviar el email.');
              return;
            }
            Alert.alert('Listo', 'Email de verificación enviado.');
          },
        },
      ],
    );
  };

  const onCambiarContrasena = () => {
    if (!user?.email) return;
    const em = user.email.trim().toLowerCase();
    Alert.alert(
      'Cambiar contraseña',
      'Se enviará un email de restablecimiento a tu cuenta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(em);
            if (error) {
              Alert.alert('Error', error.message ?? 'No se pudo enviar el email.');
              return;
            }
            Alert.alert('Listo', 'Email enviado.');
          },
        },
      ],
    );
  };

  const onCerrarSesion = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/iniciar-sesion');
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + s.sm }]}>
        <Text style={styles.headerTitulo}>Perfil</Text>
      </View>

      {cargando ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* BLOQUE 1 — Identidad */}
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <View style={styles.avatarIniciales}>
                  <Text style={styles.avatarInicialesTxt}>
                    {inicialesNombre(profile?.nombre, profile?.apellidos, profile?.username, user?.email ?? undefined)}
                  </Text>
                </View>
              )}
              <Pressable onPress={cambiarFoto} disabled={subiendoAvatar} accessibilityRole="button">
                <Text style={styles.linkCaption}>{subiendoAvatar ? 'Subiendo…' : 'Cambiar foto'}</Text>
              </Pressable>
              <Text style={styles.nombreTxt}>{nombreMostrar}</Text>
              <Text style={styles.usernameTxt}>{usernameMostrar}</Text>
              <View style={styles.chipsRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipTxt}>{fmtPesoChip(pesoUltimo)}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipTxt}>{fmtCmChip(profile?.altura_cm ?? null)}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipTxt}>{fmtEdadChip(profile?.edad ?? null)}</Text>
                </View>
              </View>
            </View>

            {/* BLOQUE 2 — Datos personales */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitulo}>DATOS PERSONALES</Text>
                {!editandoDatos ? (
                  <Pressable onPress={abrirEdicion} disabled={!profile} accessibilityRole="button">
                    <Text style={styles.linkPrimary}>Editar</Text>
                  </Pressable>
                ) : null}
              </View>
              {!profile ? (
                <Text style={[styles.rowValor, { textAlign: 'left' }]}>Sin datos de perfil.</Text>
              ) : !editandoDatos ? (
                <>
                  <View style={styles.rowLectura}>
                    <Text style={styles.rowLabel}>Género</Text>
                    <Text style={styles.rowValor}>{generoLabel(profile.genero)}</Text>
                  </View>
                  <View style={styles.rowLectura}>
                    <Text style={styles.rowLabel}>Edad</Text>
                    <Text style={styles.rowValor}>
                      {profile.edad != null ? `${profile.edad} años` : '—'}
                    </Text>
                  </View>
                  <View style={styles.rowLectura}>
                    <Text style={styles.rowLabel}>Altura</Text>
                    <Text style={styles.rowValor}>
                      {profile.altura_cm != null ? `${profile.altura_cm} cm` : '—'}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.labelEdit}>GÉNERO</Text>
                  <View style={styles.segmentRow}>
                    <Pressable
                      style={[styles.segmentBtn, editGenero === 'hombre' && styles.segmentBtnOn]}
                      onPress={() => setEditGenero('hombre')}
                    >
                      <Text style={[styles.segmentTxt, editGenero === 'hombre' && styles.segmentTxtOn]}>Hombre</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.segmentBtn, editGenero === 'mujer' && styles.segmentBtnOn]}
                      onPress={() => setEditGenero('mujer')}
                    >
                      <Text style={[styles.segmentTxt, editGenero === 'mujer' && styles.segmentTxtOn]}>Mujer</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.labelEdit}>EDAD</Text>
                  <TextInput
                    style={styles.input}
                    value={editEdad}
                    onChangeText={setEditEdad}
                    placeholder="años"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                  />
                  <Text style={styles.labelEdit}>ALTURA</Text>
                  <TextInput
                    style={styles.input}
                    value={editAltura}
                    onChangeText={setEditAltura}
                    placeholder="cm"
                    placeholderTextColor={c.textMuted}
                    keyboardType="decimal-pad"
                  />
                  <Pressable
                    style={[styles.btnPrimary, guardandoPerfil && { opacity: 0.5 }]}
                    onPress={guardarDatos}
                    disabled={guardandoPerfil}
                  >
                    <Text style={styles.btnPrimaryTxt}>Guardar</Text>
                  </Pressable>
                  <Pressable style={styles.btnGhost} onPress={cancelarEdicion} disabled={guardandoPerfil}>
                    <Text style={styles.btnGhostTxt}>Cancelar</Text>
                  </Pressable>
                </>
              )}
            </View>

            {/* BLOQUE 3 — Plan activo */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitulo}>PLAN ACTIVO</Text>
                <Pressable onPress={() => router.push('/(tabs)/(progreso)/personalizar-plan')} accessibilityRole="link">
                  <Text style={styles.linkPrimary}>Personalizar</Text>
                </Pressable>
              </View>
              {!goals ? (
                <>
                  <Text style={styles.sinPlanTxt}>Sin plan configurado</Text>
                  <Pressable style={styles.btnPrimary} onPress={() => router.push('/(tabs)/(progreso)/personalizar-plan')}>
                    <Text style={styles.btnPrimaryTxt}>Configurar plan</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.objetivoCentro}>{textoObjetivo(goals.objetivo)}</Text>
                  <View style={styles.kcalBlock}>
                    <Text style={styles.kcalNumero}>{Math.round(goals.calorias_objetivo)}</Text>
                    <Text style={styles.kcalSuffix}>kcal/día</Text>
                  </View>
                  <View style={styles.macrosRow}>
                    <View style={styles.chip}>
                      <Text style={styles.chipTxt}>{`${Math.round(goals.proteinas_objetivo)}g proteína`}</Text>
                    </View>
                    <View style={styles.chip}>
                      <Text style={styles.chipTxt}>{`${Math.round(goals.carbos_objetivo)}g carbos`}</Text>
                    </View>
                    <View style={styles.chip}>
                      <Text style={styles.chipTxt}>{`${Math.round(goals.grasas_objetivo)}g grasa`}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            <View style={styles.card}>
              <View style={[styles.cardHead, { marginBottom: s.sm }]}>
                <Text style={styles.cardTitulo}>MIS DATOS</Text>
              </View>
              <Pressable
                style={styles.cuentaRow}
                onPress={() => router.push('/(tabs)/(perfil)/perfil-ejercicios')}
                accessibilityRole="button"
              >
                <Text style={styles.cuentaRowLabel}>Ejercicios</Text>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
              <Pressable
                style={[styles.cuentaRow, styles.cuentaRowLast]}
                onPress={() => router.push('/(tabs)/(perfil)/perfil-entrenos')}
                accessibilityRole="button"
              >
                <Text style={styles.cuentaRowLabel}>Entrenos</Text>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
            </View>

            {/* BLOQUE 4 — Cuenta */}
            <View style={styles.card}>
              <View style={[styles.cardHead, { marginBottom: s.sm }]}>
                <Text style={styles.cardTitulo}>CUENTA</Text>
              </View>
              <Pressable style={styles.cuentaRow} onPress={onCambiarEmail} accessibilityRole="button">
                <Text style={styles.cuentaRowLabel}>Cambiar email</Text>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </Pressable>
              <Pressable style={styles.cuentaRow} onPress={onCambiarContrasena} accessibilityRole="button">
                <Text style={styles.cuentaRowLabel}>Cambiar contraseña</Text>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </Pressable>
              <View style={styles.cuentaRow}>
                <Text style={styles.cuentaRowLabel}>Plan actual</Text>
                <Text style={[styles.planBadge, { color: planBadgeColor(c, profile?.plan) }]}>
                  {planBadgeText(profile?.plan)}
                </Text>
              </View>
              <Pressable
                style={[styles.cuentaRow, styles.cuentaRowLast]}
                onPress={onCerrarSesion}
                accessibilityRole="button"
              >
                <Text style={[styles.cuentaRowLabel, styles.cuentaRowDanger]}>Cerrar sesión</Text>
              </Pressable>
            </View>

            {/* Iconos: sol (claro) · luna (oscuro) — preferencia en ThemeContext */}
            <View style={styles.themeToggleSection}>
              <View style={styles.themeToggleRow}>
                <Ionicons name="sunny-outline" size={16} color={c.textSecondary} style={styles.themeIcon} />
                <Switch
                  value={isDark}
                  onValueChange={(value) => setMode(value ? 'dark' : 'light')}
                />
                <Ionicons name="moon-outline" size={16} color={c.textSecondary} style={styles.themeIcon} />
              </View>
            </View>

            {/* TODO: ELIMINAR ANTES DE PRODUCCIÓN */}
            <Pressable
              onPress={() => router.push('/(onboarding)/datos')}
              style={styles.devOnboarding}
              accessibilityRole="button"
            >
              <Text style={styles.devOnboardingTxt}>⚙ [DEV] Ver onboarding</Text>
            </Pressable>
          </ScrollView>
        </>
      )}
    </View>
  );
}
