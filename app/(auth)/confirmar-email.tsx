import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function ConfirmarEmail() {
  const { c, f, ts, s, r } = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();

  const styles = makeStyles(c, f, ts, s, r);

  return (
    <View style={styles.root}>

      {/* ── LAYER 1: Hero ─────────────────────────────────── */}
      <View style={styles.hero}>
        <Text style={styles.title}>CHECK YOUR{'\n'}EMAIL</Text>
        <Text style={styles.subtitle}>
          HEMOS ENVIADO UN ENLACE DE CONFIRMACIÓN A
        </Text>
        <Text style={styles.emailText}>{email}</Text>
      </View>

      {/* ── LAYER 2: Instrucciones ────────────────────────── */}
      <View style={styles.body}>
        <Text style={styles.instruction}>
          Abre el enlace del email para activar tu cuenta y luego vuelve aquí para iniciar sesión.
        </Text>
      </View>

      {/* ── LAYER 3: Acción ───────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.replace('/(auth)/iniciar-sesion')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>IR AL LOGIN</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          ¿No recibiste el email? Revisa tu carpeta de spam.
        </Text>
      </View>

    </View>
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
      paddingHorizontal: s.lg,
      justifyContent: 'space-between',
      paddingBottom: s['3xl'],
    },

    hero: {
      marginTop: s['4xl'],
    },

    title: {
      ...ts.displayMd,
      fontFamily: f.display,
      color: c.textDisplay,
      marginBottom: s.xl,
    },

    subtitle: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: ts.label.letterSpacing,
      marginBottom: s.xs,
    },

    emailText: {
      ...ts.body,
      fontFamily: f.mono,
      color: c.primary,
    },

    body: {
      flex: 1,
      justifyContent: 'center',
    },

    instruction: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
      lineHeight: 22,
    },

    footer: {
      gap: s.md,
    },

    btnPrimary: {
      height: 52,
      borderRadius: r.pill,
      backgroundColor: c.textDisplay,
      alignItems: 'center',
      justifyContent: 'center',
    },

    btnPrimaryText: {
      fontFamily: f.mono,
      color: c.background,
      fontSize: 13,
      letterSpacing: 1.2,
    },

    hint: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
      textAlign: 'center',
      letterSpacing: 0.4,
    },
  });
}
