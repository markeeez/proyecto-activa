# ACTIVA — Structured Improvement Report
**Date:** April 22, 2026 | **Stack:** Expo (React Native) · Supabase (PostgreSQL + Auth) · Anthropic API

---

## 1. Database Performance

### Finding 1-A: Daily nutrition view fires 3–5 sequential DB round-trips before the main query
**Severity:** 🔴 Critical  
**Impact:** Every time a user opens the nutrition screen, `obtenerResumenDiaNutricion` chains: (1) a SELECT + optional INSERT for `asegurarLogDiario`, (2) a COUNT + optional INSERT for `asegurarComidasPredeterminadasSiVacias`, (3) a full SELECT + potential N×(UPDATE + DELETE) loop inside `consolidarDuplicadosSlotsPredeterminadosLog`, and (4) the actual join query. On a cold path, this is 4–8 sequential network calls to Supabase on every screen load. On a slow mobile connection this manifests as a visible loading delay every time the user visits the Home tab.  
**Proposed solution:** `consolidarDuplicadosSlotsPredeterminadosLog` should not be called on every read. Run it only after a write that could introduce duplicates (specifically after `asegurarComidasPredeterminadasSiVacias`), or add a boolean flag on `nutrition_logs` (e.g., `needs_dedup`) that is set on suspect operations and cleared after consolidation. The log-creation and default-meals-creation guards can also be collapsed into a single SQL function (SECURITY DEFINER RPC) that does both atomically, eliminating two round-trips.

### Finding 1-B: `obtenerAnteriorPorEjercicio` loads all users' completed sets for an exercise into the client
**Severity:** 🔴 Critical  
**Impact:** The query on `workout_sets` filters by `exercise_id` at the DB level but applies no `user_id` filter in SQL. Every completed set across all users for a given exercise is returned; the service then filters for `user_id` in JavaScript. As the user base grows this query returns an unbounded result set. It also violates data isolation expectations — cross-user set data transits the client.  
**Proposed solution:** Push `user_id` equality into the PostgREST query via an `eq('workout_session_exercises.workout_sessions.user_id', userId)` filter before the JS filter, or rewrite as an RPC that joins `workout_sessions.user_id = auth.uid()` server-side. RLS alone is insufficient here because the join traverses through `workout_session_exercises` to `workout_sessions`.

### Finding 1-C: `obtenerVolumenSemanaKg` loads all nested exercises and sets for the week and aggregates in JS
**Severity:** 🟡 Medium  
**Impact:** For an active user with 5–7 sessions per week, each session containing 5–8 exercises with 3–5 sets, this pulls 75–280 set rows across the network just to compute a single `volumenKg` number. This scales linearly with training frequency.  
**Proposed solution:** Replace with a Supabase RPC (`SECURITY DEFINER` function) that runs `SUM(peso_kg * repeticiones)` in Postgres filtered by `user_id`, `fecha BETWEEN` and `completada = true`. One round-trip instead of a deeply nested join.

### Finding 1-D: `actualizarOrdenComidas` fires N independent UPDATE statements in parallel
**Severity:** 🟡 Medium  
**Impact:** Reordering 4 meals dispatches 4 concurrent UPDATEs with no transaction boundary. If one fails midway, the order is left in a partially-updated state with no rollback.  
**Proposed solution:** Use a single `CASE`-based UPDATE or an RPC that receives `[(id, orden)]` and updates all rows in one statement under a transaction.

### Finding 1-E: Missing indexes on critical read paths
**Severity:** 🟡 Medium  
**Impact:** Sequential scans on tables with no composite indexes will slow queries as data grows. Key candidates with no confirmed index: `nutrition_logs(user_id, fecha)`, `nutrition_log_meals(log_id)`, `nutrition_log_items(meal_id)`, `workout_sessions(user_id, fecha)`, `workout_sets(session_exercise_id)`, `ai_chat_messages(session_id, created_at)`, `ai_usage(user_id)`.  
**Proposed solution:** Add composite indexes on the foreign-key + filter columns for each of these tables. In particular `(user_id, fecha)` on `nutrition_logs` and `workout_sessions` are the most critical since they are the entry points for every daily read.

---

## 2. Search & Lookup Patterns

