import { useState } from 'react';
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
import { authService } from '@/services/auth.service';

export default function RecuperarContrasena() {
  const { c, f, ts, s, r } = useTheme();

  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnviarEnlace = async () => {
    const emailNormalizado = email.trim().toLowerCase();

    if (!emailNormalizado) {
      setError('[ERROR: INTRODUCE TU EMAIL]');
      return;
    }

    setCargando(true);
    setError(null);

    const { error: resetError } = await authService.recuperarContrasena(emailNormalizado);

    setCargando(false);

    if (resetError) {
      setError('[ERROR: ' + resetError.message.toUpperCase() + ']');
      return;
    }

    setEnviado(true);
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
        <View style={styles.header}>
          <Text style={styles.title}>FORGOT{'\n'}PASSWORD</Text>
          <Text style={styles.description}>
            Te enviaremos un enlace para restablecer tu contraseña.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="done"
              onSubmitEditing={handleEnviarEnlace}
              placeholderTextColor={c.textMuted}
              placeholder="tu@email.com"
              selectionColor={c.primary}
              editable={!enviado}
            />
            <View style={[styles.underline, email.length > 0 && styles.underlineFilled]} />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {enviado ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>[EMAIL ENVIADO]</Text>
              <Text style={styles.successDescription}>
                Revisa tu bandeja de entrada y sigue el enlace para cambiar la contraseña.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, cargando && styles.btnDisabled]}
              onPress={handleEnviarEnlace}
              disabled={cargando}
              activeOpacity={0.85}
            >
              {cargando ? (
                <ActivityIndicator color={c.background} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>ENVIAR ENLACE</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/iniciar-sesion')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.footerLink}>VOLVER A INICIAR SESION</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
    header: {
      marginTop: s.xxl,
      marginBottom: s.xxl,
    },
    title: {
      ...ts.displayMd,
      fontFamily: f.display,
      color: c.textDisplay,
    },
    description: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginTop: s.md,
      maxWidth: 320,
    },
    form: {
      gap: s.lg,
    },
    fieldWrapper: {
      gap: s.xs,
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
    underlineFilled: {
      backgroundColor: c.text,
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
      ...ts.label,
      fontFamily: f.mono,
      color: c.background,
      letterSpacing: 1.2,
      fontSize: 13,
    },
    errorText: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.danger,
      letterSpacing: 0.4,
    },
    successBox: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      padding: s.md,
      gap: s.sm,
      backgroundColor: c.surface,
    },
    successText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.success,
      letterSpacing: 0.8,
    },
    successDescription: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    footer: {
      marginTop: s['3xl'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerLink: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: ts.label.letterSpacing,
    },
  });
}
