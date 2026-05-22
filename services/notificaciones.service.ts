import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { DeviceEventEmitter, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  NotificationEvent,
  NotificationPreference,
  NotificationReminder,
  NotificationReminderRepeatType,
  SmartNotificationType,
} from '@/types/database.types';

const CHANNEL_ID = 'vertice-reminders-v2';
const FALLBACK_TIMEZONE = 'Europe/Madrid';
const LOCAL_SCHEDULE_KEY = 'vertice:notification-reminder-schedules';
const LOCAL_HISTORY_KEY = 'vertice:notification-history:v1';
const PUSH_STATUS_KEY = 'vertice:push-registration-status:v1';
const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const REMINDER_TITLE_LIMIT = 30;
const REMINDER_BODY_LIMIT = 100;
const REGISTRO_PUSH_TTL_MS = 60 * 1000;

let ultimoRegistroPushOk: { userId: string; status: PushRegistrationStatus; at: number } | null = null;

export const NOTIFICACIONES_CAMBIADAS = 'vertice:notificaciones:cambiadas';

export const SMART_NOTIFICATION_DEFAULTS: Record<
  SmartNotificationType,
  { title: string; description: string; hour: number; minute: number }
> = {
  no_food_today: {
    title: 'Registrar comida',
    description: 'Aviso si llega la tarde y no has registrado comidas.',
    hour: 17,
    minute: 0,
  },
  calories_remaining: {
    title: 'Cerrar calorias',
    description: 'Aviso si te quedan calorias relevantes para el objetivo.',
    hour: 21,
    minute: 30,
  },
  no_workout_3_days: {
    title: 'Volver a entrenar',
    description: 'Aviso cuando llevas 3 dias sin cerrar un entreno.',
    hour: 10,
    minute: 0,
  },
  weigh_in: {
    title: 'Registrar peso',
    description: 'Recordatorio semanal para mantener tendencia clara.',
    hour: 9,
    minute: 30,
  },
};

export type ReminderDraft = {
  title: string;
  body?: string | null;
  hour: number;
  minute: number;
  repeat_type: NotificationReminderRepeatType;
  weekdays: number[];
  enabled: boolean;
};

export type PermissionState = {
  granted: boolean;
  status: Notifications.PermissionStatus;
  canAskAgain: boolean;
};

export type PushRegistrationStatus = {
  registered: boolean;
  checked_at: string | null;
  error: string | null;
};