### Finding 2-A: Text search uses chained `ilike` with no trigram index — full sequential scan per word
**Severity:** 🔴 Critical  
**Impact:** `buscarFoodsPorTextoLibre` chains multiple `.ilike('nombre', '%word%')` filters, each requiring Postgres to do a full scan of the `foods` table (which will grow substantially as users cache USDA/OFF results). The same pattern exists in `ejerciciosService.buscarEjercicios`. There are no `pg_trgm` GIN indexes on `foods.nombre` or `exercises.nombre`. At 50k+ food rows, each search will noticeably degrade.  
**Proposed solution:** Enable the `pg_trgm` extension and create GIN indexes on `foods.nombre` and `exercises.nombre`. This allows Postgres to use the index for `ilike '%term%'` patterns and makes multi-word AND searches fast.

### Finding 2-B: Every search keystroke fires up to 3 parallel Supabase queries + 2 external API calls + 1 LibreTranslate call
**Severity:** 🟡 Medium  
**Impact:** `buscarAlimento` for a single query dispatches: 3 parallel `buscarFoodsPorTextoLibre` calls (norm, raw, anchor variants), 1 LibreTranslate HTTP call, 1 USDA API HTTP call, 1 Open Food Facts HTTP call, and then a `cargarPopularidadPorIds` query. There is no debounce in the service layer (debounce may exist in the UI, but the service itself has no protection). If the UI debounce is removed or bypassed, this is 7 concurrent external requests per keypress.  
**Proposed solution:** The anchor query with a large limit (up to 800 rows) can be replaced with the trigram index (Finding 2-A). The LibreTranslate call result should be memoized per session for the same query string. Consider a server-side search RPC that consolidates the multi-source query logic and reduces round-trips to 1.

### Finding 2-C: `foods-upsert-global` Edge Function uses SELECT-then-INSERT/UPDATE instead of a true UPSERT — race condition on concurrent searches
**Severity:** 🔴 Critical  
**Impact:** The Edge Function for caching USDA/OFF results does `SELECT id WHERE api_source=X AND api_id=Y`, then branches to INSERT or UPDATE. Two concurrent searches for the same food (e.g., two users searching "pollo" simultaneously) can both execute the SELECT and find no existing row, both attempt an INSERT, and one will fail with a unique constraint violation. The function catches this silently and returns `null` for that item. The user then gets no result for a food that should have been cached, degrading the search experience silently.  
**Proposed solution:** Replace the SELECT + INSERT/UPDATE pattern with a single Postgres `INSERT ... ON CONFLICT (api_source, api_id) DO UPDATE SET ...` statement. This is atomic and eliminates the race condition entirely. The Edge Function's per-item loop with `admin.from('foods').insert(rowPayload)` can be simplified to a single batch upsert call.

### Finding 2-D: `obtenerRecientes` performs a 3-level deep join from `nutrition_log_items` through meals to logs to filter by user
**Severity:** 🟡 Medium  
**Impact:** The "recent foods" query fetches 80 nutrition_log_items rows (including a join through `nutrition_log_meals.nutrition_logs` to filter by `user_id`) then deduplicates to 20 foods in JS. The join depth means Postgres must traverse three tables, and 80 rows with nested joins cross the wire to deduplicate in the client.  
**Proposed solution:** This is a candidate for a dedicated RPC that uses a `DISTINCT ON (food_id)` or a `ROW_NUMBER() OVER (PARTITION BY food_id ORDER BY item.id DESC)` approach to return just 20 recent distinct food rows in one SQL call.

---

## 3. RLS & Security

### Finding 3-A: RLS UPDATE policies grant access to role `public` instead of `authenticated`
**Severity:** 🔴 Critical  
**Impact:** Three SQL scripts (`nutrition_log_items_rls_update.sql`, `nutrition_log_meals_rls_update.sql`, `nutrition_logs_rls_update_excluded.sql`) create policies with `TO public`. In Postgres, the `public` role includes unauthenticated connections (the `anon` role inherits from `public`). While the `USING` clause checks `auth.uid()` (which returns NULL for anonymous requests and thus denies access), this is an unintended surface that can cause confusion, may behave differently under future Supabase auth changes, and is inconsistent with best practices. It also means any future policy referencing `public` without a proper USING guard would expose the data.  
**Proposed solution:** Change all three policies from `TO public` to `TO authenticated`. Authenticated-only policies are the correct and intended pattern for user-owned data in Supabase.

