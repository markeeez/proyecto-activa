/**
 * IniciarSesion — rediseño Vértice
 * Fondo negro, logo de assets, campos con borde redondeado e iconos cyan,
 * botón ENTRAR cyan sólido, botón Google oscuro outlined.
 */

import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import LogoSVG from '@/assets/images/logos/logo_sb.svg';
import VerticeSVG from '@/assets/images/logos/VERTICE.svg';
import { GlowButton } from '@/components/ui/GlowButton';
import { GlowBeams } from '@/components/ui/GlowBeams';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { loginConGoogle } from '@/services/social-auth.service';

const SW = Dimensions.get('window').width;
const HERO_H = 220; // altura del área hero donde se renderizan los rayos

/* ── Paleta fija (siempre oscura, independiente del tema) ───────────── */
const BG           = '#000000';
const CYAN         = '#00C8FF';
const WHITE        = '#FFFFFF';
const INPUT_BG     = '#111111';
const INPUT_BORDER = '#242424';
const LABEL_CLR    = '#666666';
const MUTED_CLR    = '#444444';

/** Logo G de Google (colores de marca) — el glifo vectorial solo admite un color. */
function GoogleLogoColored({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Google">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 2.3-4.53 5.16-4.53z"
      />
    </Svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

export default function IniciarSesion() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [showPass,       setShowPass]       = useState(false);
  const [cargando,       setCargando]       = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace('/');
  }, [session]);

  /* ── Login email/pass ── */
  const handleLogin = async () => {
    if (!email || !password) { setError('Completa todos los campos.'); return; }
    setCargando(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setCargando(false);
    if (authError) { setError(authError.message); return; }
    router.replace('/');
  };

  /* ── Login Google ── */
  const handleGoogle = async () => {
    setCargandoGoogle(true);
    const result = await loginConGoogle();
    setCargandoGoogle(false);
    if (!result.ok && result.error !== 'CANCELLED') {
      setError(result.message ?? 'Error al iniciar con Google.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={st.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={[
          st.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
        ]}
      >

        {/* ── Branding ─────────────────────────────────────────────── */}
        <View style={[st.hero, { height: HERO_H }]}>
          {/* Rayos de luz en V — capa de fondo */}
          <GlowBeams width={SW} height={HERO_H} />

          {/* Logo — centrado sobre los rayos */}
          <LogoSVG width={100} height={120} style={st.logo} />
        </View>

        {/* Textos — debajo del hero y las líneas */}
        <View style={st.brandingText}>
          <VerticeSVG width={190} height={24} style={st.brand} />
          <Text style={st.tagline1}>TU PUNTO DE EQUILIBRIO</Text>
          <Text style={st.tagline2}>NUTRICIÓN · ENTRENO · IA</Text>
        </View>

        {/* ── Formulario ───────────────────────────────────────────── */}
        <View style={st.form}>

          {/* Email */}
          <View style={st.fieldBlock}>
            <Text style={st.label}>EMAIL</Text>
            <View style={st.inputRow}>
              <Ionicons name="mail-outline" size={20} color={CYAN} />
              <TextInput
                style={st.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                placeholder="tu@email.com"
                placeholderTextColor={MUTED_CLR}
                selectionColor={CYAN}
              />
            </View>
          </View>

          {/* Contraseña */}
          <View style={st.fieldBlock}>
            <Text style={st.label}>CONTRASEÑA</Text>
            <View style={st.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color={CYAN} />
              <TextInput
                style={[st.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                placeholder="••••••••"
                placeholderTextColor={MUTED_CLR}
                selectionColor={CYAN}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={8}>
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={LABEL_CLR}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ¿Olvidaste? → recuperar contraseña */}
          <Link href="/(auth)/recuperar-contrasena" asChild>
            <TouchableOpacity style={st.forgotWrap} hitSlop={8}>
              <Text style={st.forgotTxt}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </Link>

          {/* Error */}
          {error != null && (
            <Text style={st.errorTxt}>{error}</Text>
          )}

          {/* Botón ENTRAR */}
          <GlowButton borderRadius={14}>
            <TouchableOpacity
              style={[st.btnEntrar, cargando && st.btnDim]}
              onPress={handleLogin}
              disabled={cargando}
              activeOpacity={0.82}
            >
              {cargando ? (
                <ActivityIndicator color={BG} size="small" />
              ) : (
                <>
                  <Text style={st.btnEntrarTxt}>ENTRAR</Text>
                  <Ionicons name="arrow-forward" size={20} color={BG} />
                </>
              )}
            </TouchableOpacity>
          </GlowButton>

          {/* Divider "O CONTINÚA CON" */}
          <View style={st.dividerRow}>
            <View style={st.dividerLine} />
            <Text style={st.dividerTxt}>O CONTINÚA CON</Text>
            <View style={st.dividerLine} />
          </View>

          {/* Botón Google */}
          <TouchableOpacity
            style={[st.btnGoogle, cargandoGoogle && st.btnDim]}
            onPress={handleGoogle}
            disabled={cargandoGoogle}
            activeOpacity={0.82}
          >
            {cargandoGoogle ? (
              <ActivityIndicator color={WHITE} size="small" />
            ) : (
              <>
                <View style={st.btnGoogleCenter}>
                  <GoogleLogoColored size={22} />
                  <Text style={st.btnGoogleTxt}>Continuar con Google</Text>
                </View>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={LABEL_CLR}
                  style={st.btnGoogleArrow}
                />
              </>
            )}
          </TouchableOpacity>

        </View>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <View style={st.footer}>
          <Text style={st.footerTxt}>¿No tienes cuenta?</Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/registrarse')}
            hitSlop={8}
          >
            <Text style={st.footerLink}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

/* ── Estilos ─────────────────────────────────────────────────────────── */
const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },

  /* Branding */
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  logo: {
    marginBottom: 0,
    marginLeft: -8
  },
  brandingText: {
    alignItems: 'center',
    marginTop: -50,
    marginBottom: 18,
  },
  brand: {
    marginBottom: 8,
  },
  tagline1: {
    fontSize: 11,
    color: CYAN,
    letterSpacing: 3.5,
    fontWeight: '500',
    marginBottom: 5,
  },
  tagline2: {
    fontSize: 11,
    color: WHITE,
    letterSpacing: 2.5,
    opacity: 0.55,
  },

  /* Formulario */
  form: {
    gap: 14,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    color: LABEL_CLR,
    letterSpacing: 1.8,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: WHITE,
    padding: 0,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotTxt: {
    fontSize: 13,
    color: CYAN,
  },
  errorTxt: {
    fontSize: 13,
    color: '#FF4444',
    marginTop: -6,
  },

  /* ENTRAR */
  btnEntrar: {
    height: 56,
    borderRadius: 14,
    backgroundColor: CYAN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  btnEntrarTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: BG,
    letterSpacing: 2.5,
  },
  btnDim: {
    opacity: 0.55,
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: INPUT_BORDER,
  },
  dividerTxt: {
    fontSize: 11,
    color: LABEL_CLR,
    letterSpacing: 1.2,
  },

  /* Google */
  btnGoogle: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: INPUT_BG,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 16,
  },
  btnGoogleCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  btnGoogleTxt: {
    fontSize: 15,
    color: WHITE,
    fontWeight: '500',
  },
  btnGoogleArrow: {
    position: 'absolute',
    right: 16,
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 10,
  },
  footerTxt: {
    fontSize: 14,
    color: LABEL_CLR
  },
  footerLink: {
    fontSize: 14,
    color: CYAN,
    fontWeight: '500'
  },
});