export type NotificationHistoryItem = {
  id: string;
  kind: 'reminder' | 'notification';
  source: 'local' | 'remote';
  title: string;
  body: string | null;
  received_at: string;
  read_at: string | null;
  reminder_id: string | null;
  data: Record<string, unknown>;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function timezoneActual(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

function normalizarDraft(draft: ReminderDraft): ReminderDraft {
  const title = draft.title.trim().slice(0, REMINDER_TITLE_LIMIT);
  const body = draft.body?.trim() ? draft.body.trim().slice(0, REMINDER_BODY_LIMIT) : null;
  const hour = Math.min(23, Math.max(0, Math.trunc(draft.hour)));
  const minute = Math.min(59, Math.max(0, Math.trunc(draft.minute)));
  const weekdays = [...new Set(draft.weekdays)]
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((a, b) => a - b);

  return {
    title,
    body,
    hour,
    minute,
    repeat_type: draft.repeat_type,
    weekdays: draft.repeat_type === 'weekdays' ? weekdays : [],
    enabled: draft.enabled && title.length > 0,
  };
}

function siguienteFecha(hour: number, minute: number): Date {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function proximasOcurrencias(reminder: NotificationReminder): Date[] {
  if (!reminder.enabled) return [];

  const ahora = Date.now();
  const limite = ahora + HISTORY_WINDOW_MS;
  const ocurrencias: Date[] = [];

  if (reminder.repeat_type === 'once') {
    const fecha = siguienteFecha(reminder.hour, reminder.minute);
    if (fecha.getTime() <= limite) ocurrencias.push(fecha);
    return ocurrencias;
  }

  // Permitidos: daily o weekdays
  const cursor = new Date();
  cursor.setSeconds(0, 0);
  cursor.setHours(reminder.hour, reminder.minute, 0, 0);
  if (cursor.getTime() <= ahora) {
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cursor.getTime() <= limite) {
    if (reminder.repeat_type === 'daily') {
      ocurrencias.push(new Date(cursor));
    } else if (reminder.repeat_type === 'weekdays') {
      // JS getDay(): 0=domingo..6=sábado. Nuestro modelo: 1=domingo..7=sábado.
      const jsDay = cursor.getDay();
      const ourDay = jsDay + 1;
      if (reminder.weekdays.includes(ourDay)) {
        ocurrencias.push(new Date(cursor));
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return ocurrencias;
}

function ocurrenciaHistoryId(reminderId: string, scheduledAt: Date): string {
  return `local:${reminderId}:${scheduledAt.toISOString().slice(0, 16)}`;
}

function itemFromOcurrencia(reminder: NotificationReminder, scheduledAt: Date): NotificationHistoryItem {
  return {
    id: ocurrenciaHistoryId(reminder.id, scheduledAt),
    kind: 'reminder',
    source: 'local',
    title: reminder.title,
    body: reminder.body ?? 'Pequeno habito, gran constancia.',
    received_at: scheduledAt.toISOString(),
    read_at: null,
    reminder_id: reminder.id,
    data: {
      type: 'personal_reminder',
      reminderId: reminder.id,
      url: '/(tabs)/inicio/notificaciones',
    },
  };
}

async function cancelarProgramadas(ids: string[] | null | undefined): Promise<void> {
  await Promise.all(
    (ids ?? []).map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
    ),
  );
}

function traducirErrorPush(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();

  if (lower.includes('firebaseapp is not initialized') || lower.includes('fcm-credentials')) {
    return 'Las notificaciones automáticas no están disponibles en este dispositivo.';
  }
  if (lower.includes('play services')) {
    return 'Tu dispositivo no tiene Google Play Services. Las notificaciones automáticas no están disponibles.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Sin conexión para activar notificaciones. Reintenta cuando tengas internet.';
  }
  if (lower.includes('permission') || lower.includes('denied')) {
    return 'Faltan permisos de notificaciones. Actívalos desde los ajustes del sistema.';
  }
  return 'No se pudieron activar las notificaciones automáticas. Reintenta más tarde.';
}

async function guardarEstadoPush(status: PushRegistrationStatus): Promise<void> {
  await AsyncStorage.setItem(PUSH_STATUS_KEY, JSON.stringify(status));
}

async function scheduledIdsForReminder(reminderId: string): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  return scheduled
    .filter((notification) => {
      const data = normalizarData(notification.content.data);
      return data.type === 'personal_reminder' && data.reminderId === reminderId;
    })
    .map((notification) => notification.identifier);
}

async function cancelarRecordatorioProgramadoEnSistema(reminderId: string): Promise<void> {
  await cancelarProgramadas(await scheduledIdsForReminder(reminderId));
}

async function leerProgramadasLocales(): Promise<Record<string, string[]>> {
  const raw = await AsyncStorage.getItem(LOCAL_SCHEDULE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string[]> : {};
  } catch {
    return {};
  }
}

async function guardarProgramadasLocales(next: Record<string, string[]>): Promise<void> {
  await AsyncStorage.setItem(LOCAL_SCHEDULE_KEY, JSON.stringify(next));
}

function cutoffHistorial(): number {
  return Date.now() - HISTORY_WINDOW_MS;
}

function estaEnVentanaHistorial(value: string | null | undefined): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= cutoffHistorial();
}

function notificarCambioHistorial(): void {
  DeviceEventEmitter.emit(NOTIFICACIONES_CAMBIADAS);
}

function normalizarData(data: Notifications.NotificationContent['data']): Record<string, unknown> {
  return data && typeof data === 'object' ? { ...(data as Record<string, unknown>) } : {};
}

function esRecordatorioPersonal(notification: Notifications.Notification): boolean {
  const data = normalizarData(notification.request.content.data);
  return data.type === 'personal_reminder' || typeof data.reminderId === 'string';
}

function localHistoryId(notification: Notifications.Notification, receivedAt: string): string {
  const data = normalizarData(notification.request.content.data);
  const reminderId = typeof data.reminderId === 'string' ? data.reminderId : 'unknown';
  const minuteBucket = receivedAt.slice(0, 16);
  return `local:${reminderId}:${minuteBucket}`;
}

function itemFromLocalNotification(
  notification: Notifications.Notification,
  receivedAt = new Date().toISOString(),
  readAt: string | null = null,
): NotificationHistoryItem | null {
  if (!esRecordatorioPersonal(notification)) return null;
  const data = normalizarData(notification.request.content.data);
  const reminderId = typeof data.reminderId === 'string' ? data.reminderId : null;
  return {
    id: localHistoryId(notification, receivedAt),
    kind: 'reminder',
    source: 'local',
    title: notification.request.content.title ?? 'Recordatorio',
    body: notification.request.content.body ?? null,
    received_at: receivedAt,
    read_at: readAt,
    reminder_id: reminderId,
    data,
  };
}

async function leerHistorialLocal(): Promise<NotificationHistoryItem[]> {
  const raw = await AsyncStorage.getItem(LOCAL_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is NotificationHistoryItem =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.received_at === 'string' &&
        (item.source === 'local' || item.source === 'remote') &&
        (item.kind === 'reminder' || item.kind === 'notification'),
      )
      .map((item) => ({
        ...item,
        body: typeof item.body === 'string' ? item.body : null,
        read_at: typeof item.read_at === 'string' ? item.read_at : null,
        reminder_id: typeof item.reminder_id === 'string' ? item.reminder_id : null,
        data: item.data && typeof item.data === 'object' ? item.data : {},
      }))
      .filter((item) => {
        if (item.source !== 'local') return false;
        if (!estaEnVentanaHistorial(item.received_at)) return false;
        // Ocurrencias pre-registradas con fecha futura: aún no han disparado.
        return new Date(item.received_at).getTime() <= Date.now();
      });
  } catch {
    return [];
  }
}

async function guardarHistorialLocal(items: NotificationHistoryItem[]): Promise<void> {
  const cutoff = cutoffHistorial();
  const limite = Date.now() + HISTORY_WINDOW_MS;
  const unique = new Map<string, NotificationHistoryItem>();
  for (const item of items) {
    if (item.source !== 'local') continue;
    const t = new Date(item.received_at).getTime();
    if (!Number.isFinite(t)) continue;
    // Aceptar entradas pasadas dentro de la ventana O futuras dentro de la ventana de pre-registro.
    if (t < cutoff || t > limite) continue;
    const prev = unique.get(item.id);
    unique.set(item.id, {
      ...item,
      read_at: prev?.read_at ?? item.read_at,
    });
  }
  const ordered = [...unique.values()].sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
  );
  await AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(ordered));
}

