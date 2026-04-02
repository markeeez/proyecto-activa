import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { SocialAuthButtons } from '@/components/ui/SocialAuthButtons';
import type { SocialAuthResult } from '@/services/social-auth.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Registrarse() {
  const { c, f, ts, s, r } = useTheme();

  const [nombre, setNombre]     = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const [cargando, setCargando]             = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

  // Refs para navegar entre inputs con el teclado
  const refUsername = useRef<TextInput>(null);
  const refEmail    = useRef<TextInput>(null);
  const refPassword = useRef<TextInput>(null);

  // ── Auth social ──────────────────────────────────────────────────────────
  const handleSocialResult = (
    result: SocialAuthResult & { provider: 'google' | 'apple' },
  ) => {
    if (!result.ok) {
      if (result.error === 'CANCELLED') return;
      setError('[ERROR: ' + (result.message ?? result.error) + ']');
    }
    // Si ok === true, AuthProvider detecta la sesión y redirige.
  };

  // ── Validación de username con debounce ──────────────────────────────────
  useEffect(() => {
    if (username.length === 0) {
      setUsernameStatus('idle');
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      setUsernameStatus(data ? 'taken' : 'available');
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [username]);

  // ── Registro ─────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    setError(null);

    if (!nombre.trim() || !username.trim() || !email.trim() || !password) {
      setError('[ERROR: COMPLETA TODOS LOS CAMPOS]');
      return;
    }
    if (usernameStatus !== 'available') {
      setError('[ERROR: EL USERNAME NO ESTÁ DISPONIBLE]');
      return;
    }
    if (password.length < 8) {
      setError('[ERROR: LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES]');
      return;
    }

    setCargando(true);

    // 1. Crear usuario en Supabase Auth
    // El trigger on_auth_user_created crea la fila en profiles automáticamente.
    // Pasamos nombre y username en raw_user_meta_data para que el trigger
    // pueda usarlos si está configurado para ello.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          nombre:   nombre.trim(),
          username: username.trim().toLowerCase(),
        },
      },
    });

    if (signUpError) {
      setCargando(false);
      setError('[ERROR: ' + signUpError.message.toUpperCase() + ']');
      return;
    }

    // 2. Si el trigger no escribe nombre/username, lo hacemos nosotros.
    // Esperamos a tener un userId (puede venir aunque requiera confirmación).
    const userId = data.user?.id;
    if (userId) {
      await supabase
        .from('profiles')
        .update({
          nombre:   nombre.trim(),
          username: username.trim().toLowerCase(),
        })
        .eq('id', userId);
    }

    setCargando(false);

    // 3. Si Supabase requiere confirmación de email → mostrar mensaje.
    //    Si no (email confirm desactivado) → AuthProvider detecta la sesión
    //    y app/index.tsx redirige al onboarding automáticamente.
    if (!data.session) {
      router.replace({
        pathname: '/(auth)/confirmar-email',
        params: { email: email.trim().toLowerCase() },
      });
    }
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

        {/* ── LAYER 1: Encabezado ───────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>CREATE{'\n'}ACCOUNT</Text>
        </View>

        {/* ── LAYER 2: Formulario ───────────────────────────── */}
        <View style={styles.form}>

          {/* Nombre */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>NOMBRE</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Tu nombre"
              placeholderTextColor={c.textMuted}
              returnKeyType="next"
              onSubmitEditing={() => refUsername.current?.focus()}
              selectionColor={c.primary}
              autoComplete="given-name"
            />
            <View style={[styles.underline, nombre.length > 0 && styles.underlineFilled]} />
          </View>

          {/* Username */}
          <View style={styles.fieldWrapper}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <UsernameIndicator status={usernameStatus} styles={styles} />
            </View>
            <TextInput
              ref={refUsername}
              style={styles.input}
              value={username}
              onChangeText={v => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="tu_usuario"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => refEmail.current?.focus()}
              selectionColor={c.primary}
              maxLength={20}
            />
            <View style={[
              styles.underline,
              username.length > 0 && styles.underlineFilled,
              usernameStatus === 'available' && styles.underlineSuccess,
              (usernameStatus === 'taken' || usernameStatus === 'invalid') && styles.underlineError,
            ]} />
            <Text style={styles.fieldHint}>3–20 CARACTERES. SOLO a–z, 0–9, _</Text>
          </View>

          {/* Email */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              ref={refEmail}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => refPassword.current?.focus()}
              selectionColor={c.primary}
              autoComplete="email"
            />
            <View style={[styles.underline, email.length > 0 && styles.underlineFilled]} />
          </View>

          {/* Password */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              ref={refPassword}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor={c.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              selectionColor={c.primary}
            />
            <View style={[
              styles.underline,
              password.length > 0 && styles.underlineFilled,
              password.length > 0 && password.length < 8 && styles.underlineError,
              password.length >= 8 && styles.underlineSuccess,
            ]} />
          </View>

          {/* Error inline */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Botón primario */}
          <TouchableOpacity
            style={[styles.btnPrimary, cargando && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={cargando}
            activeOpacity={0.85}
          >
            {cargando
              ? <ActivityIndicator color={c.background} size="small" />
              : <Text style={styles.btnPrimaryText}>CREATE ACCOUNT</Text>
            }
          </TouchableOpacity>

          {/* Botones sociales — OR ─── Google / Apple */}
          <SocialAuthButtons onResult={handleSocialResult} />

        </View>

        {/* ── LAYER 3: Link login ───────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿YA TIENES CUENTA?</Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/iniciar-sesion')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.footerLink}>SIGN IN</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Indicador de username (inline, Nothing-style) ────────────────────────────

function UsernameIndicator({
  status,
  styles,
}: {
  status: UsernameStatus;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (status === 'idle') return null;
  if (status === 'checking') return (
    <Text style={styles.usernameChecking}>COMPROBANDO...</Text>
  );
  if (status === 'available') return (
    <Text style={styles.usernameAvailable}>[DISPONIBLE]</Text>
  );
  if (status === 'taken') return (
    <Text style={styles.usernameTaken}>[NO DISPONIBLE]</Text>
  );
  if (status === 'invalid') return (
    <Text style={styles.usernameTaken}>[FORMATO INVÁLIDO]</Text>
  );
  return null;
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
    header: {
      marginTop: s['2xl'],    // 48px — no tan grande como el hero del login
      marginBottom: s['2xl'],
    },

    title: {
      ...ts.displayMd,
      fontFamily: f.display,
      color: c.textDisplay,
    },

    // ── Layer 2
    form: {
      gap: s.lg,
    },

    fieldWrapper: {
      gap: s.xs,
    },

    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    fieldLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: ts.label.letterSpacing,
    },

    fieldHint: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      fontSize: 10,
      marginTop: s.xxs,
      letterSpacing: 0.6,
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

    underlineFilled: {
      backgroundColor: c.text,
    },

    underlineSuccess: {
      backgroundColor: c.success,
    },

    underlineError: {
      backgroundColor: c.danger,
    },

    // Indicadores username
    usernameChecking: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.6,
    },

    usernameAvailable: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.success,
      letterSpacing: 0.6,
    },

    usernameTaken: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.danger,
      letterSpacing: 0.6,
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
      marginTop: s.sm,
    },

    btnDisabled: {
      opacity: 0.4,
    },

    btnPrimaryText: {
      fontFamily: f.mono,
      color: c.background,
      fontSize: 13,
      letterSpacing: 1.2,
    },

    // ── Layer 3
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
      marginTop: s['2xl'],
    },

    footerText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: ts.label.letterSpacing,
    },

    footerLink: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: ts.label.letterSpacing,
    },
  });
}