### Finding 3-B: `obtenerAnteriorPorEjercicio` bypasses intended data isolation at the application layer
**Severity:** 🔴 Critical  
**Impact:** As noted in 1-B, completed sets from other users for the same exercise are fetched and then filtered in JavaScript. RLS should prevent this — but the filter chain (workout_sets → workout_session_exercises → workout_sessions) may not be fully enforced by RLS on intermediate tables if policies on `workout_sets` only check `session_exercise_id` ownership without verifying the parent session's `user_id`. If RLS on `workout_sets` does not enforce user ownership transitively, this is a data leak.  
**Proposed solution:** Verify that the RLS policy on `workout_sets` performs the transitive user check through the join chain to `workout_sessions.user_id = auth.uid()`. If not, add an RPC with `SECURITY DEFINER` that enforces the filter server-side.

### Finding 3-C: `ai_usage` write exposure — no RLS policies visible in codebase
**Severity:** 🔴 Critical  
**Impact:** The `iaService.enviarMensaje` stub plans to `UPDATE ai_usage SET mensajes_mes_actual += 1` directly from the client. If RLS on `ai_usage` allows authenticated users to UPDATE any row (or is not yet configured), a user could update their own counter downward (to extend their monthly limit) or update another user's counter. No migration or RLS policy for `ai_usage` is present in the reviewed SQL files.  
**Proposed solution:** `ai_usage` writes should only happen via a `SECURITY DEFINER` RPC that increments the counter atomically and verifies the request is for the calling user. The table should have no direct UPDATE policy for the `authenticated` role. Additionally, implement the monthly reset check inside the RPC using `DATE_TRUNC('month', reset_fecha) < DATE_TRUNC('month', NOW())` to avoid the client-side race condition.

### Finding 3-D: `foods` SELECT policy covers only `is_custom = false AND created_by IS NULL` for global foods
**Severity:** 🟢 Low  
**Impact:** The SELECT policy allows viewing foods where `is_custom = false AND created_by IS NULL` OR `created_by = auth.uid()`. There is no enforced constraint preventing a global food from having `created_by` set to a non-null value. If such a row exists (e.g., a data error or a future feature that attributes global foods), it would be invisible to users other than the attributed creator. This is a logic gap, not an immediate security issue.  
**Proposed solution:** Add a DB-level CHECK constraint: `CHECK ((is_custom = true AND created_by IS NOT NULL) OR (is_custom = false AND created_by IS NULL))` to enforce the invariant that global foods always have `created_by = NULL`.

---

## 4. AI System Design

### Finding 4-A: The entire `iaService` is unimplemented (all methods return null/false)
**Severity:** 🔴 Critical  
**Impact:** Every method in `ia.service.ts` is a TODO stub. `puedeEnviarMensaje` always returns `false`, `enviarMensaje` always returns `null`, `obtenerSesionGeneral` always returns `null`. Any screen that depends on the AI assistant is completely non-functional regardless of the user's subscription plan.  
**Proposed solution:** This is a priority implementation task. The implementation design is documented in the stubs and is coherent — the risk is not in the design but in the missing code. See Findings 4-B through 4-D for design issues to address during implementation.

### Finding 4-B: Monthly usage reset is vulnerable to race conditions
**Severity:** 🔴 Critical  
**Impact:** The planned `puedeEnviarMensaje` logic reads `mensajes_mes_actual`, checks against the plan limit, and if the month has changed, resets the counter. If two messages are sent concurrently (possible with fast tapping or from two devices), both can read `mensajes_mes_actual = N` (below limit), both pass the check, and both increment — resulting in over-consumption. Additionally, the month-reset logic (read current reset_fecha → compare → update) is a three-step client-side operation with no atomicity guarantee.  
**Proposed solution:** Implement usage increment and limit check as a single `SECURITY DEFINER` Postgres function that uses `SELECT ... FOR UPDATE` or `UPDATE ... WHERE` with a conditional expression. The function should atomically: (1) reset the counter if `DATE_TRUNC('month', reset_fecha) < DATE_TRUNC('month', NOW())`, (2) check the count against the plan limit, (3) increment if allowed, and (4) return a boolean. This eliminates all race conditions.

