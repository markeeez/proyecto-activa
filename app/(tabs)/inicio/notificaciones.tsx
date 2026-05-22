import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  notificacionesService,
  SMART_NOTIFICATION_DEFAULTS,
  type NotificationHistoryItem,
  type PermissionState,
  type PushRegistrationStatus,
  type ReminderDraft,
} from '@/services/notificaciones.service';
import type {
  NotificationReminder,
  NotificationReminderRepeatType,
  SmartNotificationType,
} from '@/types/database.types';

const WEEKDAYS = [
  { value: 2, label: 'L' },
  { value: 3, label: 'M' },
  { value: 4, label: 'X' },
  { value: 5, label: 'J' },
  { value: 6, label: 'V' },
  { value: 7, label: 'S' },
  { value: 1, label: 'D' },
];

const SUGGESTIONS: ReminderDraft[] = [
  { title: 'Creatina', body: '5 g y listo. Pequeno habito, gran constancia.', hour: 9, minute: 0, repeat_type: 'daily', weekdays: [], enabled: true },
  { title: 'Registrar comida', body: 'Un apunte rapido mantiene el dia bajo control.', hour: 14, minute: 30, repeat_type: 'daily', weekdays: [], enabled: true },
  { title: 'Entrenar', body: 'Algo corto tambien cuenta. Vamos.', hour: 18, minute: 30, repeat_type: 'weekdays', weekdays: [2, 4, 6], enabled: true },
  { title: 'Registrar peso', body: 'Un dato pequeno, una tendencia mas clara.', hour: 9, minute: 30, repeat_type: 'weekdays', weekdays: [1], enabled: true },
];

const TITLE_LIMIT = 30;
const BODY_LIMIT = 100;