async function preRegistrarOcurrencias(reminder: NotificationReminder): Promise<void> {
  const ocurrencias = proximasOcurrencias(reminder);
  if (ocurrencias.length === 0) return;
  const nuevos = ocurrencias.map((fecha) => itemFromOcurrencia(reminder, fecha));
  const current = await leerHistorialLocal();
  await guardarHistorialLocal([...nuevos, ...current]);
}

async function borrarOcurrenciasFuturasDe(reminderId: string): Promise<void> {
  const current = await leerHistorialLocal();
  const ahora = Date.now();
  const filtered = current.filter((item) => {
    if (item.reminder_id !== reminderId) return true;
    return new Date(item.received_at).getTime() <= ahora;
  });
  await guardarHistorialLocal(filtered);
}

function mapEventoRemoto(event: NotificationEvent): NotificationHistoryItem {
  const receivedAt = event.sent_at ?? event.created_at;
  return {
    id: event.id,
    kind: 'notification',
    source: 'remote',
    title: event.title || SMART_NOTIFICATION_DEFAULTS[event.type]?.title || 'Notificacion',
    body: event.body ?? null,
    received_at: receivedAt,
    read_at: event.read_at,
    reminder_id: null,
    data: {
      ...(event.data ?? {}),
      type: event.type,
    },
  };
}

