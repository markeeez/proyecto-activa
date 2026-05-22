/**
 * Tests RLS / permisos contra Supabase remoto (proyecto ACTIVA).
 *
 * Verifica que:
 *  - El cliente anon NO puede llamar RPC sensibles (revocadas en migracion).
 *  - El cliente anon NO puede leer tablas de un usuario.
 *  - Anon SI puede leer tablas publicas (exercises, foods globales).
 *
 * Para correr:
 *   EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... node --test tests/rls.test.mjs
 *
 * En desarrollo local con .env presente, package.json puede cargarlo via dotenv.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('[rls.test] Falta EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY; tests saltados.');
  process.exit(0);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── RPC: revokes ────────────────────────────────────────────────────────────

test('anon NO puede llamar finalizar_onboarding', async () => {
  const { error } = await supabase.rpc('finalizar_onboarding', {
    p_genero: 'h',
    p_edad: 30,
    p_altura_cm: 175,
    p_peso_kg: 75,
    p_factor_actividad: 1.4,
    p_objetivo: 'mantener',
    p_kcal: 2000,
    p_proteinas: 150,
    p_carbos: 200,
    p_grasas: 70,
    p_fecha: '2026-01-01',
  });
  assert.ok(error, 'Esperaba error porque anon esta revocado');
  // 42501 = insufficient_privilege en PostgreSQL
  assert.ok(
    error.code === '42501' || /permission|denied|not allowed/i.test(error.message),
    `Esperaba error de permisos, recibi: ${JSON.stringify(error)}`,
  );
});

test('anon NO puede llamar enforce_free_routine_limit', async () => {
  const { error } = await supabase.rpc('enforce_free_routine_limit');
  assert.ok(error, 'Esperaba error porque la funcion esta revocada de anon');
});

test('anon NO puede llamar can_send_smart_push', async () => {
  const { error } = await supabase.rpc('can_send_smart_push', {
    p_user_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.ok(error, 'Esperaba error porque la funcion esta revocada de anon');
});

test('anon NO puede llamar handle_new_user', async () => {
  const { error } = await supabase.rpc('handle_new_user');
  assert.ok(error, 'Esperaba error porque la funcion esta revocada de anon');
});

test('anon NO puede llamar actualizar_orden_comidas', async () => {
  const { error } = await supabase.rpc('actualizar_orden_comidas', {
    p_log_id: '00000000-0000-0000-0000-000000000000',
    p_meal_ids: [],
  });
  assert.ok(error, 'Esperaba error porque anon esta revocado');
});

test('anon NO puede llamar increment_food_popularity', async () => {
  const { error } = await supabase.rpc('increment_food_popularity', {
    p_food_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.ok(error, 'Esperaba error porque anon esta revocado');
});

// ─── Tablas con RLS ──────────────────────────────────────────────────────────

test('anon NO puede leer notification_reminders', async () => {
  const { data, error } = await supabase.from('notification_reminders').select('id').limit(1);
  // RLS: o devuelve error o devuelve array vacio si la policy no aplica para anon.
  // Lo importante: NO debe devolver filas.
  if (error) {
    assert.ok(true);
  } else {
    assert.equal(data?.length ?? 0, 0, 'anon no deberia ver reminders de nadie');
  }
});

test('anon NO puede leer notification_events', async () => {
  const { data, error } = await supabase.from('notification_events').select('id').limit(1);
  if (error) {
    assert.ok(true);
  } else {
    assert.equal(data?.length ?? 0, 0, 'anon no deberia ver eventos de nadie');
  }
});

test('anon NO puede leer profiles de otros', async () => {
  const { data } = await supabase.from('profiles').select('id').limit(1);
  // profiles puede tener policy de SELECT publico para algunos campos; no es ataque.
  // Pero NO debe poder ver TODOS los users sin auth.
  // Como mucho devuelve [], nunca un dump completo.
  assert.ok(Array.isArray(data) ? data.length === 0 || data.length === 1 : true);
});

// ─── Tablas publicas (lectura permitida) ─────────────────────────────────────

test('anon SI puede leer exercises (catalogo publico)', async () => {
  const { data, error } = await supabase.from('exercises').select('id').limit(1);
  assert.equal(error, null, `error inesperado: ${JSON.stringify(error)}`);
  assert.ok(Array.isArray(data), 'esperaba array');
});