### Finding 4-C: Context hydration cost per chat turn is unbounded
**Severity:** 🟡 Medium  
**Impact:** The `enviarMensaje` stub plans to pass the full `historial` array to the Edge Function on every turn. The history limit is controlled by `ai_mensajes_historial` from `plan_limits`, but this value must be fetched first (another DB call). For a premium user with a high history limit, the message array grows linearly, increasing both the DB read cost and the Claude API token cost per turn. There's no compression or summarization strategy defined.  
**Proposed solution:** Define a clear truncation strategy before implementation: always send the last N messages from `plan_limits.ai_mensajes_historial`, fetching them with `ORDER BY created_at DESC LIMIT N` and reversing. For future optimization, consider a summary message injected at the truncation boundary. This should be documented as a contract in the service, not left implicit.

### Finding 4-D: `plan_limits` has no fallback if the row for a plan doesn't exist in the DB
**Severity:** 🟡 Medium  
**Impact:** `obtenerLimitesPlan` queries `plan_limits WHERE plan = plan`. If the row for 'free', 'plus', or 'premium' has not been seeded, the function returns null. Any downstream consumer that doesn't handle null will crash silently or use permissive defaults. There is no seed migration for `plan_limits` visible in the codebase.  
**Proposed solution:** Provide a hardcoded constant fallback object for each plan in the service layer (e.g., `DEFAULT_PLAN_LIMITS: Record<Plan, PlanLimit>`). This acts as a safe default if the DB row is missing and makes the fallback explicit and auditable. Add a seed migration to insert the three plan rows on deploy.

---

## 5. Data Integrity

### Finding 5-A: Stored macros in `nutrition_log_items` go stale when food rows are updated
**Severity:** 🔴 Critical  
**Impact:** When a user logs food, `calorias_calculadas`, `proteinas_calculadas`, etc. are computed from the food's current macros and stored on the item. However, `foods-upsert-global` unconditionally updates (`UPDATE ... SET nombre=..., calorias=..., ...`) existing food rows when they're re-fetched from USDA or Open Food Facts. This silently overwrites the macros a user's past log items were computed from, but the `_calculadas` columns on those items are not recalculated. A user's historical calorie totals will silently become inconsistent with their food data.  
**Proposed solution:** Either (a) make the upsert in `foods-upsert-global` non-destructive for macros (only update `nombre` and metadata, not macro values once a food has been used in any log item), or (b) add a database trigger on `foods` UPDATE that recalculates and updates all `nutrition_log_items` referencing that `food_id`. Option (a) is simpler and safer. The Edge Function should check if the food has been referenced and skip the macro update if so.

### Finding 5-B: `workout_sessions` cascade deletes are not configured — manual cascade in application code
**Severity:** 🟡 Medium  
**Impact:** `eliminarEntreno` catches FK constraint violations and manually cascades deletes: sets → session_exercises → session. This means that if a future table is added with an FK to `workout_session_exercises` or `workout_sets`, the manual cascade will be incomplete and the deletion will fail. The pattern also means deleting a session requires 3+ round-trips instead of 1.  
**Proposed solution:** Add `ON DELETE CASCADE` to the FK on `workout_sets.session_exercise_id` → `workout_session_exercises.id`, and `ON DELETE CASCADE` on `workout_session_exercises.session_id` → `workout_sessions.id`. The manual cascade code in `eliminarEntreno` can then be removed. The same review should be done for `routine_exercises` → `routines` and `routine_sets` → `routine_exercises`.

### Finding 5-C: `pegarAlimentosEnComida` uses sequential `await` in a loop instead of parallel writes
**Severity:** 🟡 Medium  
**Impact:** Pasting a clipboard of 5 foods into a meal fires 5 sequential insert operations (each waits for the previous). This adds latency that scales linearly with clipboard size.  
**Proposed solution:** Refactor to collect all items and call `supabase.from('nutrition_log_items').insert(allItems)` in a single batch INSERT. All calculated macro columns should be pre-computed before the insert.

