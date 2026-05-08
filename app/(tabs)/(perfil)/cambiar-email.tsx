import { Ionicons } from '@expo/vector-icons';
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

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_REDIRECT_TO = 'proyectoactiva://cambiar-email';

type AuthLikeError = {
  message?: string;
  code?: string;
  status?: number;
};

function normalizarEmail(value: string): string {
  return value.trim().toLowerCase();
}

function mensajeErrorSupabase(error: AuthLikeError): string {
  const message = error.message ?? '';
  const lower = message.toLowerCase();
  const code = error.code?.toLowerCase() ?? '';

  if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
    return 'Ese email ya está asociado a otra cuenta.';
  }
  if (lower.includes('rate') || lower.includes('too many') || error.status === 429) {
    return 'No se pudo enviar la confirmación. Inténtalo más tarde.';
  }
  if (lower.includes('session') || code.includes('session')) {
    return 'Tu sesión ha caducado. Vuelve a iniciar sesión para cambiar el email.';
  }
  return message || 'No se pudo solicitar el cambio de email.';
}

export default function CambiarEmailScreen() {
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: c.background,
        },
        content: {
          paddingHorizontal: s.md,
          paddingTop: s.md,
          paddingBottom: insets.bottom + s.xxl,
          gap: s.md,
        },
        introCard: {
          borderRadius: r.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.borderVisible,
          backgroundColor: c.surface,
          padding: s.md,
          gap: s.sm,
        },
        introIcon: {
          width: 38,
          height: 38,
          borderRadius: r.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.primaryBg,
        },
        title: {
          ...ts.subheading,
          fontFamily: f.sansBold,
          color: c.textDisplay,
          letterSpacing: 0,
        },
        body: {
          ...ts.bodySm,
          fontFamily: f.sans,
          color: c.textSecondary,
          letterSpacing: 0,
        },
        formCard: {
          borderRadius: r.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          backgroundColor: c.surface,
          padding: s.md,
          gap: s.md,
        },
        field: {
          gap: s.xs,
        },
        label: {
          fontSize: 11,
          lineHeight: 14,
          fontFamily: f.monoBold,
          color: c.textSecondary,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        },
        readonlyBox: {
          minHeight: 48,
          borderRadius: r.sm,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surfaceElevated,
          paddingHorizontal: s.md,
          justifyContent: 'center',
        },
        readonlyText: {
          ...ts.bodySm,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          letterSpacing: 0,
        },
        input: {
          minHeight: 48,
          borderRadius: r.sm,
          borderWidth: 1,
          borderColor: c.borderVisible,
          backgroundColor: c.background,
          paddingHorizontal: s.md,
          ...ts.bodySm,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          letterSpacing: 0,
        },
        inputError: {
          borderColor: c.danger,
        },
        hint: {
          fontSize: 12,
          lineHeight: 16,
          fontFamily: f.sans,
          color: c.textMuted,
        },
        errorText: {
          fontSize: 12,
          lineHeight: 16,
          fontFamily: f.sansMedium,
          color: c.danger,
        },
        successCard: {
          borderRadius: r.md,
          borderWidth: 1,
          borderColor: c.success,
          backgroundColor: c.successBg,
          padding: s.md,
          gap: s.xs,
        },
        successTitle: {
          ...ts.bodySm,
          fontFamily: f.sansBold,
          color: c.successText,
          letterSpacing: 0,
        },
        successText: {
          fontSize: 12,
          lineHeight: 17,
          fontFamily: f.sans,
          color: c.successText,
        },
        submit: {
          minHeight: 52,
          borderRadius: r.sm,
          backgroundColor: c.primary,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: s.sm,
        },
        submitDisabled: {
          opacity: 0.45,
        },
        submitText: {
          ...ts.bodySm,
          fontFamily: f.sansBold,
          color: c.textOnPrimary,
          letterSpacing: 0,
        },
        footerNote: {
          ...ts.bodySm,
          fontFamily: f.sans,
          color: c.textSecondary,
          letterSpacing: 0,
          textAlign: 'center',
          paddingHorizontal: s.sm,
        },
      }),
    [c, f, insets.bottom, r, s, ts],
  );

  const currentEmail = normalizarEmail(user?.email ?? '');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [touched, setTouched] = useState({ nuevo: false, confirm: false });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const nuevoNormalizado = normalizarEmail(nuevoEmail);
  const confirmNormalizado = normalizarEmail(confirmEmail);

  const nuevoEmailError = useMemo(() => {
    if (!nuevoNormalizado) return 'Introduce el nuevo email.';
    if (!EMAIL_RE.test(nuevoNormalizado)) return 'Introduce un email válido.';
    if (currentEmail && nuevoNormalizado === currentEmail) return 'El nuevo email debe ser distinto al actual.';
    return '';
  }, [currentEmail, nuevoNormalizado]);

  const confirmEmailError = useMemo(() => {
    if (!confirmNormalizado) return 'Repite el nuevo email.';
    if (nuevoNormalizado !== confirmNormalizado) return 'Los emails no coinciden.';
    return '';
  }, [confirmNormalizado, nuevoNormalizado]);

  const canSubmit = !enviando && !nuevoEmailError && !confirmEmailError && Boolean(currentEmail);

  const onSubmit = async () => {
    setTouched({ nuevo: true, confirm: true });
    setError('');
    setSentTo('');
    if (!canSubmit) return;

    setEnviando(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser(
        { email: nuevoNormalizado },
        { emailRedirectTo: EMAIL_REDIRECT_TO },
      );

      if (updateError) {
        setError(mensajeErrorSupabase(updateError));
        return;
      }

      setSentTo(nuevoNormalizado);
    } catch (caught) {
      setError(mensajeErrorSupabase(caught as AuthLikeError));
    } finally {
      setEnviando(false);
    }
  };

  const updateNuevoEmail = (value: string) => {
    setNuevoEmail(value);
    setError('');
    setSentTo('');
  };

  const updateConfirmEmail = (value: string) => {
    setConfirmEmail(value);
    setError('');
    setSentTo('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="mail-outline" size={20} color={c.primary} />
          </View>
          <Text style={styles.title}>Cambiar email</Text>
          <Text style={styles.body}>
            Te enviaremos un email para confirmar el cambio. Hasta entonces seguirás usando tu email actual.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Email actual</Text>
            <View style={styles.readonlyBox}>
              <Text style={styles.readonlyText} numberOfLines={1}>
                {currentEmail || 'Sesión no disponible'}
              </Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nuevo email</Text>
            <TextInput
              value={nuevoEmail}
              onChangeText={updateNuevoEmail}
              onBlur={() => setTouched((prev) => ({ ...prev, nuevo: true }))}
              style={[styles.input, touched.nuevo && nuevoEmailError ? styles.inputError : null]}
              placeholder="tu@email.com"
              placeholderTextColor={c.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              inputMode="email"
              returnKeyType="next"
            />
            {touched.nuevo && nuevoEmailError ? <Text style={styles.errorText}>{nuevoEmailError}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Repetir nuevo email</Text>
            <TextInput
              value={confirmEmail}
              onChangeText={updateConfirmEmail}
              onBlur={() => setTouched((prev) => ({ ...prev, confirm: true }))}
              style={[styles.input, touched.confirm && confirmEmailError ? styles.inputError : null]}
              placeholder="tu@email.com"
              placeholderTextColor={c.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              inputMode="email"
              returnKeyType="done"
              onSubmitEditing={() => void onSubmit()}
            />
            {touched.confirm && confirmEmailError ? <Text style={styles.errorText}>{confirmEmailError}</Text> : null}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {sentTo ? (
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>Revisa tu correo</Text>
              <Text style={styles.successText}>
                Hemos enviado la confirmación a {sentTo}. Si tienes el cambio seguro activo, también tendrás que confirmarlo desde tu email actual.
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
            onPress={() => void onSubmit()}
            disabled={!canSubmit}
            accessibilityRole="button"
          >
            {enviando ? <ActivityIndicator size="small" color={c.textOnPrimary} /> : null}
            <Text style={styles.submitText}>{enviando ? 'Enviando...' : 'Enviar confirmación'}</Text>
          </Pressable>
        </View>

        <Text style={styles.footerNote}>
          Si no recibes el email, revisa spam o espera unos minutos antes de volver a intentarlo.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