function unirHistorial(items: NotificationHistoryItem[]): NotificationHistoryItem[] {
  const byId = new Map<string, NotificationHistoryItem>();
  for (const item of items) {
    if (!estaEnVentanaHistorial(item.received_at)) continue;
    const fallbackKey = `${item.source}:${item.reminder_id ?? item.id}:${item.received_at}`;
    const key = item.id || fallbackKey;
    const prev = byId.get(key);
    byId.set(key, {
      ...item,
      read_at: prev?.read_at ?? item.read_at,
    });
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
  );
}

async function cancelarRecordatorioLocal(reminderId: string): Promise<void> {
  const schedules = await leerProgramadasLocales();
  await Promise.all([
    cancelarProgramadas(schedules[reminderId]),
    cancelarRecordatorioProgramadoEnSistema(reminderId),
    borrarOcurrenciasFuturasDe(reminderId),
  ]);
  delete schedules[reminderId];
  await guardarProgramadasLocales(schedules);
}

async function guardarRecordatorioLocal(reminderId: string, ids: string[]): Promise<void> {
  const schedules = await leerProgramadasLocales();
  schedules[reminderId] = ids;
  await guardarProgramadasLocales(schedules);
}

async function programarLocal(reminder: NotificationReminder): Promise<{ ids: string[]; next: string | null }> {
  if (!reminder.enabled) return { ids: [], next: null };
  await cancelarRecordatorioLocal(reminder.id);

  const content = {
    title: reminder.title,
    body: reminder.body ?? 'Pequeno habito, gran constancia.',
    data: {
      type: 'personal_reminder',
      reminderId: reminder.id,
      url: '/(tabs)/inicio/notificaciones',
    },
  };

  if (reminder.repeat_type === 'daily') {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: CHANNEL_ID,
        hour: reminder.hour,
        minute: reminder.minute,
      },
    });
    return { ids: [id], next: null };
  }

  if (reminder.repeat_type === 'weekdays') {
    const ids = await Promise.all(
      reminder.weekdays.map((weekday) =>
        Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            channelId: CHANNEL_ID,
            weekday,
            hour: reminder.hour,
            minute: reminder.minute,
          },
        }),
      ),
    );
    return { ids, next: null };
  }

  const next = siguienteFecha(reminder.hour, reminder.minute);
  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      channelId: CHANNEL_ID,
      date: next,
    },
  });
  return { ids: [id], next: next.toISOString() };
}

async function programarYRegistrarLocal(reminder: NotificationReminder): Promise<{ ids: string[]; next: string | null }> {
  const result = await programarLocal(reminder);
  await preRegistrarOcurrencias(reminder);
  return result;
}

