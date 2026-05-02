# Informe del proyecto Supabase: ACTIVA

Generado el 2026-05-02 desde el proyecto `ylhzkdzmhaifzyairthz`.

## Resumen

- URL del proyecto: `https://ylhzkdzmhaifzyairthz.supabase.co`
- Ref / ID: `ylhzkdzmhaifzyairthz`
- Nombre: `ACTIVA`
- Organización: `yuoansxvrotfrniacshm`
- Región: `eu-central-1`
- Estado: `ACTIVE_HEALTHY`
- Base de datos: PostgreSQL `17.6.1.084`, engine `17`, release channel `ga`
- Creado: `2026-04-01T20:09:21.718692Z`
- Esquemas detectados: `auth`, `extensions`, `graphql`, `graphql_public`, `public`, `realtime`, `storage`, `vault`
- Migraciones registradas por el conector MCP: ninguna en `supabase_migrations`
- Workspace local actual: sin archivos de proyecto detectados al inicio del análisis

## Claves públicas

Estas claves son publicables o `anon`; no son `service_role` ni claves secretas.

- Publishable key activa: `sb_publishable_FbuduCIlMOFBh5MJJhPjXw_xmwqN91p`
- Legacy anon key activa: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...v04BPHLHW8UV1mzrzx_H7ffQ5HI1zTDYEXHoTuRvH-0`

## Modelo funcional

El proyecto parece una app de salud/fitness con estos módulos:

- Perfiles y planes: `profiles`, `plan_limits`, `ai_usage`
- Objetivos y métricas corporales: `user_goals`, `user_body_metrics`
- Nutrición: `foods`, `meal_types`, `nutrition_logs`, `nutrition_log_meals`, `nutrition_log_items`, `food_search_popularity`, favoritos
- Entrenamiento: `exercises`, `workout_sessions`, `workout_session_exercises`, `workout_sets`, `routines`, `routine_exercises`, `routine_sets`, favoritos
- IA: `ai_chat_sessions`, `ai_chat_messages`, `ai_notes`, límites de plan/uso
- Storage: buckets públicos para avatares e imágenes de ejercicios

## Tablas públicas

Todas las tablas del esquema `public` tienen RLS activado.

| Tabla | Filas estimadas | Descripción rápida |
| --- | ---: | --- |
| `ai_chat_messages` | 0 | Mensajes de sesiones IA |
| `ai_chat_sessions` | 0 | Sesiones de chat IA por usuario y contexto |
| `ai_notes` | 0 | Notas IA asociadas a entidades |
| `ai_usage` | 0 | Uso mensual de IA por usuario |
| `exercises` | 1325 | Catálogo de ejercicios |
| `food_search_popularity` | 12 | Popularidad de alimentos seleccionados |
| `foods` | 474 | Catálogo de alimentos y macros |
| `meal_types` | 4 | Tipos/slots de comida |
| `nutrition_log_items` | 26 | Alimentos dentro de comidas diarias |
| `nutrition_log_meals` | 160 | Comidas de un log diario |
| `nutrition_logs` | 61 | Logs diarios de nutrición |
| `plan_limits` | 3 | Límites por plan |
| `profiles` | 1 | Perfil de usuario |
| `routine_exercises` | 128 | Ejercicios dentro de rutinas |
| `routine_sets` | 421 | Series previstas dentro de rutinas |
| `routines` | 23 | Rutinas |
| `user_body_metrics` | 25 | Métricas corporales |
| `user_favorite_exercises` | 2 | Favoritos de ejercicios |
| `user_favorite_foods` | 1 | Favoritos de alimentos |
| `user_favorite_routines` | 3 | Favoritos de rutinas |
| `user_goals` | 1 | Objetivos nutricionales/corporales |
| `workout_session_exercises` | 2 | Ejercicios realizados en sesiones |
| `workout_sessions` | 1 | Sesiones de entrenamiento |
| `workout_sets` | 4 | Series realizadas |

## Columnas por tabla

### `ai_chat_messages`

- `id uuid not null default gen_random_uuid()`
- `session_id uuid not null`
- `rol text not null`
- `contenido text not null`
- `created_at timestamp with time zone not null default now()`

### `ai_chat_sessions`

- `id uuid not null default gen_random_uuid()`
- `user_id uuid not null`
- `contexto_tipo text`
- `contexto_id uuid`
- `created_at timestamp with time zone not null default now()`
- `updated_at timestamp with time zone not null default now()`

### `ai_notes`

- `id uuid not null default gen_random_uuid()`
- `user_id uuid not null`
- `contexto_tipo text not null`
- `contexto_id uuid not null`
- `contenido text not null`
- `created_at timestamp with time zone not null default now()`

### `ai_usage`

- `id uuid not null default gen_random_uuid()`
- `user_id uuid not null`
- `mensajes_mes_actual integer not null default 0`
- `reset_fecha date not null default date_trunc('month', CURRENT_DATE)`
- `updated_at timestamp with time zone not null default now()`

### `exercises`

- `id uuid not null default gen_random_uuid()`
- `nombre text not null`
- `api_source text`
- `api_id text`
- `musculo_primario text not null`
- `musculos_secundarios text[]`
- `categoria text`
- `descripcion text`
- `is_custom boolean not null default false`
- `created_by uuid`
- `created_at timestamp with time zone not null default now()`
- `equipamiento text`
- `foto_url text`
- `dificultad text`

### `food_search_popularity`

- `food_id uuid not null`
- `selection_count integer not null default 0`
- `last_selected_at timestamp with time zone not null default now()`

### `foods`

- `id uuid not null default gen_random_uuid()`
- `nombre text not null`
- `api_source text`
- `api_id text`
- `calorias numeric not null default 0`
- `proteinas numeric not null default 0`
- `carbohidratos numeric not null default 0`
- `grasas numeric not null default 0`
- `fibra numeric default 0`
- `azucar numeric default 0`
- `is_custom boolean not null default false`
- `created_by uuid`
- `created_at timestamp with time zone not null default now()`
- `food_tier text default 'reference'`
- `source_kind text`
- `verified_basic boolean default false`

### `meal_types`

- `id uuid not null default gen_random_uuid()`
- `nombre text not null`
- `orden integer not null default 0`
- `is_default boolean not null default false`
- `user_id uuid`
- `created_at timestamp with time zone not null default now()`

### `nutrition_log_items`

- `id uuid not null default gen_random_uuid()`
- `meal_id uuid not null`
- `food_id uuid not null`
- `gramos numeric not null default 100`
- `calorias_calculadas numeric not null default 0`
- `proteinas_calculadas numeric not null default 0`
- `carbos_calculados numeric not null default 0`
- `grasas_calculadas numeric not null default 0`

### `nutrition_log_meals`

- `id uuid not null default gen_random_uuid()`
- `log_id uuid not null`
- `meal_type_id uuid`
- `created_at timestamp with time zone not null default now()`
- `custom_label text`
- `display_orden integer`
- `meal_slot text`
- `nombre text not null`
- `orden integer not null`
- `is_default boolean not null default false`

### `nutrition_logs`

- `id uuid not null default gen_random_uuid()`
- `user_id uuid not null`
- `fecha date not null default CURRENT_DATE`
- `created_at timestamp with time zone not null default now()`
- `excluded_meal_type_ids uuid[] not null default '{}'`
- `excluded_meal_slots text[] not null default '{}'`

### `plan_limits`

- `id uuid not null default gen_random_uuid()`
- `plan text not null`
- `acceso_ia boolean not null default false`
- `ai_mensajes_mes integer not null default 0`
- `ai_mensajes_historial integer not null default 0`
- `updated_at timestamp with time zone not null default now()`

### `profiles`

- `id uuid not null`
- `username text not null`
- `nombre text not null`
- `apellidos text`
- `plan text not null default 'free'`
- `email_verified boolean not null default false`
- `is_active boolean not null default true`
- `created_at timestamp with time zone not null default now()`
- `updated_at timestamp with time zone not null default now()`
- `genero text`
- `edad integer`
- `altura_cm numeric`
- `factor_actividad numeric`

### `routine_exercises`

- `id uuid not null default gen_random_uuid()`
- `routine_id uuid not null`
- `exercise_id uuid not null`
- `orden integer not null default 0`
- `notas text`
- `created_at timestamp with time zone not null default now()`

### `routine_sets`

- `id uuid not null default gen_random_uuid()`
- `routine_exercise_id uuid not null`
- `numero_serie integer not null`
- `tipo_serie text not null default 'lineal'`
- `reps integer`
- `peso_kg numeric`
- `tipo_peso text not null default 'kg'`
- `created_at timestamp with time zone not null default now()`

### `routines`

- `id uuid not null default gen_random_uuid()`
- `nombre text not null`
- `descripcion text`
- `foto_url text`
- `is_default boolean not null default false`
- `is_public boolean not null default false`
- `created_by uuid`
- `created_at timestamp with time zone not null default now()`
- `updated_at timestamp with time zone not null default now()`
- `dificultad text`

### `user_body_metrics`

- `id uuid not null default gen_random_uuid()`
- `user_id uuid not null`
- `peso_kg numeric`
- `altura_cm numeric`
- `grasa_corporal numeric`
- `fecha date not null default CURRENT_DATE`
- `created_at timestamp with time zone not null default now()`

### `user_favorite_exercises`

- `user_id uuid not null`
- `exercise_id uuid not null`
- `created_at timestamp with time zone not null default now()`

### `user_favorite_foods`

- `user_id uuid not null`
- `food_id uuid not null`
- `created_at timestamp with time zone not null default now()`

### `user_favorite_routines`

- `user_id uuid not null`
- `routine_id uuid not null`
- `created_at timestamp with time zone not null default now()`

### `user_goals`

- `id uuid not null default gen_random_uuid()`
- `user_id uuid not null`
- `objetivo text`
- `calorias_objetivo numeric`
- `proteinas_objetivo numeric`
- `carbos_objetivo numeric`
- `grasas_objetivo numeric`
- `created_at timestamp with time zone not null default now()`
- `peso_objetivo numeric`

### `workout_session_exercises`

- `id uuid not null default gen_random_uuid()`
- `session_id uuid not null`
- `exercise_id uuid not null`
- `orden integer not null default 0`
- `notas text`

### `workout_sessions`

- `id uuid not null default gen_random_uuid()`
- `user_id uuid not null`
- `nombre text`
- `fecha date not null default CURRENT_DATE`
- `hora_inicio timestamp with time zone`
- `hora_fin timestamp with time zone`
- `notas text`
- `created_at timestamp with time zone not null default now()`
- `routine_id uuid`

### `workout_sets`

- `id uuid not null default gen_random_uuid()`
- `session_exercise_id uuid not null`
- `numero_serie integer not null default 1`
- `tipo_serie text not null default 'normal'`
- `repeticiones integer`
- `peso_kg numeric`
- `tipo_peso text not null default 'kg'`
- `duracion_seg integer`
- `descanso_seg integer`
- `completada boolean not null default false`

## Relaciones principales

- `profiles.id` referencia usuarios de Supabase Auth.
- `user_goals.user_id`, `user_body_metrics.user_id`, `ai_usage.user_id`, `ai_chat_sessions.user_id`, `ai_notes.user_id`, `nutrition_logs.user_id`, `workout_sessions.user_id`, `routines.created_by`, `foods.created_by` y `exercises.created_by` apuntan a `profiles.id`.
- Nutrición:
  - `nutrition_logs` -> `nutrition_log_meals` -> `nutrition_log_items`
  - `nutrition_log_items.food_id` -> `foods.id`
  - `nutrition_log_meals.meal_type_id` -> `meal_types.id`
  - `food_search_popularity.food_id` -> `foods.id`
  - `user_favorite_foods.food_id` -> `foods.id`
- Entrenamiento:
  - `workout_sessions` -> `workout_session_exercises` -> `workout_sets`
  - `workout_session_exercises.exercise_id` -> `exercises.id`
  - `routines` -> `routine_exercises` -> `routine_sets`
  - `routine_exercises.exercise_id` -> `exercises.id`
  - `workout_sessions.routine_id` -> `routines.id`
  - `user_favorite_exercises.exercise_id` -> `exercises.id`
  - `user_favorite_routines.routine_id` -> `routines.id`

## Edge Functions

| Función | Estado | Versión | JWT requerido | Última actualización |
| --- | --- | ---: | --- | --- |
| `foods-upsert-global` | `ACTIVE` | 21 | `false` | `1777054048764` |
| `fatsecret-search` | `ACTIVE` | 27 | `false` | `1775172950924` |

Notas:

- Ambas funciones tienen `verify_jwt=false`. Si se exponen a clientes o internet, conviene confirmar que implementan autenticación propia, validación de origen, rate limits o una razón clara para ser públicas.
- `foods-upsert-global` usa import map (`deno.json`).
- `fatsecret-search` no usa import map.

## Funciones SQL/RPC propias destacadas

Funciones de negocio en `public`:

- `actualizar_orden_comidas(p_log_id uuid, p_meal_ids uuid[]) returns void`, `plpgsql`, `SECURITY DEFINER`
- `asegurar_log_diario(p_user_id uuid, p_fecha date) returns jsonb`, `plpgsql`, `SECURITY DEFINER`
- `consolidar_duplicados_slots(p_log_id uuid) returns void`, `plpgsql`
- `handle_new_user() returns trigger`, `plpgsql`, `SECURITY DEFINER`
- `handle_updated_at() returns trigger`, `plpgsql`
- `increment_food_popularity(p_food_id uuid) returns void`, `plpgsql`, `SECURITY DEFINER`
- `obtener_anterior_ejercicio(p_exercise_id uuid) returns table(peso_kg numeric, repeticiones integer, tipo_peso text)`, `sql`
- `obtener_recientes_usuario(p_user_id uuid) returns setof foods`, `sql`, `SECURITY DEFINER`
- `obtener_volumen_semana_kg(p_user_id uuid, p_fecha_inicio date, p_fecha_fin date) returns numeric`, `sql`
- `rls_auto_enable() returns event_trigger`, `plpgsql`, `SECURITY DEFINER`
- `update_updated_at_column() returns trigger`, `plpgsql`

También aparecen funciones internas de `pg_trgm` en el esquema `public` porque la extensión está instalada ahí.

## Triggers

- `profiles.on_profile_updated`: `BEFORE UPDATE`, ejecuta `handle_updated_at()`
- `routines.on_routine_updated`: `BEFORE UPDATE`, ejecuta `update_updated_at_column()`

## Storage

| Bucket | Público | Objetos | Tamaño aprox. | Límite | MIME permitidos |
| --- | --- | ---: | ---: | ---: | --- |
| `avatars` | sí | 1 | 1,597,661 bytes | 5,242,880 bytes | `image/jpeg`, `image/png`, `image/webp` |
| `exercise-images` | sí | 1324 | 128,741,397 bytes | sin límite configurado | sin restricción configurada |

Políticas detectadas en `storage.objects`:

- `Avatar público para todos`: permite `SELECT` público para `bucket_id = 'avatars'`
- `Usuario sube su propio avatar`: permite `INSERT` autenticado en carpeta del propio `auth.uid()`
- `Usuario actualiza su propio avatar`: permite `UPDATE` autenticado en carpeta del propio `auth.uid()`

## Extensiones instaladas

- `pg_stat_statements` en `extensions`, versión `1.11`
- `uuid-ossp` en `extensions`, versión `1.1`
- `supabase_vault` en `vault`, versión `0.3.1`
- `pg_trgm` en `public`, versión `1.6`
- `plpgsql` en `pg_catalog`, versión `1.0`
- `pgcrypto` en `extensions`, versión `1.3`

El listado del conector también muestra muchas extensiones disponibles pero no instaladas, como `postgis`, `vector`, `pg_cron`, `pg_graphql`, `pg_net`, `pgmq`, etc.

## Índices destacados

- Búsqueda:
  - `idx_foods_nombre_trgm` en `foods(nombre gin_trgm_ops)`
  - `idx_exercises_nombre_trgm` en `exercises(nombre gin_trgm_ops)`
  - índices btree por `nombre`, `categoria`, `equipamiento`, `musculo_primario`
- Unicidad:
  - `profiles.username`
  - `ai_usage.user_id`
  - `user_goals.user_id`
  - `user_body_metrics(user_id, fecha)`
  - `nutrition_logs(user_id, fecha)` aparece duplicado con dos constraints/índices equivalentes
  - favoritos con PK compuesta por usuario y entidad
- Orden/consulta:
  - `routine_exercises(routine_id, orden)`
  - `routine_sets(routine_exercise_id, numero_serie)`
  - `ai_chat_messages(session_id, created_at)`
  - logs/sesiones por `user_id, fecha`

## RLS y políticas

Patrón general:

- Las tablas de usuario usan `auth.uid() = user_id` o `auth.uid() = created_by`.
- Catálogos como `foods` y `exercises` permiten ver registros públicos (`is_custom=false`) y registros propios.
- Rutinas permiten acceso a rutinas públicas o propias.
- Tablas hijas usan `EXISTS` hacia la tabla padre para comprobar propiedad del usuario.
- `plan_limits` permite `SELECT` a usuarios autenticados.

Políticas con atención especial:

- `foods` tiene políticas duplicadas/solapadas para `authenticated` y `public`.
- `nutrition_log_items` tiene más de una política permisiva para `UPDATE`.
- `routine_exercises` y `routine_sets` tienen políticas permisivas múltiples para `SELECT`.
- Muchas políticas evalúan `auth.uid()` por fila; Supabase recomienda usar `(select auth.uid())` en políticas de alto volumen para mejorar rendimiento.

## Avisos de seguridad

Avisos detectados por Supabase Advisors:

- Funciones sin `search_path` fijo:
  - `public.consolidar_duplicados_slots`
  - `public.update_updated_at_column`
  - `public.handle_updated_at`
  - `public.handle_new_user`
- Extensión instalada en `public`:
  - `pg_trgm`
- Bucket público con listado amplio:
  - `avatars`, política `Avatar público para todos`
- Funciones `SECURITY DEFINER` ejecutables por `anon`:
  - `actualizar_orden_comidas`
  - `asegurar_log_diario`
  - `handle_new_user`
  - `increment_food_popularity`
  - `obtener_recientes_usuario`
  - `rls_auto_enable`
- Funciones `SECURITY DEFINER` ejecutables por `authenticated`:
  - `actualizar_orden_comidas`
  - `asegurar_log_diario`
  - `handle_new_user`
  - `increment_food_popularity`
  - `obtener_recientes_usuario`
  - `rls_auto_enable`
- Protección contra contraseñas filtradas desactivada en Auth.

URLs de remediación de Supabase:

- `function_search_path_mutable`: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- `extension_in_public`: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
- `public_bucket_allows_listing`: https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing
- `anon_security_definer_function_executable`: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- `authenticated_security_definer_function_executable`: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Password security: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Avisos de rendimiento

Principales hallazgos de Supabase Advisors:

- Foreign keys sin índice de cobertura:
  - `ai_chat_sessions.ai_chat_sessions_user_id_fkey`
  - `exercises.exercises_created_by_fkey`
  - `foods.foods_created_by_fkey`
  - `meal_types.meal_types_user_id_fkey`
  - `nutrition_log_items.nutrition_log_items_food_id_fkey`
  - `nutrition_log_meals.nutrition_log_meals_meal_type_id_fkey`
  - `routine_exercises.routine_exercises_exercise_id_fkey`
  - `user_favorite_exercises.user_favorite_exercises_exercise_id_fkey`
  - `user_favorite_foods.user_favorite_foods_food_id_fkey`
  - `user_favorite_routines.user_favorite_routines_routine_id_fkey`
  - `workout_sessions.workout_sessions_routine_id_fkey`
- Políticas RLS con `auth.uid()`/`auth.role()` evaluado por fila en tablas como `profiles`, `user_goals`, `user_body_metrics`, `foods`, `meal_types`, `ai_chat_sessions`, etc.
- Índices duplicados:
  - `public.exercises`: `exercises_nombre_idx` y `idx_exercises_nombre`
  - `public.nutrition_logs`: `nutrition_logs_user_fecha_key` y `nutrition_logs_user_id_fecha_key`
  - `public.workout_sessions`: `idx_workout_sessions_user_id_fecha` y `workout_sessions_user_id_fecha_idx`
- Índices no usados reportados:
  - `exercises_nombre_idx`
  - `ai_chat_messages_session_id_created_at_idx`
  - `ai_notes_user_id_contexto_tipo_contexto_id_idx`
  - `food_search_popularity_count_idx`
  - `idx_exercises_categoria`
  - `idx_exercises_nombre_trgm`
  - `idx_user_goals_user_id_created_at`
  - `idx_workout_sessions_user_id_fecha`
  - `idx_workout_session_exercises_session_id`
  - `idx_workout_session_exercises_exercise_id`
  - `idx_foods_nombre_trgm`
- Políticas permisivas múltiples en `foods`, `nutrition_log_items`, `routine_exercises` y `routine_sets`.

URLs de remediación:

- `unindexed_foreign_keys`: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- `auth_rls_initplan`: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
- `unused_index`: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- `multiple_permissive_policies`: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
- `duplicate_index`: https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index

## Recomendaciones prioritarias

1. Revisar todas las funciones `SECURITY DEFINER` en `public`. Si no deben ser llamadas por clientes, revocar `EXECUTE` para `anon`/`authenticated` o moverlas a un esquema privado.
2. Fijar `search_path` en funciones `plpgsql`, especialmente triggers y funciones `SECURITY DEFINER`.
3. Confirmar si `foods-upsert-global` y `fatsecret-search` deben estar con `verify_jwt=false`; si no, activar JWT.
4. Corregir el bucket `avatars` si no quieres permitir listado público de todos los archivos.
5. Añadir índices a foreign keys sin cobertura que se consulten o modifiquen con frecuencia.
6. Consolidar índices duplicados antes de eliminar nada: verificar uso real en producción y dejar solo una variante.
7. Optimizar políticas RLS de alto tráfico usando `(select auth.uid())` donde aplique.
8. Considerar mover `pg_trgm` fuera de `public` si quieres limpiar el aviso de seguridad de extensión pública.
9. Activar protección de contraseñas filtradas en Supabase Auth.

## Notas de alcance

- No se exportaron datos sensibles de tablas de usuario; el informe describe estructura, recuentos aproximados y configuración.
- Los recuentos son estimaciones de estadísticas de PostgreSQL o agregados de Storage.
- El conector de ramas devolvió error interno al listar branches: `Project reference is missing when validating permissions`.
- El informe no modifica la base de datos.
