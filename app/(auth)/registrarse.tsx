import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import LogoSVG from '@/assets/images/logo_sb.svg';
import { GlowBeams } from '@/components/ui/GlowBeams';
import { GlowButton } from '@/components/ui/GlowButton';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { loginConGoogle } from '@/services/social-auth.service';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const SW = Dimensions.get('window').width;
const HERO_H = 140;

const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surfaceElevated;
const BORDER = AUTH.borderVisible;
const LABEL = '#777777';
const MUTED = AUTH.textMuted;

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

export default function Registrarse() {
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

  const refUsername = useRef<TextInput>(null);
  const refEmail = useRef<TextInput>(null);
  const refPassword = useRef<TextInput>(null);

  const passwordChecks = {
    minLength: password.length >= 8,
    mixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
    numberOrSpecial: /[0-9\W_]/.test(password),
  };
  const passwordOk = Object.values(passwordChecks).every(Boolean);

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
    }, 600);

    return () => clearTimeout(timer);
  }, [username]);

  const handleRegister = async () => {
    setError(null);

    if (!nombre.trim() || !username.trim() || !email.trim() || !password) {
      setError('Completa todos los campos.');
      return;
    }
    if (usernameStatus !== 'available') {
      setError('El usuario no está disponible o tiene un formato inválido.');
      return;
    }
    if (!passwordOk) {
      setError('La contraseña no cumple los requisitos.');
      return;
    }

    setCargando(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          nombre: nombre.trim(),
          username: username.trim().toLowerCase(),
        },
      },
    });

    if (signUpError) {
      setCargando(false);
      setError(signUpError.message);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      await supabase
        .from('profiles')
        .update({
          nombre: nombre.trim(),
          username: username.trim().toLowerCase(),
        })
        .eq('id', userId);
    }

    setCargando(false);

    if (!data.session) {
      router.replace({
        pathname: '/(auth)/confirmar-email',
        params: { email: email.trim().toLowerCase() },
      });
    }
  };

  const handleGoogle = async () => {
    setCargandoGoogle(true);
    const result = await loginConGoogle();
    setCargandoGoogle(false);
    if (!result.ok && result.error !== 'CANCELLED') {
      setError(result.message ?? 'Error al continuar con Google.');
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  };

  return (
    <KeyboardAvoidingView
      style={st.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          st.scroll,
          { paddingBottom: insets.bottom + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[st.hero, { height: HERO_H, marginTop: insets.top }]}>
          <GlowBeams width={SW} height={HERO_H} />

          <LogoSVG width={70} height={80} style={st.logo} />
        </View>

        <View style={st.copyBlock}>
          <Text style={st.title}>Crea tu cuenta</Text>
          <Text style={st.subtitle}>
            Empieza a <Text style={st.subtitleAccent}>transformar</Text> tu físico y tu vida.
          </Text>
        </View>

        <View style={st.form}>
          <View style={st.fieldsStack}>
            <View style={st.fieldBlock}>
              <View style={st.inputRow}>
                <Ionicons name="person-outline" size={22} color={CYAN} style={st.inputIcon} />
                <View style={st.inputBody}>
                  <Text style={st.label}>NOMBRE COMPLETO</Text>
                  <TextInput
                    style={st.input}
                    value={nombre}
                    onChangeText={setNombre}
                    placeholder="Tu nombre"
                    placeholderTextColor={MUTED}
                    returnKeyType="next"
                    onSubmitEditing={() => refUsername.current?.focus()}
                    selectionColor={CYAN}
                    autoComplete="given-name"
                  />
                </View>
              </View>
            </View>

            <View style={st.fieldBlock}>
              <View style={st.inputRow}>
                <Ionicons name="at-outline" size={22} color={CYAN} style={st.inputIcon} />
                <View style={st.inputBody}>
                  <Text style={st.label}>USUARIO</Text>
                  <TextInput
                    ref={refUsername}
                    style={st.input}
                    value={username}
                    onChangeText={handleUsernameChange}
                    placeholder="tu_usuario"
                    placeholderTextColor={MUTED}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => refEmail.current?.focus()}
                    selectionColor={CYAN}
                    maxLength={20}
                  />
                </View>
              </View>
            </View>

            <View style={st.fieldBlock}>
              <View style={st.inputRow}>
                <Ionicons name="mail-outline" size={22} color={CYAN} style={st.inputIcon} />
                <View style={st.inputBody}>
                  <Text style={st.label}>EMAIL</Text>
                  <TextInput
                    ref={refEmail}
                    style={st.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="tu@email.com"
                    placeholderTextColor={MUTED}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={() => refPassword.current?.focus()}
                    selectionColor={CYAN}
                    autoComplete="email"
                  />
                </View>
              </View>
            </View>

            <View style={st.fieldBlock}>
              <View style={st.inputRow}>
                <Ionicons name="lock-closed-outline" size={22} color={CYAN} style={st.inputIcon} />
                <View style={st.inputBody}>
                  <Text style={st.label}>CONTRASEÑA</Text>
                  <TextInput
                    ref={refPassword}
                    style={st.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor={MUTED}
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                    selectionColor={CYAN}
                  />
                </View>
                <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={8}>
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={MUTED}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={st.requirementsCard}>
            <RequirementRow done={passwordChecks.minLength} text="Al menos 8 caracteres" />
            <RequirementRow done={passwordChecks.mixedCase} text="Una letra mayúscula y una minúscula" />
            <RequirementRow done={passwordChecks.numberOrSpecial} text="Un número o carácter especial" />
          </View>

          {error != null && <Text style={st.errorTxt}>{error}</Text>}

          <GlowButton borderRadius={14}>
            <TouchableOpacity
              style={[st.btnPrimary, cargando && st.btnDim]}
              onPress={handleRegister}
              disabled={cargando}
              activeOpacity={0.82}
            >
              {cargando ? (
                <ActivityIndicator color={BG} size="small" />
              ) : (
                <>
                  <Text style={st.btnPrimaryTxt}>CREAR CUENTA</Text>
                  <Ionicons name="arrow-forward" size={20} color={BG} />
                </>
              )}
            </TouchableOpacity>
          </GlowButton>

          <View style={st.dividerRow}>
            <View style={st.dividerLine} />
            <Text style={st.dividerTxt}>O CONTINÚA CON</Text>
            <View style={st.dividerLine} />
          </View>

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
                  <GoogleLogoColored size={23} />
                  <Text style={st.btnGoogleTxt}>Continuar con Google</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={MUTED} style={st.btnGoogleArrow} />
              </>
            )}
          </TouchableOpacity>

          <View style={st.footer}>
            <Text style={st.footerTxt}>¿Ya tienes cuenta?</Text>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/iniciar-sesion')}
              hitSlop={8}
            >
              <Text style={st.footerLink}>Iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RequirementRow({ done, text }: { done: boolean; text: string }) {
  return (
    <View style={st.requirementRow}>
      <View style={[st.requirementDot, done && st.requirementDotDone]}>
        {done ? <Ionicons name="checkmark" size={12} color={BG} /> : null}
      </View>
      <Text style={st.requirementTxt}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -12,
  },
  logo: {
    marginBottom: 0,
    marginLeft: -5,
  },
  copyBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: AUTH.textSecondary,
    textAlign: 'center',
  },
  subtitleAccent: {
    color: CYAN,
  },
  form: {
    gap: 7,
    paddingTop: 20
  },
  fieldsStack: {
    gap: 20,
  },
  fieldBlock: {
    gap: 3,
  },
  inputRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  inputIcon: {
    width: 24,
    textAlign: 'center',
  },
  inputBody: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
    color: LABEL,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  input: {
    marginTop: 3,
    padding: 0,
    fontSize: 15,
    lineHeight: 19,
    color: WHITE,
  },
  helper: {
    marginLeft: 52,
    fontSize: 11,
    lineHeight: 14,
    color: MUTED,
  },
  requirementsCard: {
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    marginBottom: 15
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requirementDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requirementDotDone: {
    backgroundColor: CYAN,
  },
  requirementTxt: {
    fontSize: 12,
    lineHeight: 15,
    color: AUTH.textSecondary,
  },
  errorTxt: {
    fontSize: 13,
    lineHeight: 17,
    color: AUTH.dangerText,
  },
  btnPrimary: {
    height: 56,
    borderRadius: 14,
    backgroundColor: CYAN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  btnDim: {
    opacity: 0.55,
  },
  btnPrimaryTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: BG,
    letterSpacing: 2.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },
  dividerTxt: {
    fontSize: 11,
    color: LABEL,
    letterSpacing: 1.6,
    fontWeight: '600',
  },
  btnGoogle: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: AUTH.surface,
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
    gap: 14,
  },
  btnGoogleTxt: {
    fontSize: 15,
    color: WHITE,
    fontWeight: '700',
  },
  btnGoogleArrow: {
    position: 'absolute',
    right: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
    marginBottom: 4,
  },
  footerTxt: {
    fontSize: 14,
    color: MUTED,
  },
  footerLink: {
    fontSize: 14,
    color: CYAN,
    fontWeight: '700',
  },
});
