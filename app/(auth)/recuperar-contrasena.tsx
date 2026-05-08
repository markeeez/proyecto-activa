import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LogoSVG from '@/assets/images/logo_sb.svg';
import { GlowBeams } from '@/components/ui/GlowBeams';
import { GlowButton } from '@/components/ui/GlowButton';
import { Colors } from '@/constants/theme';
import { authService } from '@/services/auth.service';

const SW = Dimensions.get('window').width;
const HERO_H = 140;

const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const CYAN_BORDER = `${CYAN}45`;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surfaceElevated;
const BORDER = AUTH.borderVisible;
const LABEL = '#777777';
const MUTED = AUTH.textMuted;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORT_EMAIL = 'soporte@activa.app';

export default function RecuperarContrasena() {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviadoA, setEnviadoA] = useState<string | null>(null);

  const handleEnviarEnlace = async () => {
    const emailNormalizado = email.trim().toLowerCase();

    if (!EMAIL_RE.test(emailNormalizado)) {
      setError('Introduce un email válido.');
      return;
    }

    setCargando(true);
    setError(null);
    setEnviadoA(null);

    const { error: resetError } = await authService.recuperarContrasena(emailNormalizado);

    setCargando(false);

    if (resetError) {
      const msg = resetError.message.toLowerCase();
      setError(msg.includes('rate') || msg.includes('too many') ? 'No se pudo enviar el enlace. Inténtalo más tarde.' : 'No se pudo enviar el enlace. Revisa el email e inténtalo de nuevo.');
      return;
    }

    setEnviadoA(emailNormalizado);
  };

  const handleContact = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  return (
    <KeyboardAvoidingView
      style={st.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[st.screen, { paddingBottom: insets.bottom + 18 }]}>
        <View style={[st.hero, { height: HERO_H, marginTop: insets.top }]}>
          <GlowBeams width={SW} height={HERO_H} />

          <LogoSVG width={70} height={80} style={st.logo} />
        </View>

        <View style={st.copyBlock}>
          <Text style={st.title}>RECUPERA TU CONTRASEÑA</Text>
          <Text style={st.subtitle}>
            Te enviaremos un <Text style={st.subtitleAccent}>enlace seguro</Text> para que
            puedas restablecer tu contraseña.
          </Text>
        </View>

        <View style={st.form}>
          <View style={st.fieldBlock}>
            <Text style={st.label}>EMAIL</Text>
            <View style={[st.inputRow, error && st.inputRowError]}>
              <Ionicons name="mail-outline" size={22} color={CYAN} style={st.inputIcon} />
              <TextInput
                style={st.input}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (error) setError(null);
                  if (enviadoA) setEnviadoA(null);
                }}
                placeholder="tu@email.com"
                placeholderTextColor={MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleEnviarEnlace}
                selectionColor={CYAN}
                autoComplete="email"
              />
            </View>
            {error != null && <Text style={st.errorTxt}>{error}</Text>}
          </View>

          {enviadoA != null && (
            <View style={st.successCard}>
              <Ionicons name="checkmark-circle-outline" size={22} color={AUTH.successText} />
              <View style={st.successTextBlock}>
                <Text style={st.successTitle}>Revisa tu correo</Text>
                <Text style={st.successText}>
                  Si existe una cuenta asociada, recibirás un enlace para restablecer tu contraseña.
                </Text>
              </View>
            </View>
          )}

          <GlowButton borderRadius={12}>
            <TouchableOpacity
              style={[st.btnPrimary, cargando && st.btnDim]}
              onPress={handleEnviarEnlace}
              disabled={cargando}
              activeOpacity={0.82}
            >
              {cargando ? (
                <ActivityIndicator color={BG} size="small" />
              ) : (
                <>
                  <Text style={st.btnPrimaryTxt}>ENVIAR ENLACE</Text>
                  <Ionicons name="arrow-forward" size={20} color={BG} />
                </>
              )}
            </TouchableOpacity>
          </GlowButton>

          <View style={st.infoCard}>
            <View style={st.shieldCircle}>
              <Ionicons name="shield-checkmark-outline" size={26} color={CYAN} />
            </View>
            <View style={st.infoTextBlock}>
              <Text style={st.infoTitle}>Enlace seguro y temporal</Text>
              <Text style={st.infoText}>El enlace es temporal y solo sirve para cambiar tu contraseña.</Text>
            </View>
          </View>

          <View style={st.dividerRow}>
            <View style={st.dividerLine} />
            <Text style={st.dividerTxt}>¿RECUERDAS TU CONTRASEÑA?</Text>
            <View style={st.dividerLine} />
          </View>

          <TouchableOpacity
            style={st.loginCard}
            onPress={() => router.replace('/(auth)/iniciar-sesion')}
            activeOpacity={0.82}
          >
            <Ionicons name="arrow-back" size={22} color={CYAN} />
            <Text style={st.loginText}>Volver a iniciar sesión</Text>
          </TouchableOpacity>

          <View style={st.footer}>
            <Text style={st.footerTxt}>¿Necesitas ayuda?</Text>
            <TouchableOpacity onPress={handleContact} hitSlop={8}>
              <Text style={st.footerLink}>Contáctanos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  screen: {
    flex: 1,
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
    marginBottom: 26,
    marginTop: 20
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 330,
    marginTop: 14,
    fontSize: 15,
    lineHeight: 22,
    color: WHITE,
    textAlign: 'center',
  },
  subtitleAccent: {
    color: CYAN,
  },
  form: {
    gap: 20,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
    color: LABEL,
    letterSpacing: 1.8,
    fontWeight: '700',
  },
  inputRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  inputRowError: {
    borderColor: AUTH.dangerText,
  },
  inputIcon: {
    width: 24,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    padding: 0,
    fontSize: 15,
    lineHeight: 20,
    color: WHITE,
  },
  errorTxt: {
    fontSize: 13,
    lineHeight: 17,
    color: AUTH.dangerText,
  },
  successCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AUTH.success,
    backgroundColor: AUTH.successBg,
  },
  successTextBlock: {
    flex: 1,
    gap: 3,
  },
  successTitle: {
    fontSize: 14,
    lineHeight: 18,
    color: AUTH.successText,
    fontWeight: '800',
  },
  successText: {
    fontSize: 12,
    lineHeight: 16,
    color: AUTH.successText,
  },
  btnPrimary: {
    height: 56,
    borderRadius: 12,
    backgroundColor: CYAN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  btnDim: {
    opacity: 0.55,
  },
  btnPrimaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: BG,
    letterSpacing: 2.6,
  },
  infoCard: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CYAN_BORDER,
    backgroundColor: SURFACE,
  },
  shieldCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextBlock: {
    flex: 1,
    gap: 5,
  },
  infoTitle: {
    fontSize: 14,
    lineHeight: 18,
    color: WHITE,
    fontWeight: '800',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 16,
    color: MUTED,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },
  dividerTxt: {
    fontSize: 10,
    lineHeight: 13,
    color: LABEL,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  loginCard: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  loginText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: WHITE,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    marginBottom: 4,
  },
  footerTxt: {
    fontSize: 13,
    color: MUTED,
  },
  footerLink: {
    fontSize: 13,
    color: CYAN,
    fontWeight: '700',
  },
});