function fmtHora(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function fmtHoraInput(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseHora(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

function soloDigitosHora(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function repeatLabel(reminder: Pick<NotificationReminder, 'repeat_type' | 'weekdays'>): string {
  if (reminder.repeat_type === 'once') return 'Una vez';
  if (reminder.repeat_type === 'daily') return 'Diario';
  const labels = WEEKDAYS.filter((day) => reminder.weekdays.includes(day.value)).map((day) => day.label);
  return labels.length > 0 ? labels.join(' ') : 'Dias concretos';
}

function smartTitle(type: SmartNotificationType): string {
  return SMART_NOTIFICATION_DEFAULTS[type]?.title ?? type;
}

function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString('es-ES');
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} ${hora}`;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export default function NotificacionesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [pushStatus, setPushStatus] = useState<PushRegistrationStatus | null>(null);
  const [reminders, setReminders] = useState<NotificationReminder[]>([]);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<NotificationReminder | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [time, setTime] = useState('09:00');
  const [repeatType, setRepeatType] = useState<NotificationReminderRepeatType>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([2, 3, 4, 5, 6]);
  const [enabled, setEnabled] = useState(true);
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    destructive?: boolean;
    onConfirm?: () => void;
    cancelText?: string;
  } | null>(null);

  const unreadCount = history.filter((event) => event.read_at == null).length;

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setShowSkeleton(false);
    const skeletonTimer = setTimeout(() => setShowSkeleton(true), 250);
    try {
      const permisos = await notificacionesService.obtenerPermisos();
      const [recordatorios, historial, registroPush] = await Promise.all([
        notificacionesService.listarRecordatorios(user.id),
        notificacionesService.listarHistorialUnificado(user.id),
        permisos.granted
          ? notificacionesService.registrarDispositivo(user.id)
          : notificacionesService.obtenerEstadoRegistroPush(user.id),
      ]);
      setPermission(permisos);
      setPushStatus(registroPush);
      setReminders(recordatorios);
      setHistory(historial);
    } catch (error) {
      const msg = errorMessage(error, 'No se pudieron cargar las notificaciones.');
      setNotice({ title: 'No se pudo cargar', message: msg });
    } finally {
      clearTimeout(skeletonTimer);
      setLoading(false);
      setShowSkeleton(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const abrirNuevo = (draft?: ReminderDraft) => {
    setEditing(null);
    setTitle(draft?.title ?? '');
    setBody(draft?.body ?? '');
    setTime(fmtHoraInput(draft?.hour ?? 9, draft?.minute ?? 0));
    setRepeatType(draft?.repeat_type ?? 'daily');
    setWeekdays(draft?.weekdays.length ? draft.weekdays : [2, 3, 4, 5, 6]);
    setEnabled(draft?.enabled ?? true);
    setModalVisible(true);
  };

  const abrirEditar = (reminder: NotificationReminder) => {
    setEditing(reminder);
    setTitle(reminder.title);
    setBody(reminder.body ?? '');
    setTime(fmtHoraInput(reminder.hour, reminder.minute));
    setRepeatType(reminder.repeat_type);
    setWeekdays(reminder.weekdays.length ? reminder.weekdays : [2, 3, 4, 5, 6]);
    setEnabled(reminder.enabled);
    setModalVisible(true);
  };

  const guardar = async () => {
    if (!user?.id || saving) return;
    const parsed = parseHora(time);
    if (!title.trim() || !parsed) {
      setNotice({ title: 'Revisa el recordatorio', message: 'Necesita asunto y una hora valida, por ejemplo 09:00 o 18:30.' });
      return;
    }
    if (repeatType === 'weekdays' && weekdays.length === 0) {
      setNotice({ title: 'Elige dias', message: 'Selecciona al menos un dia de la semana.' });
      return;
    }

    setSaving(true);
    try {
      const draft: ReminderDraft = {
        title,
        body,
        hour: parsed.hour,
        minute: parsed.minute,
        repeat_type: repeatType,
        weekdays,
        enabled,
      };
      if (editing) {
        await notificacionesService.actualizarRecordatorio(editing, draft);
      } else {
        await notificacionesService.crearRecordatorio(user.id, draft);
      }
      setModalVisible(false);
      await cargar();
    } catch (error) {
      const msg = errorMessage(error, 'No se pudo guardar el recordatorio.');
      setNotice({ title: 'No se pudo guardar', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const borrar = (reminder: NotificationReminder) => {
    setNotice({
      title: 'Borrar recordatorio',
      message: `Se eliminara "${reminder.title}".`,
      confirmText: 'Borrar',
      destructive: true,
      cancelText: 'Cancelar',
      onConfirm: () => {
        void (async () => {
          try {
            await notificacionesService.borrarRecordatorio(reminder);
            await cargar();
          } catch (error) {
            const msg = errorMessage(error, 'No se pudo borrar.');
            setNotice({ title: 'No se pudo borrar', message: msg });
          }
        })();
      },
    });
  };

  const toggleReminder = async (reminder: NotificationReminder, next: boolean) => {
    try {
      await notificacionesService.actualizarRecordatorio(reminder, {
        title: reminder.title,
        body: reminder.body,
        hour: reminder.hour,
        minute: reminder.minute,
        repeat_type: reminder.repeat_type,
        weekdays: reminder.weekdays,
        enabled: next,
      });
      await cargar();
    } catch (error) {
      const msg = errorMessage(error, 'No se pudo cambiar el recordatorio.');
      setNotice({ title: 'No se pudo cambiar', message: msg });
    }
  };

  const markEvent = async (event: NotificationHistoryItem) => {
    if (event.read_at) return;
    setHistory((prev) => prev.map((item) => (item.id === event.id ? { ...item, read_at: new Date().toISOString() } : item)));
    await notificacionesService.marcarHistorialLeido(event).catch(() => undefined);
  };

  const retryPushRegistration = async () => {
    if (!user?.id) return;
    const status = await notificacionesService.registrarDispositivo(user.id);
    setPushStatus(status);
  };

  const permissionPanelState = (() => {
    if (!permission?.granted) {
      return {
        icon: 'notifications-off-outline' as const,
        title: 'Permisos pendientes',
        text: 'Puedes crear recordatorios; si el sistema bloquea el permiso, se guardaran desactivados.',
        action: !permission?.canAskAgain ? 'Ajustes' : null,
        onAction: () => void Linking.openSettings(),
      };
    }
    if (!pushStatus?.registered) {
      return {
        icon: 'alert-circle-outline' as const,
        title: 'Push pendiente',
        text: pushStatus?.error ?? 'Los recordatorios locales funcionan, pero aun no se ha registrado este dispositivo para avisos automaticos.',
        action: 'Reintentar',
        onAction: () => void retryPushRegistration(),
      };
    }
    return {
      icon: 'notifications' as const,
      title: 'Avisos activos',
      text: 'Recordatorios locales y notificaciones automaticas estan activos en este dispositivo.',
      action: null,
      onAction: undefined,
    };
  })();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={22} color={c.textDisplay} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Notificaciones</Text>
          <Text style={styles.subtitle}>{unreadCount > 0 ? `${unreadCount} notificacion${unreadCount === 1 ? '' : 'es'} sin leer` : 'Recordatorios y notificaciones'}</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={() => abrirNuevo()} accessibilityLabel="Anadir recordatorio">
          <Ionicons name="add" size={22} color={c.textDisplay} />
        </Pressable>
      </View>

      {loading ? (
        showSkeleton ? <NotificationsSkeleton styles={styles} bottomInset={insets.bottom} /> : <View style={styles.center} />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 96 }]}
        >
          <View style={styles.permissionPanel}>
            <View style={styles.permissionIcon}>
              <Ionicons name={permissionPanelState.icon} size={20} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>{permissionPanelState.title}</Text>
              <Text style={styles.panelText}>{permissionPanelState.text}</Text>
            </View>
            {permissionPanelState.action ? (
              <Pressable style={styles.smallButton} onPress={permissionPanelState.onAction}>
                <Text style={styles.smallButtonText}>{permissionPanelState.action}</Text>
              </Pressable>
            ) : null}
          </View>

          <SectionHeader title="Recordatorios" action="Nuevo" onPress={() => abrirNuevo()} styles={styles} />
          {reminders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Sin recordatorios aun</Text>
              <Text style={styles.emptyText}>Crea uno para creatina, comidas, entrenos o cualquier habito que quieras mantener.</Text>
            </View>
          ) : (
            reminders.map((reminder) => (
              <Pressable key={reminder.id} style={styles.reminderRow} onPress={() => abrirEditar(reminder)}>
                <View style={styles.reminderTime}>
                  <Text style={styles.timeText}>{fmtHora(reminder.hour, reminder.minute)}</Text>
                  <Text style={styles.repeatText}>{repeatLabel(reminder)}</Text>
                </View>
                <View style={styles.reminderBody}>
                  <Text style={styles.rowTitle}>{reminder.title}</Text>
                  {reminder.body ? <Text style={styles.rowText}>{reminder.body}</Text> : null}
                </View>
                <Switch
                  value={reminder.enabled}
                  onValueChange={(next) => void toggleReminder(reminder, next)}
                  trackColor={{ false: c.surfaceElevated, true: c.primaryBg }}
                  thumbColor={reminder.enabled ? c.primary : c.textMuted}
                />
              </Pressable>
            ))
          )}

          <SectionHeader title="Sugerencias" styles={styles} />
          <View style={styles.suggestionGrid}>
            {SUGGESTIONS.map((suggestion) => (
              <Pressable key={suggestion.title} style={styles.suggestionCard} onPress={() => abrirNuevo(suggestion)}>
                <Ionicons name="add-circle-outline" size={19} color={c.primary} />
                <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                <Text style={styles.suggestionText}>{fmtHora(suggestion.hour, suggestion.minute)} · {suggestion.repeat_type === 'daily' ? 'Diario' : 'Semanal'}</Text>
              </Pressable>
            ))}
          </View>

          <SectionHeader title="Historial" styles={styles} />
          {history.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Aun no hay notificaciones</Text>
              <Text style={styles.emptyText}>Aqui apareceran notificaciones y recordatorios recibidos durante los ultimos 7 dias.</Text>
            </View>
          ) : (
            history.map((event) => (
              <Pressable key={event.id} style={[styles.eventRow, event.read_at == null && styles.eventUnread]} onPress={() => void markEvent(event)}>
                <View style={[styles.eventDot, event.read_at != null && styles.eventDotRead]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{event.title || smartTitle(event.data.type as SmartNotificationType)}</Text>
                  {event.body ? <Text style={styles.rowText}>{event.body}</Text> : null}
                  <Text style={styles.metaText}>
                    {event.kind === 'reminder' ? 'Recordatorio' : 'Notificacion'} · {formatFechaHora(event.received_at)}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Editar recordatorio' : 'Nuevo recordatorio'}</Text>
              <Pressable onPress={() => setModalVisible(false)} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={22} color={c.textDisplay} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScroll}
            >
              <Text style={styles.inputLabel}>Asunto · {title.length}/{TITLE_LIMIT}</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={TITLE_LIMIT} placeholder="Creatina" placeholderTextColor={c.textMuted} returnKeyType="next" />
              <Text style={styles.inputLabel}>Mensaje · {body.length}/{BODY_LIMIT}</Text>
              <TextInput style={[styles.input, styles.inputTall]} value={body} onChangeText={setBody} maxLength={BODY_LIMIT} placeholder="5 g y listo." placeholderTextColor={c.textMuted} multiline />
              <Text style={styles.inputLabel}>Hora</Text>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={(value) => setTime(soloDigitosHora(value))}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="09:00"
                placeholderTextColor={c.textMuted}
              />

              <View style={styles.segmentRow}>
                {(['once', 'daily', 'weekdays'] as NotificationReminderRepeatType[]).map((type) => (
                  <Pressable key={type} style={[styles.segment, repeatType === type && styles.segmentActive]} onPress={() => setRepeatType(type)}>
                    <Text style={[styles.segmentText, repeatType === type && styles.segmentTextActive]}>
                      {type === 'once' ? 'Una vez' : type === 'daily' ? 'Diario' : 'Dias'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {repeatType === 'weekdays' ? (
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((day) => {
                    const selected = weekdays.includes(day.value);
                    return (
                      <Pressable
                        key={day.value}
                        style={[styles.weekday, selected && styles.weekdayActive]}
                        onPress={() => setWeekdays((prev) => selected ? prev.filter((value) => value !== day.value) : [...prev, day.value])}
                      >
                        <Text style={[styles.weekdayText, selected && styles.weekdayTextActive]}>{day.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.enabledRow}>
                <Text style={styles.rowTitle}>Activo</Text>
                <Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: c.surfaceElevated, true: c.primaryBg }} thumbColor={enabled ? c.primary : c.textMuted} />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              {editing ? (
                <Pressable style={styles.deleteButton} onPress={() => { setModalVisible(false); borrar(editing); }}>
                  <Text style={styles.deleteText}>Borrar</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.saveButton} onPress={() => void guardar()} disabled={saving}>
                {saving ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={styles.saveText}>Guardar</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={notice != null} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
        <View style={styles.noticeBackdrop}>
          <View style={styles.noticeCard}>
            <View style={styles.noticeIcon}>
              <Ionicons
                name={notice?.destructive ? 'trash-outline' : 'alert-circle-outline'}
                size={22}
                color={notice?.destructive ? c.danger : c.primary}
              />
            </View>
            <Text style={styles.noticeTitle}>{notice?.title}</Text>
            <Text style={styles.noticeMessage}>{notice?.message}</Text>
            <View style={styles.noticeActions}>
              {notice?.cancelText ? (
                <Pressable style={styles.noticeSecondary} onPress={() => setNotice(null)}>
                  <Text style={styles.noticeSecondaryText}>{notice.cancelText}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.noticePrimary, notice?.destructive && styles.noticeDanger]}
                onPress={() => {
                  const confirm = notice?.onConfirm;
                  setNotice(null);
                  confirm?.();
                }}
              >
                <Text style={styles.noticePrimaryText}>{notice?.confirmText ?? 'OK'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onPress,
  styles,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onPress ? (
        <Pressable onPress={onPress}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function NotificationsSkeleton({
  styles,
  bottomInset,
}: {
  styles: ReturnType<typeof makeStyles>;
  bottomInset: number;
}) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 96 }]}
    >
      <View style={styles.skeletonPanel}>
        <View style={styles.skeletonIcon} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={[styles.skeletonLine, { width: '46%' }]} />
          <View style={[styles.skeletonLine, { width: '82%' }]} />
        </View>
      </View>

      <View style={styles.skeletonHeader} />
      <View style={styles.skeletonCard} />

      <View style={styles.skeletonHeader} />
      <View style={styles.skeletonGrid}>
        <View style={styles.skeletonSmallCard} />
        <View style={styles.skeletonSmallCard} />
      </View>

      <View style={styles.skeletonHeader} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
    </ScrollView>
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
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: s.md, paddingBottom: s.sm },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { flex: 1 },
    title: { ...ts.heading, fontFamily: f.sansBold, color: c.textDisplay },
    subtitle: { ...ts.caption, fontFamily: f.sans, color: c.textSecondary, marginTop: 2 },
    scroll: { paddingHorizontal: s.md, gap: s.sm },
    permissionPanel: {
      minHeight: 88,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      padding: s.md,
    },
    permissionIcon: {
      width: 42,
      height: 42,
      borderRadius: r.sm,
      backgroundColor: c.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panelTitle: { ...ts.bodySm, fontFamily: f.sansBold, color: c.textDisplay },
    panelText: { ...ts.caption, fontFamily: f.sans, color: c.textSecondary, marginTop: 2, lineHeight: 16 },
    smallButton: { minHeight: 34, borderRadius: r.sm, backgroundColor: c.primary, paddingHorizontal: s.sm, alignItems: 'center', justifyContent: 'center' },
    smallButtonText: { ...ts.caption, fontFamily: f.sansBold, color: c.textOnPrimary },
    sectionHeader: { marginTop: s.md, minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { ...ts.bodySm, fontFamily: f.sansBold, color: c.textDisplay, textTransform: 'uppercase', letterSpacing: 0.5 },
    sectionAction: { ...ts.bodySm, fontFamily: f.sansBold, color: c.primary },
    emptyBox: { borderRadius: r.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: s.md },
    emptyTitle: { ...ts.bodySm, fontFamily: f.sansBold, color: c.textDisplay },
    emptyText: { ...ts.caption, fontFamily: f.sans, color: c.textSecondary, marginTop: 3, lineHeight: 16 },
    reminderRow: {
      minHeight: 82,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      padding: s.sm,
    },
    reminderTime: { width: 76, minHeight: 54, borderRadius: r.sm, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    timeText: { ...ts.bodySm, fontFamily: FontFamily.monoBold, color: c.primary, fontVariant: ['tabular-nums'] },
    repeatText: { ...ts.caption, fontFamily: f.sans, color: c.textSecondary, marginTop: 2, textAlign: 'center' },
    reminderBody: { flex: 1, minWidth: 0 },
    rowTitle: { ...ts.bodySm, fontFamily: f.sansBold, color: c.textDisplay },
    rowText: { ...ts.caption, fontFamily: f.sans, color: c.textSecondary, marginTop: 2, lineHeight: 16 },
    metaText: { ...ts.caption, fontFamily: f.mono, color: c.textMuted, marginTop: 4 },
    suggestionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: s.sm },
    suggestionCard: { width: '48%', minHeight: 104, borderRadius: r.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: s.sm, justifyContent: 'space-between' },
    suggestionTitle: { ...ts.bodySm, fontFamily: f.sansBold, color: c.textDisplay },
    suggestionText: { ...ts.caption, fontFamily: f.sans, color: c.textSecondary },
    smartRow: { minHeight: 78, borderRadius: r.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: s.sm, padding: s.sm },
    smartIcon: { width: 38, height: 38, borderRadius: r.sm, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' },
    eventRow: { minHeight: 76, borderRadius: r.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, flexDirection: 'row', gap: s.sm, padding: s.sm },
    eventUnread: { borderColor: c.primary },
    eventDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.primary, marginTop: 6 },
    eventDotRead: { backgroundColor: c.borderVisible },
    skeletonPanel: {
      minHeight: 88,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      padding: s.md,
    },
    skeletonIcon: { width: 42, height: 42, borderRadius: r.sm, backgroundColor: c.surfaceElevated },
    skeletonLine: { height: 12, borderRadius: 6, backgroundColor: c.surfaceElevated },
    skeletonHeader: { width: 118, height: 14, borderRadius: 7, backgroundColor: c.surfaceElevated, marginTop: s.md },
    skeletonCard: { height: 78, borderRadius: r.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    skeletonGrid: { flexDirection: 'row', gap: s.sm },
    skeletonSmallCard: { flex: 1, height: 104, borderRadius: r.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' },
    modalCard: {
      maxHeight: '88%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: c.background,
      paddingTop: s.md,
      paddingHorizontal: s.md,
      gap: s.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s.xs },
    modalTitle: { ...ts.subheading, fontFamily: f.sansBold, color: c.textDisplay },
    modalScroll: { gap: s.sm, paddingBottom: s.xs },
    inputLabel: { ...ts.caption, fontFamily: f.mono, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { minHeight: 44, borderRadius: r.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: s.sm, color: c.textDisplay, fontFamily: f.sans, fontSize: 14 },
    inputTall: { minHeight: 72, paddingTop: s.sm, textAlignVertical: 'top' },
    segmentRow: { flexDirection: 'row', gap: s.xs },
    segment: { flex: 1, minHeight: 38, borderRadius: r.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    segmentActive: { borderColor: c.primary, backgroundColor: c.primaryBg },
    segmentText: { ...ts.caption, fontFamily: f.sansBold, color: c.textSecondary },
    segmentTextActive: { color: c.primary },
    weekdayRow: { flexDirection: 'row', gap: s.xs },
    weekday: { flex: 1, height: 36, borderRadius: r.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    weekdayActive: { borderColor: c.primary, backgroundColor: c.primaryBg },
    weekdayText: { ...ts.caption, fontFamily: f.sansBold, color: c.textSecondary },
    weekdayTextActive: { color: c.primary },
    enabledRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalActions: { flexDirection: 'row', gap: s.sm, paddingTop: s.xs },
    deleteButton: { flex: 1, minHeight: 46, borderRadius: r.sm, borderWidth: 1, borderColor: c.danger, alignItems: 'center', justifyContent: 'center' },
    deleteText: { ...ts.bodySm, fontFamily: f.sansBold, color: c.danger },
    saveButton: { flex: 1, minHeight: 46, borderRadius: r.sm, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    saveText: { ...ts.bodySm, fontFamily: f.sansBold, color: c.textOnPrimary },
    noticeBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.68)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: s.lg,
    },
    noticeCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      padding: s.md,
      gap: s.sm,
    },
    noticeIcon: {
      width: 42,
      height: 42,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noticeTitle: { ...ts.subheading, fontFamily: f.sansBold, color: c.textDisplay },
    noticeMessage: { ...ts.bodySm, fontFamily: f.sans, color: c.textSecondary, lineHeight: 20 },
    noticeActions: { flexDirection: 'row', gap: s.sm, marginTop: s.xs },
    noticeSecondary: {
      flex: 1,
      minHeight: 44,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noticeSecondaryText: { ...ts.bodySm, fontFamily: f.sansBold, color: c.textDisplay },
    noticePrimary: {
      flex: 1,
      minHeight: 44,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noticeDanger: { backgroundColor: c.danger },
    noticePrimaryText: { ...ts.bodySm, fontFamily: f.sansBold, color: c.textOnPrimary },
  });
}