### Finding 5-D: `workout_sets.peso_kg` nullability contract is not enforced in the DB
**Severity:** 🟢 Low  
**Impact:** `peso_kg` is nullable (correct for bodyweight/assisted sets), but there's no CHECK constraint enforcing that `tipo_peso = 'kg'` requires `peso_kg IS NOT NULL`. A logged set with `tipo_peso = 'kg'` and `peso_kg = NULL` will silently contribute 0 to volume calculations.  
**Proposed solution:** Add `CHECK ((tipo_peso IN ('bodyweight', 'assisted')) OR (tipo_peso = 'kg' AND peso_kg IS NOT NULL))`.

---

## 6. Schema Extensibility

### Finding 6-A: `contexto_tipo` in `ai_chat_sessions` and `ai_notes` is free text with no DB constraint
**Severity:** 🟡 Medium  
**Impact:** TypeScript types it as `ContextoIA = 'general' | 'nutrition_log' | 'workout_session' | 'food' | 'exercise'`, but if there's no CHECK constraint in the DB, any string can be inserted (e.g., via direct SQL, a future admin tool, or a bug in the client). Queries that switch on `contexto_tipo` in the AI context-hydration logic will silently produce wrong results for unknown values rather than failing fast.  
**Proposed solution:** Create a Postgres enum type `contexto_ia_type` with the 5 values and use it for the column, or add a CHECK constraint. Since the set of context types is small and changes rarely, a native enum is the cleanest solution.

### Finding 6-B: `objetivo` in `user_goals`, `categoria` in `exercises`, and `source_kind` in `foods` are unconstrained text columns
**Severity:** 🟡 Medium  
**Impact:** All three are typed as TS enums/union types on the client but lack DB-level constraints. Data entered via any path other than the typed client (direct SQL, migrations, future integrations) can insert arbitrary values. `categoria` is used in exercise filter queries; an unexpected value will silently produce wrong filter behavior. `source_kind` is used in the search ranking algorithm (`tierBoost`); an unknown value falls through to the default tier score.  
**Proposed solution:** Add CHECK constraints for `objetivo` and `categoria`. For `source_kind`, since it's intentionally extensible (the TypeScript type is defined as `| string`), document the known values explicitly and add a COMMENT on the column listing the canonical set.

### Finding 6-C: `food_tier` has a CHECK constraint — this is the correct pattern and should be the model for other fields
**Severity:** 🟢 Low (positive finding)  
**Impact:** No degradation. `food_tier CHECK (food_tier IN ('master', 'reference', 'brand'))` correctly enforces the enum at the DB level.  
**Proposed solution:** Use this as the reference pattern when adding constraints to the fields in 6-A and 6-B.

---

## 7. Mobile / Offline Considerations

### Finding 7-A: App is fully online-first with no offline queue — silent data loss when network is unavailable
**Severity:** 🟡 Medium  
**Impact:** All nutrition logging and workout tracking operations are direct Supabase calls with no offline queue, local-first data store, or retry mechanism. If a user logs food or a workout set during a brief connectivity loss, the operation fails and the data is lost. There is no user feedback mechanism to indicate the failure beyond the thrown error reaching a catch block in the UI.  
**Proposed solution:** For the current stack, a pragmatic approach (without full offline-first architecture) is to implement a lightweight pending-operations queue in AsyncStorage. Operations that fail due to network errors are queued locally and retried on reconnect. `@react-native-community/netinfo` can detect connectivity. This is a significant feature but has high user-impact for a fitness app where users often train in areas with poor signal.

### Finding 7-B: USDA and Open Food Facts API calls have no per-request timeout
**Severity:** 🟡 Medium  
**Impact:** `_buscarUsdaFoundation` and `_buscarOpenFoodFacts` use bare `fetch()` with no `AbortController` timeout. On a slow mobile connection, these calls can hang indefinitely, blocking the search results from appearing. The 55-second timeout on the `foods-upsert-global` Edge Function invocation is set, but the external API calls within the client have no equivalent.  
**Proposed solution:** Wrap all external `fetch` calls with an `AbortController` and a timeout (e.g., 8 seconds for search, 12 seconds for detail fetches). The USDA detail-fetch inside `_buscarUsdaFoundation` (called per-result when macros are missing) is especially risky as it can fire multiple times per search.

