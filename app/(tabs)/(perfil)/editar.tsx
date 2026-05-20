import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import {
  fechaProximoCambioUsername,
  normalizarNombrePerfil,
  normalizarUsername,
  perfilService,
  puedeCambiarUsername,
  validarNombrePerfil,
  validarUsername,
} from '@/services/perfil.service';
import type { Profile } from '@/types/database.types';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'cooldown';

function formatoFecha(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function parseEntero(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function EditarPerfil() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [altura, setAltura] = useState('');
  const [edad, setEdad] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [confirmUsernameChange, setConfirmUsernameChange] = useState(false);

  const currentUsername = profile?.username ?? '';
  const normalizedUsername = normalizarUsername(username);
  const usernameChanged = normalizedUsername !== currentUsername;
  const nextUsernameChange = fechaProximoCambioUsername(profile?.username_last_changed_at);
  const usernameCooldown = usernameChanged && !puedeCambiarUsername(profile?.username_last_changed_at);

  const nombreError =
    nombre.trim().length === 0
      ? 'El nombre es obligatorio.'
      : !validarNombrePerfil(nombre.trim())
        ? 'Solo letras y numeros, sin espacios ni emojis.'
        : null;
  const usernameError =
    normalizedUsername.length === 0
      ? 'El @ es obligatorio.'
      : !validarUsername(normalizedUsername)
        ? 'Usa 3-20 letras o numeros, sin simbolos.'
        : usernameCooldown
          ? `Podras cambiarlo el ${nextUsernameChange ? formatoFecha(nextUsernameChange) : 'proximo dia disponible'}.`
          : usernameStatus === 'taken'
            ? 'Ese @ ya esta en uso.'
            : null;

  const alturaNum = parseEntero(altura);
  const edadNum = parseEntero(edad);
  const alturaError = alturaNum == null || alturaNum < 80 || alturaNum > 250
    ? 'Altura entre 80 y 250 cm.'
    : null;
  const edadError = edadNum == null || edadNum < 10 || edadNum > 100
    ? 'Edad entre 10 y 100 anos.'
    : null;

  const canSave =
    !loading &&
    !saving &&
    !nombreError &&
    !usernameError &&
    !alturaError &&
    !edadError &&
    usernameStatus !== 'checking';

  const cargarPerfil = useCallback(async () => {
    if (!user?.id) {
      setError('No hay una sesion activa.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await perfilService.obtenerPerfil(user.id);
      if (!next) throw new Error('No se encontro el perfil.');
      setProfile(next);
      setNombre(next.nombre ?? '');
      setUsername(next.username ?? '');
      setAltura(next.altura_cm != null ? String(Math.round(Number(next.altura_cm))) : '');
      setEdad(next.edad != null ? String(Math.round(Number(next.edad))) : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el perfil.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void cargarPerfil();
  }, [cargarPerfil]);

  useEffect(() => {
    if (!user?.id || !profile) return;
    if (!usernameChanged) {
      setUsernameStatus('idle');
      return;
    }
    if (usernameCooldown) {
      setUsernameStatus('cooldown');
      return;
    }
    if (!validarUsername(normalizedUsername)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const available = await perfilService.usernameDisponible(normalizedUsername, user.id);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('taken');
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [normalizedUsername, profile, user?.id, usernameChanged, usernameCooldown]);

  const guardarConfirmado = async () => {
    if (!canSave || alturaNum == null || edadNum == null) return;

    setSaving(true);
    setError(null);
    try {
      await perfilService.actualizarIdentidad({
        nombre: nombre.trim(),
        username: normalizedUsername,
        altura_cm: alturaNum,
        edad: edadNum,
      });
      router.replace({
        pathname: '/(tabs)/(perfil)',
        params: { profileRefresh: String(Date.now()) },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil.');
      setSaving(false);
      setConfirmUsernameChange(false);
      return;
    } finally {
      setConfirmUsernameChange(false);
    }
  };

  const guardar = async () => {
    if (!canSave) return;
    if (usernameChanged) {
      setConfirmUsernameChange(true);
      return;
    }
    await guardarConfirmado();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: 'Editar perfil' }} />

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: s.md, paddingBottom: insets.bottom + 32 },
          ]}
        >
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Datos de perfil</Text>
            <Text style={styles.subtitle}>
              Tu peso se actualiza desde Progreso para mantener el historial limpio.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={17} color={c.danger} />
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <FieldLabel label="Nombre" styles={styles} />
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={(value) => setNombre(normalizarNombrePerfil(value))}
              placeholder="Tu nombre"
              placeholderTextColor={c.textMuted}
              autoCapitalize="words"
              maxLength={80}
              returnKeyType="next"
            />
            <FieldError message={nombreError} styles={styles} />

            <FieldLabel label="@" styles={styles} />
            <View style={styles.usernameInputRow}>
              <Text style={styles.usernamePrefix}>@</Text>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={(value) => setUsername(normalizarUsername(value))}
                placeholder="usuario123"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="next"
              />
              {usernameStatus === 'checking' ? (
                <ActivityIndicator color={c.primary} size="small" />
              ) : usernameChanged && usernameStatus === 'available' ? (
                <Ionicons name="checkmark-circle" size={18} color={c.success} />
              ) : null}
            </View>
            <FieldError message={usernameError} styles={styles} />
            {!usernameChanged && profile?.username_last_changed_at ? (
              <Text style={styles.hintText}>
                Si cambias tu @, no podras volver a cambiarlo durante 15 dias.
              </Text>
            ) : null}

            <View style={styles.twoColumns}>
              <View style={styles.column}>
                <FieldLabel label="Altura" styles={styles} />
                <View style={styles.unitInputRow}>
                  <TextInput
                    style={styles.unitInput}
                    value={altura}
                    onChangeText={(value) => setAltura(value.replace(/[^0-9]/g, ''))}
                    placeholder="175"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.unitText}>cm</Text>
                </View>
                <FieldError message={alturaError} styles={styles} />
              </View>

              <View style={styles.column}>
                <FieldLabel label="Edad" styles={styles} />
                <View style={styles.unitInputRow}>
                  <TextInput
                    style={styles.unitInput}
                    value={edad}
                    onChangeText={(value) => setEdad(value.replace(/[^0-9]/g, ''))}
                    placeholder="22"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.unitText}>anos</Text>
                </View>
                <FieldError message={edadError} styles={styles} />
              </View>
            </View>
          </View>

          <Pressable
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={guardar}
            disabled={!canSave}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={c.textOnPrimary} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={17} color={c.textOnPrimary} />
                <Text style={styles.saveButtonText}>Guardar cambios</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}

      <Modal
        visible={confirmUsernameChange}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setConfirmUsernameChange(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalAccent} />
            <Text style={styles.modalTitle}>Confirmar cambio de @</Text>
            <Text style={styles.modalText}>
              Si guardas este @, no podras volver a cambiarlo durante 15 dias.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalGhost}
                onPress={() => setConfirmUsernameChange(false)}
                disabled={saving}
              >
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimary, saving && styles.saveButtonDisabled]}
                onPress={guardarConfirmado}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={c.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Continuar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ label, styles }: { label: string; styles: ReturnType<typeof makeStyles> }) {
  return <Text style={styles.label}>{label}</Text>;
}

