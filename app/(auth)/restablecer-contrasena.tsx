import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LogoSVG from '@/assets/images/logo_sb.svg';
import { GlowBeams } from '@/components/ui/GlowBeams';
import { GlowButton } from '@/components/ui/GlowButton';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surfaceElevated;
const BORDER = AUTH.borderVisible;
const LABEL = '#777777';
const MUTED = AUTH.textMuted;

type AuthLikeError = {
  message?: string;
};

function mensajePasswordError(error: AuthLikeError): string {
  const message = error.message ?? '';
  const lower = message.toLowerCase();
  if (lower.includes('expired') || lower.includes('invalid') || lower.includes('session')) {
    return 'El enlace no es válido o ha caducado. Solicita uno nuevo.';
  }
  return message || 'No se pudo actualizar la contraseña.';
}

export default function RestablecerContrasena() {
  const insets = useSafeAreaInsets();
  const { session, cargando } = useAuth();
  const { error: linkError } = useLocalSearchParams<{ error?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 8,
      mixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
      numberOrSpecial: /[0-9\W_]/.test(password),
    }),
    [password],
  );
  const passwordOk = Object.values(passwordChecks).every(Boolean);
  const matchOk = password.length > 0 && password === confirmPassword;
  const canSubmit = !guardando && passwordOk && matchOk && Boolean(session);

  const guardarPassword = async () => {
    if (!canSubmit) {
      setError('Revisa los requisitos de la contraseña.');
      return;
    }

    setGuardando(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(mensajePasswordError(updateError));
        return;
      }

      setSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 750));
      await supabase.auth.signOut();
      router.replace('/(auth)/iniciar-sesion');
    } catch (caught) {
      setError(mensajePasswordError(caught as AuthLikeError));
    } finally {
      setGuardando(false);
    }
  };

  const invalidLink = !cargando && (!session || linkError === 'invalid');

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.screen, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 22 }]}
      >
        <View style={st.hero}>
          <GlowBeams width={360} height={126} />
          <LogoSVG width={70} height={80} style={st.logo} />
        </View>

        <View style={st.copyBlock}>
          <Text style={st.title}>NUEVA CONTRASEÑA</Text>
          <Text style={st.subtitle}>Crea una clave segura para volver a acceder a tu cuenta.</Text>
        </View>

        {invalidLink ? (
          <View style={st.invalidCard}>
            <Ionicons name="alert-circle-outline" size={28} color={AUTH.dangerText} />
            <Text style={st.invalidTitle}>Enlace no válido</Text>
            <Text style={st.invalidText}>Solicita un nuevo enlace para restablecer tu contraseña.</Text>
            <Pressable style={st.secondaryBtn} onPress={() => router.replace('/(auth)/recuperar-contrasena')}>
              <Text style={st.secondaryBtnText}>Pedir nuevo enlace</Text>
            </Pressable>
          </View>
        ) : (
          <View style={st.form}>
            <View style={st.fieldBlock}>
              <Text style={st.label}>NUEVA CONTRASEÑA</Text>
              <View style={st.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={CYAN} />
                <TextInput
                  style={st.input}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError('');
                  }}
                  secureTextEntry={!showPass}
                  placeholder="••••••••"
                  placeholderTextColor={MUTED}
                  selectionColor={CYAN}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  returnKeyType="next"
                />
                <Pressable onPress={() => setShowPass((prev) => !prev)} hitSlop={8}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={LABEL} />
                </Pressable>
              </View>
            </View>

            <View style={st.fieldBlock}>
              <Text style={st.label}>REPETIR CONTRASEÑA</Text>
              <View style={[st.inputRow, confirmPassword.length > 0 && !matchOk && st.inputRowError]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={CYAN} />
                <TextInput
                  style={st.input}
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    setError('');
                  }}
                  secureTextEntry={!showConfirm}
                  placeholder="••••••••"
                  placeholderTextColor={MUTED}
                  selectionColor={CYAN}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={() => void guardarPassword()}
                />
                <Pressable onPress={() => setShowConfirm((prev) => !prev)} hitSlop={8}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={LABEL} />
                </Pressable>
              </View>
            </View>

            <View style={st.requirementsCard}>
              <Requirement ok={passwordChecks.minLength} text="Al menos 8 caracteres" />
              <Requirement ok={passwordChecks.mixedCase} text="Una mayúscula y una minúscula" />
              <Requirement ok={passwordChecks.numberOrSpecial} text="Un número o carácter especial" />
              <Requirement ok={matchOk} text="Las contraseñas coinciden" />
            </View>

            {error ? <Text style={st.errorTxt}>{error}</Text> : null}
            {success ? <Text style={st.successTxt}>Contraseña actualizada. Volviendo al login...</Text> : null}

            <GlowButton borderRadius={12}>
              <Pressable style={[st.btnPrimary, !canSubmit && st.btnDim]} onPress={() => void guardarPassword()} disabled={!canSubmit}>
                {guardando ? (
                  <ActivityIndicator color={BG} size="small" />
                ) : (
                  <>
                    <Text style={st.btnPrimaryTxt}>GUARDAR CONTRASEÑA</Text>
                    <Ionicons name="arrow-forward" size={20} color={BG} />
                  </>
                )}
              </Pressable>
            </GlowButton>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Requirement({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={st.requirementRow}>
      <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={ok ? CYAN : MUTED} />
      <Text style={[st.requirementText, ok && st.requirementTextOk]}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  screen: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  hero: {
    height: 126,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    marginLeft: -5,
  },
  copyBlock: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 320,
    fontSize: 15,
    lineHeight: 22,
    color: WHITE,
    textAlign: 'center',
  },
  form: {
    gap: 18,
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
  input: {
    flex: 1,
    padding: 0,
    fontSize: 15,
    lineHeight: 20,
    color: WHITE,
  },
  requirementsCard: {
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    fontSize: 12,
    lineHeight: 16,
    color: MUTED,
  },
  requirementTextOk: {
    color: WHITE,
  },
  errorTxt: {
    fontSize: 13,
    lineHeight: 17,
    color: AUTH.dangerText,
  },
  successTxt: {
    fontSize: 13,
    lineHeight: 17,
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
    fontSize: 14,
    fontWeight: '800',
    color: BG,
    letterSpacing: 1.6,
  },
  invalidCard: {
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  invalidTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    color: WHITE,
  },
  invalidText: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    textAlign: 'center',
  },
  secondaryBtn: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CYAN,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: CYAN,
    letterSpacing: 1,
  },
});