### Finding 7-C: Subscription plan enforcement is deferred — `obtenerLimitesPlan` and `puedeEnviarMensaje` always return permissive values
**Severity:** 🔴 Critical  
**Impact:** Since all `iaService` methods are stubs, there is currently no subscription gate on AI features. When implementation begins, the plan check relies on `profiles.plan` which is set on signup and updated client-side. There is no server-side enforcement mechanism visible. A user who manipulates their local `plan` value could bypass limits.  
**Proposed solution:** Plan enforcement should be done server-side in the AI Edge Function (or the usage RPC from 4-B): read `profiles.plan` with `auth.uid()` inside the DB function, look up `plan_limits`, and reject the request if the limit is exceeded. Never trust a plan value sent from the client.

### Finding 7-D: No cache invalidation for food macros after a background upsert
**Severity:** 🟢 Low  
**Impact:** When `foods-upsert-global` updates a food's macros (even if Finding 5-A is resolved by skipping macro updates), the client may hold a stale copy of the food object in React state or local cache. The food data shown in the search results or food detail screen may differ from what's in the DB until next app reload.  
**Proposed solution:** After a successful `_guardarEnCache` call, use the returned DB row (which has the canonical data) to replace any in-memory copy rather than using the partial local object. This is already partially done — the Edge Function returns the full row — but consumers should ensure they update state with the returned DB row, not the input partial.

---

## 8. Quick Wins

### Finding 8-A: No `UNIQUE(user_id, fecha)` constraint on `nutrition_logs`
**Severity:** 🔴 Critical  
**Impact:** `asegurarLogDiario` does SELECT + INSERT in two steps with no transaction. On fast navigation or concurrent calls (e.g., push notification loading the screen while the user navigates), two INSERT attempts for the same (user_id, fecha) can succeed before either sees the other's row, creating duplicate logs. The user's food items are then split across two log rows and one set becomes invisible.  
**Proposed solution:** Add `UNIQUE(user_id, fecha)` to `nutrition_logs`. Then change `asegurarLogDiario` to use `INSERT ... ON CONFLICT (user_id, fecha) DO NOTHING RETURNING *`, falling back to a SELECT if the INSERT returns no row. This is a safe, one-line migration.

### Finding 8-B: `TO public` → `TO authenticated` in 3 RLS policies (see 3-A) — one-line fixes
**Severity:** 🔴 Critical  
**Impact:** As described in Finding 3-A.  
**Proposed solution:** Three single-line changes across `nutrition_log_items_rls_update.sql`, `nutrition_log_meals_rls_update.sql`, `nutrition_logs_rls_update_excluded.sql`.

### Finding 8-C: `pegarAlimentosEnComida` sequential loop → batch INSERT (see 5-C)
**Severity:** 🟡 Medium  
**Impact:** As described in Finding 5-C.  
**Proposed solution:** Pre-compute all rows, call a single `insert([...rows])`.

### Finding 8-D: Seed migration for `plan_limits` is missing
**Severity:** 🟡 Medium  
**Impact:** The AI feature cannot function without plan limit rows in the DB. This is a blocking dependency for the AI implementation (Finding 4-A).  
**Proposed solution:** Add a migration that inserts the three rows for 'free', 'plus', and 'premium' plans with sensible defaults (e.g., free: 10 messages/month, 10 history; plus: 50/20; premium: 200/50). These can be changed later via the admin dashboard.

### Finding 8-E: `ejerciciosService.buscarEjercicios` does not push `user_id` filter for custom exercises
**Severity:** 🟢 Low  
**Impact:** In `modoLista = 'creados'`, the query should filter `created_by = userId`. This relies on correct parameter passing from the call site. If `userId` is null when fetching custom exercises, the filter is silently skipped and no custom exercises are returned (empty state rather than an error). The failure mode is a blank list, not a data leak.  
**Proposed solution:** Add a guard: if `modoLista === 'creados'` and `userId` is null, return early with an empty array and log a warning.

---

## Priority Matrix

