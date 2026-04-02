/**
 * SocialAuthButtons
 *
 * Botones de login social reutilizables para login y registro.
 * Estilo Nothing: monoline, pill, Space Mono ALL CAPS, sin relleno.
 *
 * Google → activo cuando GOOGLE_WEB_CLIENT_ID esté configurado.
 * Apple  → visible solo en iOS; deshabilitado hasta tener Apple Developer account.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import {
  loginConGoogle,
  loginConApple,
  appleDisponible,
  type SocialAuthResult,
} from '@/services/social-auth.service';
import { GOOGLE_WEB_CLIENT_ID } from '@/constants/config';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SocialAuthButtonsProps {
  /** Callback cuando el auth social tiene éxito o error */
  onResult: (result: SocialAuthResult & { provider: 'google' | 'apple' }) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SocialAuthButtons({ onResult }: SocialAuthButtonsProps) {
  const { c, f, ts, s, r } = useTheme();

  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [cargandoApple, setCargandoApple]   = useState(false);
  const [appleOk, setAppleOk]               = useState(false);

  const googleConfigurado =
    !!GOOGLE_WEB_CLIENT_ID && !GOOGLE_WEB_CLIENT_ID.startsWith('REEMPLAZAR');

  useEffect(() => {
    appleDisponible().then(setAppleOk);
  }, []);

  const handleGoogle = async () => {
    setCargandoGoogle(true);
    const result = await loginConGoogle();
    setCargandoGoogle(false);
    onResult({ ...result, provider: 'google' });
  };

  const handleApple = async () => {
    setCargandoApple(true);
    const result = await loginConApple();
    setCargandoApple(false);
    onResult({ ...result, provider: 'apple' });
  };

  const styles = makeStyles(c, f, ts, s, r);

  return (
    <View style={styles.wrapper}>

      {/* Separador Nothing: ─── OR ─── */}
      <View style={styles.separator}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>OR</Text>
        <View style={styles.separatorLine} />
      </View>

      {/* Google */}
      <TouchableOpacity
        style={[
          styles.btn,
          (!googleConfigurado || cargandoGoogle) && styles.btnDisabled,
        ]}
        onPress={handleGoogle}
        disabled={!googleConfigurado || cargandoGoogle}
        activeOpacity={0.75}
      >
        {cargandoGoogle ? (
          <ActivityIndicator size="small" color={c.textSecondary} />
        ) : (
          <>
            <MaterialCommunityIcons
              name="google"
              size={16}
              color={googleConfigurado ? c.text : c.textMuted}
              style={styles.icon}
            />
            <Text style={[styles.btnText, !googleConfigurado && styles.btnTextMuted]}>
              CONTINUE WITH GOOGLE
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Apple — solo iOS */}
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.btn, (!appleOk || cargandoApple) && styles.btnDisabled]}
          onPress={handleApple}
          disabled={!appleOk || cargandoApple}
          activeOpacity={0.75}
        >
          {cargandoApple ? (
            <ActivityIndicator size="small" color={c.textSecondary} />
          ) : (
            <>
              <MaterialCommunityIcons
                name="apple"
                size={16}
                color={appleOk ? c.text : c.textMuted}
                style={styles.icon}
              />
              <Text style={[styles.btnText, !appleOk && styles.btnTextMuted]}>
                CONTINUE WITH APPLE
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

    </View>
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
    wrapper: {
      gap: s.sm,
    },

    // ── Separador
    separator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      marginBottom: s.xs,
    },

    separatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: c.border,
    },

    separatorText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: ts.label.letterSpacing,
    },

    // ── Botón social — secundario Nothing
    btn: {
      height: 52,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
    },

    btnDisabled: {
      opacity: 0.35,
    },

    icon: {
      // alineado visualmente con el texto
    },

    btnText: {
      fontFamily: f.mono,
      fontSize: 13,
      color: c.text,
      letterSpacing: 1.0,
    },

    btnTextMuted: {
      color: c.textMuted,
    },
  });
}
