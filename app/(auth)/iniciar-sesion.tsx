import { SocialAuthButtons } from '@/components/ui/SocialAuthButtons';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import type { SocialAuthResult } from '@/services/social-auth.service';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function IniciarSesion() {
  const { c, f, ts, s, r } = useTheme();
  const { session } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session]);

  const handleSocialResult = (
    result: SocialAuthResult & { provider: 'google' | 'apple' },
  ) => {
    if (!result.ok) {
      if (result.error === 'CANCELLED') return; // el usuario canceló, no mostrar error
      setError('[ERROR: ' + (result.message ?? result.error) + ']');
    }
    // Si ok === true, AuthProvider detecta el cambio de sesión y redirige.
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Completa todos los campos.');
      return;
    }

    setCargando(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setCargando(false);

    if (authError) {
      setError('[ERROR: ' + authError.message + ']');
      return;
    }

    router.replace('/');
  };

  const styles = makeStyles(c, f, ts, s, r);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── LAYER 1: Hero ─────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Placeholder logo — reemplazar con <Image> cuando esté listo */}
          <View style={styles.logoPlaceholder} />
          <Text style={styles.logoText}>ACTIVA</Text>
          <Text style={styles.tagline}>TRACK. TRAIN. THRIVE.</Text>
        </View>

        {/* ── LAYER 2: Formulario ───────────────────────────── */}
        <View style={styles.form}>

          {/* Email */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              placeholderTextColor={c.textMuted}
              placeholder="tu@email.com"
              selectionColor={c.primary}
            />
            <View style={[styles.underline, email.length > 0 && styles.underlineFocused]} />
          </View>

          {/* Password */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              placeholderTextColor={c.textMuted}
              placeholder="••••••••"
              selectionColor={c.primary}
            />
            <View style={[styles.underline, password.length > 0 && styles.underlineFocused]} />
          </View>

          {/* Error inline — estilo Nothing: [ERROR: mensaje] */}
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {/* Botón primario — pill, invertido */}
          <TouchableOpacity
            style={[styles.btnPrimary, cargando && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={cargando}
            activeOpacity={0.85}
          >
            {cargando
              ? <ActivityIndicator color={c.background} size="small" />
              : <Text style={styles.btnPrimaryText}>SIGN IN</Text>
            }
          </TouchableOpacity>

          {/* Botones sociales — OR ─── Google / Apple */}
          <SocialAuthButtons onResult={handleSocialResult} />

        </View>

        {/* ── LAYER 3: Links secundarios ────────────────────── */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/recuperar-contrasena')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.footerLink}>FORGOT PASSWORD</Text>
          </TouchableOpacity>

          <Text style={styles.footerDivider}>|</Text>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/registrarse')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.footerLink, styles.footerLinkAccent]}>
              CREATE ACCOUNT
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

function makeStyles(
  c: ReturnType<typeof useTheme>['c'],
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },

    scroll: {
      flexGrow: 1,
      paddingHorizontal: s.lg,
      paddingBottom: s['3xl'],
    },

    // ── Layer 1
    hero: {
      marginTop: s['4xl'],
      marginBottom: s['3xl'],
    },

    logoPlaceholder: {
      width: 48,
      height: 48,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      marginBottom: s.lg,
    },

    logoText: {
      ...ts.displayXl,
      fontFamily: f.display,
      color: c.textDisplay,
    },

    tagline: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginTop: s.sm,
      letterSpacing: ts.label.letterSpacing,
    },

    // ── Layer 2
    form: {
      gap: s.lg, // 24px entre campos — "same group, different items"
    },

    fieldWrapper: {
      gap: s.xs, // 4px label → input: "belong together"
    },

    fieldLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: ts.label.letterSpacing,
    },

    input: {
      ...ts.body,
      fontFamily: f.mono,
      color: c.textDisplay,
      paddingVertical: s.sm,
      paddingHorizontal: 0,
    },

    underline: {
      height: 1,
      backgroundColor: c.borderVisible,
    },

    underlineFocused: {
      backgroundColor: c.text,
    },

    errorText: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.danger,
      letterSpacing: 0.4,
    },

    btnPrimary: {
      height: 52,
      borderRadius: r.pill,
      backgroundColor: c.textDisplay,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: s.sm, // pequeño extra gap antes del botón
    },

    btnDisabled: {
      opacity: 0.4,
    },

    btnPrimaryText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.background,
      letterSpacing: 1.2,
      fontSize: 13,
    },

    // ── Layer 3
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.md,
      marginTop: s['xxl'], // 48px — wide gap = "new group"
    },

    footerLink: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: ts.label.letterSpacing,
    },

    footerLinkAccent: {
      color: c.textSecondary, // un nivel más visible que "forgot"
    },

    footerDivider: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.borderVisible,
    },
  });
}
