import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { authService } from '@/services/auth.service';

type AuthLikeError = {
  message?: string;
  status?: number;
};

function normalizarEmail(value: string): string {
  return value.trim().toLowerCase();
}

function mensajeErrorRecovery(error: AuthLikeError): string {
  const message = error.message ?? '';
  const lower = message.toLowerCase();
  if (lower.includes('rate') || lower.includes('too many') || error.status === 429) {
    return 'No se pudo enviar el enlace. Inténtalo más tarde.';
  }
  if (lower.includes('session')) {
    return 'Tu sesión ha caducado. Vuelve a iniciar sesión para cambiar la contraseña.';
  }
  return message || 'No se pudo enviar el enlace de restablecimiento.';
}

export default function CambiarContrasenaScreen() {
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const insets = useSafeAreaInsets();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const email = normalizarEmail(user?.email ?? '');
  const canSubmit = Boolean(email) && !enviando;

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

  const enviarEnlace = async () => {
    if (!canSubmit) return;

    setEnviando(true);
    setError('');
    setEnviado(false);

    try {
      const { error: resetError } = await authService.recuperarContrasena(email);
      if (resetError) {
        setError(mensajeErrorRecovery(resetError));
        return;
      }
      setEnviado(true);
    } catch (caught) {
      setError(mensajeErrorRecovery(caught as AuthLikeError));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="lock-closed-outline" size={20} color={c.primary} />
          </View>
          <Text style={styles.title}>Cambiar contraseña</Text>
          <Text style={styles.body}>
            Te enviaremos un enlace seguro para crear una nueva contraseña. Tu contraseña actual seguirá activa hasta completar el cambio.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Email de la cuenta</Text>
            <View style={styles.readonlyBox}>
              <Text style={styles.readonlyText} numberOfLines={1}>
                {email || 'Sesión no disponible'}
              </Text>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {enviado ? (
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>Revisa tu correo</Text>
              <Text style={styles.successText}>
                Te hemos enviado un enlace para restablecer la contraseña. Al abrirlo podrás guardar la nueva clave.
              </Text>
            </View>
          ) : null}

          <Pressable style={[styles.submit, !canSubmit && styles.submitDisabled]} onPress={() => void enviarEnlace()} disabled={!canSubmit} accessibilityRole="button">
            {enviando ? <ActivityIndicator size="small" color={c.textOnPrimary} /> : null}
            <Text style={styles.submitText}>{enviando ? 'Enviando...' : 'Enviar enlace'}</Text>
          </Pressable>
        </View>

        <Text style={styles.footerNote}>
          Si no recibes el email, revisa spam o espera unos minutos antes de volver a intentarlo.
        </Text>
      </ScrollView>
    </View>
  );
}