function FieldError({ message, styles }: { message: string | null; styles: ReturnType<typeof makeStyles> }) {
  return message ? <Text style={styles.fieldError}>{message}</Text> : <View style={styles.fieldSpacer} />;
}

function makeStyles(
  c: ReturnType<typeof useTheme>['c'],
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingHorizontal: s.md,
      gap: s.md,
    },
    headerBlock: {
      gap: s.xs,
    },
    title: {
      ...ts.heading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    subtitle: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    errorBox: {
      minHeight: 46,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.danger,
      backgroundColor: c.dangerBg,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    errorBoxText: {
      ...ts.bodySm,
      flex: 1,
      fontFamily: f.sansMedium,
      color: c.dangerText,
    },
    card: {
      borderRadius: r.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
      padding: s.md,
    },
    label: {
      ...ts.label,
      fontFamily: f.monoBold,
      color: c.textSecondary,
      textTransform: 'uppercase',
      marginBottom: s.xs,
    },
    input: {
      minHeight: 50,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: s.md,
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    usernameInputRow: {
      minHeight: 50,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: s.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
    },
    usernamePrefix: {
      ...ts.body,
      fontFamily: f.monoBold,
      color: c.primary,
    },
    usernameInput: {
      flex: 1,
      ...ts.body,
      fontFamily: f.monoBold,
      color: c.textDisplay,
      paddingVertical: 0,
    },
    twoColumns: {
      flexDirection: 'row',
      gap: s.sm,
    },
    column: {
      flex: 1,
      minWidth: 0,
    },
    unitInputRow: {
      minHeight: 50,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: s.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
    },
    unitInput: {
      flex: 1,
      ...ts.body,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      paddingVertical: 0,
    },
    unitText: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    fieldError: {
      minHeight: 28,
      paddingTop: s.xs,
      ...ts.caption,
      fontFamily: f.sans,
      color: c.dangerText,
    },
    fieldSpacer: { height: 28 },
    hintText: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textMuted,
      marginTop: -s.sm,
      marginBottom: s.md,
    },
    saveButton: {
      minHeight: 52,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
    },
    saveButtonDisabled: {
      opacity: 0.45,
    },
    saveButtonText: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textOnPrimary,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.68)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: s.lg,
    },
    modalCard: {
      width: '100%',
      borderRadius: r.md,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      paddingTop: s.lg,
      paddingBottom: s.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      overflow: 'hidden',
    },
    modalAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: c.primary,
    },
    modalTitle: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      marginBottom: s.sm,
    },
    modalText: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginBottom: s.md,
      lineHeight: 25,
    },
    modalActions: { flexDirection: 'row', gap: s.sm },
    modalGhost: {
      flex: 1,
      height: 44,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    modalGhostText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
    modalPrimary: {
      flex: 1,
      height: 44,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    modalPrimaryText: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textOnPrimary,
    },
  });
}
