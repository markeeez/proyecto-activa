import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SmartType = 'no_food_today' | 'calories_remaining' | 'no_workout_3_days' | 'weigh_in';

type Preference = {
  id: string;
  user_id: string;
  type: SmartType;
  hour: number;
  minute: number;
  timezone: string;
};

type PushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority: 'high';
  channelId: string;
  android?: { channelId: string; priority: 'high'; sound: 'default' };
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function localParts(timezone: string): { date: string; hour: number; minute: number; weekday: number } {
  const tz = timezone || 'Europe/Madrid';
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
  const weekdayMap: Record<string, number> = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: weekdayMap[weekdayShort] ?? 1,
  };
}

function addDays(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function nutritionLogIdFor(client: any, userId: string, date: string): Promise<string | null> {
  const { data, error } = await client
    .from('nutrition_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('fecha', date)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function hasFoodToday(client: any, userId: string, date: string): Promise<boolean> {
  const logId = await nutritionLogIdFor(client, userId, date);
  if (!logId) return false;
  const { data, error } = await client
    .from('nutrition_log_items')
    .select('id, nutrition_log_meals!inner(log_id)')
    .eq('nutrition_log_meals.log_id', logId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function caloriesToday(client: any, userId: string, date: string): Promise<number> {
  const logId = await nutritionLogIdFor(client, userId, date);
  if (!logId) return 0;
  const { data, error } = await client
    .from('nutrition_log_items')
    .select('calorias_calculadas, nutrition_log_meals!inner(log_id)')
    .eq('nutrition_log_meals.log_id', logId);
  if (error) throw error;
  return (data ?? []).reduce((sum: number, row: { calorias_calculadas: number | null }) => sum + Number(row.calorias_calculadas ?? 0), 0);
}

async function latestGoalCalories(client: any, userId: string): Promise<number | null> {
  const { data, error } = await client
    .from('user_goals')
    .select('calorias_objetivo')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const value = Number(data?.calorias_objetivo ?? 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function hasCompletedWorkoutSince(client: any, userId: string, sinceDate: string): Promise<boolean> {
  const { data, error } = await client
    .from('workout_sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('fecha', sinceDate)
    .not('hora_fin', 'is', null)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function hasWeightSince(client: any, userId: string, sinceDate: string): Promise<boolean> {
  const { data, error } = await client
    .from('user_body_metrics')
    .select('id')
    .eq('user_id', userId)
    .gte('fecha', sinceDate)
    .not('peso_kg', 'is', null)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function buildMessage(client: any, preference: Preference, date: string, weekday: number): Promise<{ title: string; body: string; data: Record<string, unknown> } | null> {
  if (preference.type === 'no_food_today') {
    if (await hasFoodToday(client, preference.user_id, date)) return null;
    return {
      title: 'Registra tu comida',
      body: 'Aun no has registrado comidas hoy. Un apunte rapido mantiene el dia bajo control.',
      data: { type: preference.type, url: '/(tabs)/inicio/notificaciones' },
    };
  }

  if (preference.type === 'calories_remaining') {
    const [goal, consumed] = await Promise.all([
      latestGoalCalories(client, preference.user_id),
      caloriesToday(client, preference.user_id, date),
    ]);
    if (!goal || consumed <= 0) return null;
    const remaining = Math.round(goal - consumed);
    if (remaining < 300) return null;
    return {
      title: 'Te faltan calorias',
      body: `Te faltan ${remaining} kcal para tu objetivo. Puedes cerrarlo con algo simple.`,
      data: { type: preference.type, remaining, url: '/(tabs)/inicio/notificaciones' },
    };
  }

  if (preference.type === 'no_workout_3_days') {
    const hasRecentWorkout = await hasCompletedWorkoutSince(client, preference.user_id, addDays(date, -2));
    if (hasRecentWorkout) return null;
    return {
      title: 'Volver a entrenar',
      body: 'Llevas 3 dias sin entrenar. Algo corto tambien cuenta.',
      data: { type: preference.type, url: '/(tabs)/(entrenamiento)' },
    };
  }

  if (preference.type === 'weigh_in') {
    if (weekday !== 1) return null;
    const hasRecentWeight = await hasWeightSince(client, preference.user_id, addDays(date, -6));
    if (hasRecentWeight) return null;
    return {
      title: 'Registra tu peso',
      body: 'Hora de registrar peso. Un dato pequeno, una tendencia mas clara.',
      data: { type: preference.type, url: '/(tabs)/(progreso)' },
    };
  }

  return null;
}

async function sendPush(messages: PushMessage[]): Promise<string[]> {
  if (messages.length === 0) return [];
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    throw new Error(`Expo push failed: ${response.status}`);
  }
  const payload = await response.json().catch(() => null) as { data?: Array<{ status?: string; details?: { error?: string } }> } | null;
  const tickets = payload?.data ?? [];
  const invalidTokens: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      const token = messages[index]?.to;
      if (token) invalidTokens.push(token);
    }
  });
  return invalidTokens;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
  const cronSecret = Deno.env.get('SMART_NOTIFICATIONS_CRON_SECRET') ?? '';

  if (!supabaseUrl || !serviceKey || !cronSecret) {
    return json({ error: 'Service misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const headerSecret = req.headers.get('X-Cron-Secret') ?? '';
  const authorized = headerSecret === cronSecret || authHeader === `Bearer ${cronSecret}`;
  if (!authorized) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: preferences, error } = await client
    .from('notification_preferences')
    .select('id, user_id, type, hour, minute, timezone')
    .eq('enabled', true);
  if (error) return json({ error: error.message }, 500);

  let checked = 0;
  let created = 0;
  let sent = 0;

  let rateLimited = 0;

  for (const preference of (preferences ?? []) as Preference[]) {
    const parts = localParts(preference.timezone);
    if (parts.hour !== preference.hour || parts.minute !== preference.minute) continue;
    checked += 1;

    // Rate limit por usuario: max 1 push automatica cada 30 min.
    const { data: allowed, error: rateError } = await client.rpc('can_send_smart_push', {
      p_user_id: preference.user_id,
    });
    if (rateError) throw rateError;
    if (allowed === false) {
      rateLimited += 1;
      continue;
    }

    const { data: devices, error: deviceError } = await client
      .from('notification_devices')
      .select('expo_push_token')
      .eq('user_id', preference.user_id)
      .eq('enabled', true);
    if (deviceError) throw deviceError;
    if ((devices?.length ?? 0) === 0) continue;

    const message = await buildMessage(client, preference, parts.date, parts.weekday);
    if (!message) continue;

    const { data: event, error: eventError } = await client
      .from('notification_events')
      .insert({
        user_id: preference.user_id,
        type: preference.type,
        title: message.title,
        body: message.body,
        data: message.data,
        scheduled_for_date: parts.date,
      })
      .select('id')
      .single();

    if (eventError) {
      if (eventError.code === '23505') continue;
      throw eventError;
    }

    created += 1;
    const pushData = {
      ...message.data,
      notificationEventId: event.id,
    };
    const pushMessages: PushMessage[] = (devices ?? []).map((device: { expo_push_token: string }) => ({
      to: device.expo_push_token,
      sound: 'default' as const,
      title: message.title,
      body: message.body,
      data: pushData,
      priority: 'high' as const,
      channelId: 'vertice-reminders-v2',
      android: { channelId: 'vertice-reminders-v2', priority: 'high' as const, sound: 'default' as const },
    }));

    const invalidTokens = await sendPush(pushMessages);
    if (invalidTokens.length > 0) {
      await client
        .from('notification_devices')
        .update({ enabled: false })
        .in('expo_push_token', invalidTokens);
    }
    const effective = pushMessages.length - invalidTokens.length;
    if (effective > 0) {
      sent += effective;
      await Promise.all([
        client.from('notification_events').update({ sent_at: new Date().toISOString() }).eq('id', event.id),
        client.from('notification_send_log').insert({ user_id: preference.user_id }),
      ]);
    }
  }

  return json({ ok: true, checked, created, sent, rateLimited });
});