| # | Finding | Severity | Effort | Recommended Order |
|---|---------|----------|--------|-------------------|
| 3-A | RLS `TO public` → `TO authenticated` | 🔴 Critical | 🟢 Low | 1 |
| 8-A | Add `UNIQUE(user_id, fecha)` to `nutrition_logs` | 🔴 Critical | 🟢 Low | 2 |
| 2-C | Race condition in `foods-upsert-global` (SELECT+INSERT → true UPSERT) | 🔴 Critical | 🟢 Low | 3 |
| 3-C | `ai_usage` write exposure — add RLS + SECURITY DEFINER RPC | 🔴 Critical | 🟡 Medium | 4 |
| 4-D | Seed `plan_limits` rows (blocking AI implementation) | 🟡 Medium | 🟢 Low | 5 |
| 1-E | Add missing composite indexes | 🟡 Medium | 🟢 Low | 6 |
| 5-A | Protect food macros from silent overwrites in `foods-upsert-global` | 🔴 Critical | 🟡 Medium | 7 |
| 1-A | Collapse nutrition daily view round-trips (consolidate + dedup guard) | 🔴 Critical | 🟡 Medium | 8 |
| 1-B | Push `user_id` filter to DB in `obtenerAnteriorPorEjercicio` | 🔴 Critical | 🟡 Medium | 9 |
| 8-C | Batch INSERT in `pegarAlimentosEnComida` | 🟡 Medium | 🟢 Low | 10 |
| 4-A | Implement `iaService` (all stubs) | 🔴 Critical | 🔴 High | 11 |
| 4-B | Atomic usage increment + monthly reset RPC | 🔴 Critical | 🟡 Medium | 12 (during 4-A) |
| 7-C | Server-side plan enforcement in AI Edge Function | 🔴 Critical | 🟡 Medium | 13 (during 4-A) |
| 5-B | Add `ON DELETE CASCADE` to workout FK chain | 🟡 Medium | 🟢 Low | 14 |
| 2-A | Add `pg_trgm` GIN index on `foods.nombre` and `exercises.nombre` | 🔴 Critical | 🟡 Medium | 15 |
| 5-D | CHECK constraint on `workout_sets.peso_kg` nullability | 🟢 Low | 🟢 Low | 16 |
| 6-A | DB constraint on `contexto_tipo` (Postgres enum or CHECK) | 🟡 Medium | 🟢 Low | 17 |
| 6-B | CHECK constraints on `objetivo`, `categoria`, `source_kind` | 🟡 Medium | 🟢 Low | 18 |
| 1-C | Replace JS volume aggregation with DB `SUM()` RPC | 🟡 Medium | 🟡 Medium | 19 |
| 2-B | Memoize LibreTranslate result per session; server-side search RPC | 🟡 Medium | 🔴 High | 20 |
| 1-D | Batch `actualizarOrdenComidas` into single SQL statement | 🟡 Medium | 🟡 Medium | 21 |
| 7-B | Add `AbortController` timeout to external API calls | 🟡 Medium | 🟢 Low | 22 |
| 2-D | Rewrite `obtenerRecientes` as RPC with `DISTINCT ON` | 🟡 Medium | 🟡 Medium | 23 |
| 4-C | Document and enforce message history truncation strategy | 🟡 Medium | 🟢 Low | 24 (during 4-A) |
| 3-B | Verify RLS transitive chain on `workout_sets` | 🔴 Critical | 🟡 Medium | 25 |
| 3-D | CHECK constraint: global foods must have `created_by = NULL` | 🟢 Low | 🟢 Low | 26 |
| 7-A | Offline queue with AsyncStorage + retry | 🟡 Medium | 🔴 High | 27 |
| 8-E | Guard in `buscarEjercicios` for null `userId` in 'creados' mode | 🟢 Low | 🟢 Low | 28 |
| 7-D | Replace stale in-memory food object with returned DB row | 🟢 Low | 🟢 Low | 29 |
| 4-D | Hardcoded `DEFAULT_PLAN_LIMITS` fallback in service | 🟡 Medium | 🟢 Low | 30 |

---
Mejorar velocidad carga
Empezar rutina
Buscar alimento
Buscar ejercicio
*Report generated from static analysis of the ACTIVA codebase. No code was modified.*