export const notificacionesService = {
  channelId: CHANNEL_ID,

  timezoneActual,

  emitirCambio(): void {
    notificarCambioHistorial();
  },

  async asegurarCanalAndroid(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios Vertice',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 120, 220],
      lightColor: '#00D4FF',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  },

  async obtenerPermisos(): Promise<PermissionState> {
    await this.asegurarCanalAndroid();
    const current = await Notifications.getPermissionsAsync();
    return {
      granted: current.granted || current.status === Notifications.PermissionStatus.GRANTED,
      status: current.status,
      canAskAgain: current.canAskAgain,
    };
  },

  async pedirPermisos(): Promise<PermissionState> {
    await this.asegurarCanalAndroid();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || !current.canAskAgain) {
      return {
        granted: current.granted || current.status === Notifications.PermissionStatus.GRANTED,
        status: current.status,
        canAskAgain: current.canAskAgain,
      };
    }
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    return {
      granted: result.granted || result.status === Notifications.PermissionStatus.GRANTED,
      status: result.status,
      canAskAgain: result.canAskAgain,
    };
  },

  async registrarDispositivo(userId: string): Promise<PushRegistrationStatus> {
    const checkedAt = new Date().toISOString();
    const fail = async (message: string): Promise<PushRegistrationStatus> => {
      const status = { registered: false, checked_at: checkedAt, error: message };
      await guardarEstadoPush(status);
      return status;
    };

    if (!userId) return fail('No hay usuario activo.');
    if (Platform.OS === 'web') return fail('Las notificaciones push no estan disponibles en web.');

    if (
      ultimoRegistroPushOk &&
      ultimoRegistroPushOk.userId === userId &&
      Date.now() - ultimoRegistroPushOk.at < REGISTRO_PUSH_TTL_MS
    ) {
      return ultimoRegistroPushOk.status;
    }

    try {
      const permisos = await this.obtenerPermisos();
      if (!permisos.granted) return fail('Permisos de notificaciones pendientes.');

      const easProjectId = projectId();
      if (!easProjectId) return fail('Falta el projectId de EAS para obtener el push token.');

      const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
      const timezone = timezoneActual();
      const { error } = await supabase.from('notification_devices').upsert(
        {
          user_id: userId,
          expo_push_token: token,
          platform: Platform.OS,
          timezone,
          enabled: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,expo_push_token' },
      );
      if (error) throw error;
      await this.asegurarPreferenciasInteligentes(userId);

      const status = { registered: true, checked_at: checkedAt, error: null };
      await guardarEstadoPush(status);
      ultimoRegistroPushOk = { userId, status, at: Date.now() };
      return status;
    } catch (error) {
      logger.warn('notificaciones.registrarDispositivo', error);
      ultimoRegistroPushOk = null;
      return fail(traducirErrorPush(error));
    }
  },

  async obtenerEstadoRegistroPush(userId?: string | null): Promise<PushRegistrationStatus> {
    const raw = await AsyncStorage.getItem(PUSH_STATUS_KEY);
    let local: PushRegistrationStatus = { registered: false, checked_at: null, error: null };
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        local = {
          registered: parsed?.registered === true,
          checked_at: typeof parsed?.checked_at === 'string' ? parsed.checked_at : null,
          error: typeof parsed?.error === 'string' ? parsed.error : null,
        };
      } catch {
        local = { registered: false, checked_at: null, error: null };
      }
    }

    if (!userId) return local;
    const { data, error } = await supabase
      .from('notification_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('enabled', true)
      .limit(1);
    if (!error && (data?.length ?? 0) > 0) {
      return { registered: true, checked_at: local.checked_at, error: null };
    }
    return local;
  },

  async asegurarPreferenciasInteligentes(userId: string): Promise<NotificationPreference[]> {
    const timezone = timezoneActual();
    const rows = (Object.entries(SMART_NOTIFICATION_DEFAULTS) as [
      SmartNotificationType,
      (typeof SMART_NOTIFICATION_DEFAULTS)[SmartNotificationType],
    ][]).map(([type, defaults]) => ({
      user_id: userId,
      type,
      enabled: true,
      hour: defaults.hour,
      minute: defaults.minute,
      timezone,
    }));

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(rows, { onConflict: 'user_id,type' });
    if (error) throw error;

    const { data, error: fetchError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (fetchError) throw fetchError;
    return (data ?? []) as NotificationPreference[];
  },

  async listarRecordatorios(userId: string): Promise<NotificationReminder[]> {
    const { data, error } = await supabase
      .from('notification_reminders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as NotificationReminder[];
  },

  async listarEventos(userId: string): Promise<NotificationEvent[]> {
    const { data, error } = await supabase
      .from('notification_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(cutoffHistorial()).toISOString())
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as NotificationEvent[];
  },

  async limpiarHistorialLocalAntiguo(): Promise<void> {
    const items = await leerHistorialLocal();
    await guardarHistorialLocal(items);
  },

  async registrarNotificacionLocal(notification: Notifications.Notification): Promise<void> {
    const item = itemFromLocalNotification(notification);
    if (!item) return;
    const current = await leerHistorialLocal();
    await guardarHistorialLocal([item, ...current]);
    notificarCambioHistorial();
  },

  async marcarNotificacionLocalLeida(notification: Notifications.Notification): Promise<void> {
    const readAt = new Date().toISOString();
    const item = itemFromLocalNotification(notification, readAt, readAt);
    if (!item) return;

    const current = await leerHistorialLocal();
    const next = current.map((historyItem) => {
      const sameId = historyItem.id === item.id;
      const sameReminder =
        item.reminder_id != null &&
        historyItem.reminder_id === item.reminder_id &&
        Math.abs(new Date(historyItem.received_at).getTime() - new Date(item.received_at).getTime()) < 120000;
      return sameId || sameReminder ? { ...historyItem, read_at: historyItem.read_at ?? readAt } : historyItem;
    });
    if (!next.some((historyItem) => historyItem.id === item.id)) {
      next.unshift(item);
    }
    await guardarHistorialLocal(next);
    notificarCambioHistorial();
  },

  async reconciliarNotificacionesPresentadas(): Promise<void> {
    if (Platform.OS === 'web') return;
    const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
    if (presented.length === 0) {
      await this.limpiarHistorialLocalAntiguo();
      return;
    }
    const current = await leerHistorialLocal();
    const items = presented
      .map((notification) => itemFromLocalNotification(notification))
      .filter((item): item is NotificationHistoryItem => item != null);
    await guardarHistorialLocal([...items, ...current]);
    if (items.length > 0) notificarCambioHistorial();
  },

  async listarHistorialUnificado(userId: string): Promise<NotificationHistoryItem[]> {
    await this.reconciliarNotificacionesPresentadas();
    const [localItems, remoteEvents] = await Promise.all([
      leerHistorialLocal(),
      this.listarEventos(userId),
    ]);
    return unirHistorial([
      ...remoteEvents.map(mapEventoRemoto),
      ...localItems,
    ]);
  },

  async marcarHistorialLeido(item: NotificationHistoryItem): Promise<void> {
    if (item.read_at) return;
    const readAt = new Date().toISOString();
    if (item.source === 'remote') {
      await this.marcarEventoLeido(item.id);
      notificarCambioHistorial();
      return;
    }

    const current = await leerHistorialLocal();
    await guardarHistorialLocal(
      current.map((historyItem) =>
        historyItem.id === item.id ? { ...historyItem, read_at: historyItem.read_at ?? readAt } : historyItem,
      ),
    );
    notificarCambioHistorial();
  },

  async obtenerResumenNoLeidas(userId: string): Promise<{ unreadCount: number }> {
    if (!userId) return { unreadCount: 0 };
    const cutoffIso = new Date(cutoffHistorial()).toISOString();
    const [remoteResult, localItems] = await Promise.all([
      supabase
        .from('notification_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
        .gte('created_at', cutoffIso),
      leerHistorialLocal(),
    ]);
    const remoteCount = remoteResult.count ?? 0;
    const localCount = localItems.filter((item) => item.read_at == null).length;
    return { unreadCount: remoteCount + localCount };
  },

  async crearRecordatorio(userId: string, draft: ReminderDraft): Promise<NotificationReminder> {
    const normalized = normalizarDraft(draft);
    const permisos = normalized.enabled ? await this.pedirPermisos() : await this.obtenerPermisos();
    const enabled = normalized.enabled && permisos.granted;
    const nextTriggerAt = enabled && normalized.repeat_type === 'once'
      ? siguienteFecha(normalized.hour, normalized.minute).toISOString()
      : null;

    const { data, error } = await supabase
      .from('notification_reminders')
      .insert({
        ...normalized,
        enabled,
        user_id: userId,
        next_trigger_at: nextTriggerAt,
      })
      .select('*')
      .single();
    if (error) throw error;

    const reminder = data as NotificationReminder;
    if (!enabled) return reminder;

    const scheduled = await programarYRegistrarLocal(reminder);
    await guardarRecordatorioLocal(reminder.id, scheduled.ids);
    void this.registrarDispositivo(userId).catch(() => undefined);
    return reminder;
  },

  async actualizarRecordatorio(reminder: NotificationReminder, draft: ReminderDraft): Promise<NotificationReminder> {
    const normalized = normalizarDraft(draft);
    const permisos = normalized.enabled ? await this.pedirPermisos() : await this.obtenerPermisos();
    const enabled = normalized.enabled && permisos.granted;
    const nextTriggerAt = enabled && normalized.repeat_type === 'once'
      ? siguienteFecha(normalized.hour, normalized.minute).toISOString()
      : null;

    const { data, error } = await supabase
      .from('notification_reminders')
      .update({
        ...normalized,
        enabled,
        next_trigger_at: nextTriggerAt,
      })
      .eq('id', reminder.id)
      .select('*')
      .single();
    if (error) throw error;

    const updated = data as NotificationReminder;
    if (!enabled) {
      await cancelarRecordatorioLocal(updated.id);
      return updated;
    }

    const scheduled = await programarYRegistrarLocal(updated);
    await guardarRecordatorioLocal(updated.id, scheduled.ids);
    void this.registrarDispositivo(updated.user_id).catch(() => undefined);
    return updated;
  },

  async borrarRecordatorio(reminder: NotificationReminder): Promise<void> {
    await cancelarRecordatorioLocal(reminder.id);
    const { error } = await supabase.from('notification_reminders').delete().eq('id', reminder.id);
    if (error) throw error;
  },

  async cambiarPreferencia(preference: NotificationPreference, enabled: boolean): Promise<NotificationPreference> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .update({ enabled, timezone: timezoneActual() })
      .eq('id', preference.id)
      .select('*')
      .single();
    if (error) throw error;
    if (enabled) void this.registrarDispositivo(preference.user_id).catch(() => undefined);
    return data as NotificationPreference;
  },

  async marcarEventoLeido(eventId: string): Promise<void> {
    const { error } = await supabase
      .from('notification_events')
      .update({ read_at: new Date().toISOString() })
      .eq('id', eventId)
      .is('read_at', null);
    if (error) throw error;
  },

  async sincronizarRecordatoriosLocales(userId: string): Promise<void> {
    if (!userId) return;
    await this.asegurarCanalAndroid();
    const permisos = await this.obtenerPermisos();
    if (!permisos.granted) return;

    const reminders = await this.listarRecordatorios(userId);
    for (const reminder of reminders) {
      if (reminder.repeat_type === 'once' && reminder.next_trigger_at && new Date(reminder.next_trigger_at).getTime() < Date.now()) {
        await cancelarRecordatorioLocal(reminder.id);
        await supabase
          .from('notification_reminders')
          .update({ enabled: false, next_trigger_at: null })
          .eq('id', reminder.id);
        continue;
      }
      if (!reminder.enabled) {
        await cancelarRecordatorioLocal(reminder.id);
        continue;
      }

      const scheduled = await programarYRegistrarLocal(reminder);
      await guardarRecordatorioLocal(reminder.id, scheduled.ids);
      if (scheduled.next && scheduled.next !== reminder.next_trigger_at) {
        await supabase
          .from('notification_reminders')
          .update({ next_trigger_at: scheduled.next })
          .eq('id', reminder.id);
      }
    }
  },
};
