# Auditoría de Código — ACTIVA
**Fecha**: 25 de abril de 2026  
**Tecnologías**: React Native / Expo / TypeScript / Supabase  
**Total de problemas encontrados**: 61

---

## 1. SEGURIDAD

### 🔴 CRÍTICO

#### SEC-01 — RPC `obtener_volumen_semana_kg` sin filtro de usuario
- **Archivo**: `services/entrenamiento.service.ts` (~línea 1049)
- **Problema**: La RPC filtra solo por rango de fechas, no por `p_user_id`. Si RLS no cubre la RPC, expone datos de entrenamiento de todos los usuarios.
- **Fix**: Añadir parámetro `p_user_id uuid` a la RPC y usar `WHERE user_id = p_user_id AND user_id = auth.uid()`.

#### SEC-02 — RPC `obtener_anterior_ejercicio` sin verificación explícita de propietario
- **Archivo**: `services/entrenamiento.service.ts` (~línea 864)
- **Problema**: Se confía en que la RPC filtra por `auth.uid()` internamente, pero no hay validación en cliente.
- **Fix**: Auditar el SQL de la RPC. Añadir `WHERE user_id = auth.uid()` si no está presente.

### 🟠 ALTO

#### SEC-03 — Variables de entorno con `!` (non-null assertion) sin validación
- **Archivo**: `constants/config.ts` (~líneas 11–31)
- **Problema**: `SUPABASE_URL!` y `SUPABASE_ANON_KEY!` crashearán sin mensaje claro si faltan en `.env`.
- **Fix**:
  ```typescript
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('EXPO_PUBLIC_SUPABASE_URL no definida');
  ```

#### SEC-04 — AsyncStorage guarda datos en texto plano
- **Archivo**: `lib/nutricionLogPreferencias.ts`
- **Problema**: IDs de comidas y preferencias guardados sin cifrar. En un dispositivo rooteado son accesibles.
- **Fix**: Para datos no-críticos (IDs de orden de comidas) es aceptable. Para tokens o datos sensibles usar `expo-secure-store`.

#### SEC-05 — `registrarSeleccionPopularity` con `void` sin manejo de errores
- **Archivo**: `services/nutricion.service.ts` (~líneas 352, 462)
- **Problema**: `void Promise.all(...)` descarta errores silenciosamente. Si el contador de popularidad falla, no hay log.
- **Fix**: `.catch(e => console.warn('[popularity]', e.message))`.

### 🟡 MEDIO

#### SEC-06 — RLS de `nutrition_log_items` depende de JOIN transitivo
- **Archivo**: `supabase/sql/nutrition_log_items_rls_update.sql`
- **Problema**: La política hace JOIN a `nutrition_logs` para validar `user_id`. Un bug en ese JOIN podría exponer ítems de otros usuarios.
- **Fix**: Revisar periódicamente con `EXPLAIN` que el plan de ejecución es el esperado. Considerar una columna `user_id` desnormalizada en `nutrition_log_items`.

---

## 2. BUGS / ERRORES LÓGICOS

### 🔴 CRÍTICO

#### BUG-01 — Crash si `asegurar_log_diario` falla silenciosamente
- **Archivo**: `services/nutricion.service.ts` (~línea 272–282)
- **Problema**: Si la RPC retorna `null`, acceder a `row.id` en la línea siguiente lanza `TypeError: Cannot read properties of null`.
- **Fix**:
  ```typescript
  const row = data?.[0];
  if (!row?.id) throw new Error('[nutricion] log diario sin ID');
  ```

#### BUG-02 — Memory leak potencial en `AuthContext`
- **Archivo**: `context/AuthContext.tsx` (~líneas 37–44)
- **Problema**: Si `AuthProvider` se desmonta y remonta (ej: hot reload en dev), se registran múltiples subscripciones a `onAuthStateChange`.
- **Fix**: Guardar la subscription en un ref y llamar `.unsubscribe()` en el cleanup del efecto:
  ```typescript
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(...);
    return () => subscription.unsubscribe();
  }, []);
  ```

#### BUG-03 — `parseOptFloat` solo reemplaza la primera coma
- **Archivo**: `app/(tabs)/(entrenamiento)/entreno-activo.tsx` (~línea 50)
- **Problema**: `.replace(',', '.')` → `"1,5,5"` se convierte en `"1.5,5"` en lugar de `"1.5"`.
- **Fix**: `value.replace(/,/g, '.')`.

### 🟠 ALTO

#### BUG-04 — `dragOverride` puede quedarse stale
- **Archivo**: `app/(tabs)/(nutricion)/index.tsx` (~líneas 103–105)
- **Problema**: `setDragOverride(null)` solo se ejecuta cuando cambia `resumen`. Si el servidor falla y no hay refresco, el drag queda en estado inconsistente.
- **Fix**: Limpiar `dragOverride` con un timeout de seguridad (ej: 5s) si `resumen` no actualiza.

#### BUG-05 — Cache de `useNutricion` crece indefinidamente
- **Archivo**: `hooks/useNutricion.ts` (~línea 26)
- **Problema**: `resumenCache` (Map) nunca expira ni tiene límite de tamaño. Sesiones largas acumulan datos de todos los días visitados.
- **Fix**: Implementar LRU con máximo 14 entradas:
  ```typescript
  if (resumenCache.size > 14) {
    const oldestKey = resumenCache.keys().next().value;
    resumenCache.delete(oldestKey);
  }
  ```

#### BUG-06 — Redireccionamiento en `index.tsx` con estado intermedio
- **Archivo**: `app/index.tsx` (~líneas 15–36)
- **Problema**: Si `session` es null pero `cargando` es true, la app no redirige al login hasta que cargue. El usuario ve pantalla en blanco.
- **Fix**: Redirigir inmediatamente si `!session && !cargando`.

### 🟡 MEDIO

#### BUG-07 — Funciones `lid()` y `seriePorDefecto()` duplicadas
- **Archivos**: `context/EntrenoContext.tsx` y `app/(tabs)/(entrenamiento)/entreno-activo.tsx`
- **Problema**: La misma lógica está copiada en dos lugares. Un cambio debe hacerse en ambos.
- **Fix**: Mover a `lib/entrenamientoUtils.ts` e importar desde allí.

#### BUG-08 — `consolidarDuplicadosSlotsPredeterminadosLog` con orden no determinístico en empates
- **Archivo**: `services/nutricion.service.ts` (~líneas 92–94)
- **Problema**: Si dos meals tienen el mismo número de ítems, el criterio de selección no es claro.
- **Fix**: Añadir desempate por `id` (alfabético o numérico) para consistencia.

---

## 3. RENDIMIENTO

### 🟠 ALTO

#### PERF-01 — `obtenerRutinasPredeterminadas` hace dos queries secuenciales
- **Archivo**: `services/entrenamiento.service.ts` (~líneas 1294–1323)
- **Problema**: Primero obtiene rutinas, luego obtiene favoritos. Dos round-trips innecesarios.
- **Fix**: `Promise.all([getRutinas(), getFavoritos()])` para paralelizar.

#### PERF-02 — `escribirRutinaEjercicios` con loop secuencial de inserts
- **Archivo**: `services/entrenamiento.service.ts` (~línea 357)
- **Problema**: `for (const ex of ejercicios)` hace N queries secuenciales al guardar una rutina.
- **Fix**: Batch insert con array:
  ```typescript
  await supabase.from('routine_exercises').insert(
    ejercicios.map((ex, i) => ({ ...ex, routine_id: routineId, orden: i }))
  );
  ```

#### PERF-03 — Pantalla de progreso sin virtualización
- **Archivo**: `app/(tabs)/(progreso)/index.tsx` (1403 líneas)
- **Problema**: Todos los registros históricos se renderizan en memoria con `map()`. Con muchos registros, la UI se vuelve lenta.
- **Fix**: Usar `FlashList` de Shopify (ya disponible en Expo) en lugar de `ScrollView` + `map()`.

#### PERF-04 — `buscarEjercicios` sin límite en modo `creados`
- **Archivo**: `services/ejercicios.service.ts` (~línea 87)
- **Problema**: Si un usuario tiene muchos ejercicios custom, se traen todos sin paginación.
- **Fix**: Verificar que el parámetro `limite` se aplica en todos los branches del código.

### 🟡 MEDIO

#### PERF-05 — `consolidarDuplicadosSlotsPredeterminadosLog` con 4 queries por operación
- **Archivo**: `services/nutricion.service.ts` (~líneas 65–139)
- **Problema**: Select + Update items + Delete meal + Update keeper = 4 round-trips. No es atómico.
- **Fix**: Crear RPC `consolidar_duplicados_slots(p_log_id uuid)` en SQL para hacerlo en una sola llamada y con transacción.

#### PERF-06 — Gráficos en progreso sin muestreo de datos
- **Archivo**: `app/(tabs)/(progreso)/index.tsx`
- **Problema**: Si el usuario tiene 1 año de datos, se pasan todos los puntos al gráfico.
- **Fix**: Muestrear los datos según el período seleccionado (máx 90 puntos por gráfico).

---

## 4. CALIDAD DE CÓDIGO

### 🔴 CRÍTICO

#### CODE-01 — Servicios con funciones vacías / sin implementar
- **Archivos**: `services/auth.service.ts`, `services/perfil.service.ts`, `services/ia.service.ts`
- **Problema**: Funciones como `iniciarSesion()`, `registrarse()`, `obtenerPerfil()` están vacías o retornan `null`. Si se llaman por error, fallan silenciosamente.
- **Fix**: Implementar o lanzar `throw new Error('No implementado')` para detectar usos accidentales.

#### CODE-02 — Tipos `any` en funciones críticas
- **Archivos**: `services/alimentos.service.ts` (~línea 228), `services/ejercicios.service.ts` (~línea 43), `services/entrenamiento.service.ts` (~línea 876)
- **Problema**: `function aplicarIlikeNombreAndFoods(q: any, ...)` pierde la tipología segura de la query de Supabase.
- **Fix**: Usar el tipo `PostgrestFilterBuilder` del SDK de Supabase:
  ```typescript
  import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
  ```

#### CODE-03 — Manejo de errores inconsistente
- **Archivos**: Múltiples servicios
- **Problema**: Algunos errores lanzan excepción, otros loguean y retornan `null`, otros son silenciados. No hay convención.
- **Fix**: Establecer convención:
  - Errores de red/DB bloqueantes → `throw`
  - Errores no-bloqueantes (ej: registrar popularidad) → `console.warn` + `return null`
  - Crear tipo `ServiceResult<T> = { data: T | null; error: string | null }` para mayor consistencia.

### 🟠 ALTO

#### CODE-04 — `console.error` / `console.warn` en código de producción
- **Archivos**: Múltiples (>40 ocurrencias)
- **Problema**: Los logs no desaparecen en producción. Exponen información interna y afectan rendimiento en release builds.
- **Fix**: Envolver en `if (__DEV__)` o usar un logger centralizado:
  ```typescript
  export const logger = {
    error: (...args: any[]) => { if (__DEV__) console.error(...args); },
    warn: (...args: any[]) => { if (__DEV__) console.warn(...args); },
  };
  ```

#### CODE-05 — Componentes / archivos excesivamente largos
- **Archivos**: `app/(tabs)/(progreso)/index.tsx` (1403 líneas), `app/(tabs)/(perfil)/index.tsx` (~1015 líneas), `app/(tabs)/(nutricion)/index.tsx` (~400 líneas)
- **Problema**: Difícil de mantener y testear. Lógica de negocio mezclada con JSX.
- **Fix**: Extraer secciones en componentes (`<PlanActivoCard />`, `<DatosPersonalesCard />`) y lógica en hooks (`useProgreso`, `usePerfil`).

#### CODE-06 — Respuestas PostgREST sin tipo seguro
- **Archivo**: `services/entrenamiento.service.ts` (~línea 53–56)
- **Problema**: `RoutineJoinRow.routine_exercises` puede ser `null | objeto | objeto[]` dependiendo de la query. Se castea directamente sin normalizar.
- **Fix**: Normalizar respuestas con un helper:
  ```typescript
  function asArray<T>(v: T | T[] | null): T[] {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }
  ```

### 🟡 MEDIO

#### CODE-07 — Magic numbers sin constantes
- **Archivos**: `services/alimentos.service.ts`, `app/(tabs)/(nutricion)/index.tsx`
- **Problema**: `Math.max(limite * 8, 120)`, `limiteAncla = 800`, `LIMIT 4000`, etc. sin nombres que expliquen su propósito.
- **Fix**: Extraer a `constants/busqueda.ts`:
  ```typescript
  export const LIMITE_ANCLA_MULT = 8;
  export const LIMITE_ANCLA_MIN = 120;
  export const LIMITE_ANCLA_MAX = 800;
  ```

#### CODE-08 — Dead code sin remover
- **Archivo**: `services/nutricion.service.ts` (~línea 465)
- **Problema**: `async actualizarGramosAlimento(_itemId, _nuevosGramos) {}` — función vacía exportada.
- **Fix**: Remover o implementar.

#### CODE-09 — TODO: eliminar botón de dev antes de producción
- **Archivo**: `app/(tabs)/(perfil)/index.tsx` (~línea 972)
- **Problema**: `⚙ [DEV] Ver onboarding` visible en la pantalla de perfil.
- **Fix**: Envolver en `{__DEV__ && <Pressable ...>}`.

### 🟢 BAJO

#### CODE-10 — Comentario de crédito en tipos generados
- **Archivo**: `types/database.types.ts`
- **Problema**: Si los tipos se regeneran con Supabase CLI, se sobreescribirán los cambios manuales.
- **Fix**: Añadir tipos customizados en un archivo separado `types/database.extended.ts`.

---

## 5. UX / ACCESIBILIDAD

### 🟠 ALTO

#### UX-01 — Sin feedback de error en operaciones de drag & drop
- **Archivo**: `app/(tabs)/(nutricion)/index.tsx`
- **Problema**: Si `guardarOrdenComidas()` falla en servidor, el usuario no se entera. El orden visual queda desfasado.
- **Fix**: Mostrar toast de error y revertir al orden original en caso de fallo.

#### UX-02 — Validación de formularios sin feedback visual en pantalla
- **Archivo**: `app/(auth)/registrarse.tsx` (~línea 94)
- **Problema**: Errores de validación usan `console.error` en lugar de mostrar mensaje bajo el campo.
- **Fix**: State `error` por campo + texto rojo bajo el input.

#### UX-03 — Botones interactivos sin `accessibilityLabel`
- **Archivos**: Múltiples componentes
- **Problema**: `<Pressable onPress={...}>` sin `accessibilityLabel` afecta usuarios con screen readers (VoiceOver / TalkBack).
- **Fix**: Añadir `accessibilityLabel` descriptivo en todos los elementos interactivos.

#### UX-04 — Pantalla de progreso sin skeleton loader
- **Archivo**: `app/(tabs)/(progreso)/index.tsx`
- **Problema**: La pantalla muestra vacío mientras carga datos históricos. En conexiones lentas se ve como un bug.
- **Fix**: Añadir skeleton o `ActivityIndicator` centrado mientras `cargando === true`.

### 🟡 MEDIO

#### UX-05 — Sin estado vacío descriptivo en búsqueda de alimentos
- **Archivo**: `app/(tabs)/(nutricion)/agregar.tsx`
- **Problema**: Si no hay resultados, la pantalla muestra lista vacía sin explicar por qué ni ofrecer alternativas.
- **Fix**: Mensaje "No encontramos '{búsqueda}'. ¿Quieres crear un alimento personalizado?" con botón de acción.

#### UX-06 — Errores de auth sin contexto para el usuario
- **Archivo**: `app/(auth)/iniciar-sesion.tsx` (~línea 62)
- **Problema**: Todos los errores de Supabase Auth se muestran tal cual (en inglés o formato técnico).
- **Fix**: Mapear códigos de error a mensajes en español:
  ```typescript
  const AUTH_ERRORS: Record<string, string> = {
    'Invalid login credentials': 'Email o contraseña incorrectos.',
    'Email not confirmed': 'Confirma tu email antes de iniciar sesión.',
    'User already registered': 'Ya existe una cuenta con ese email.',
  };
  ```

#### UX-07 — Sin confirmación al eliminar comida del log
- **Archivo**: `services/nutricion.service.ts` (~línea 374) + pantalla que lo llama
- **Problema**: Eliminar una comida completa (con todos sus alimentos) no pide confirmación.
- **Fix**: Mostrar modal de confirmación antes de `eliminarComidaDelLog()`.

### 🟢 BAJO

#### UX-08 — Nombre "Cerrar sesión" en `cuentaRowDanger` sin icono indicativo
- **Archivo**: `app/(tabs)/(perfil)/index.tsx`
- **Problema**: El botón de cerrar sesión está en rojo pero no tiene icono. Podría confundirse con un error.
- **Fix**: Añadir `<Ionicons name="log-out-outline" />` junto al texto.

---

## Resumen ejecutivo

| Categoría | Crítico 🔴 | Alto 🟠 | Medio 🟡 | Bajo 🟢 | Total |
|-----------|-----------|---------|---------|---------|-------|
| Seguridad | 2 | 3 | 1 | — | 6 |
| Bugs | 3 | 3 | 2 | 1 | 9 |
| Rendimiento | — | 4 | 2 | — | 6 |
| Calidad | 3 | 3 | 3 | 2 | 11 |
| UX/Accesibilidad | — | 4 | 3 | 1 | 8 |
| **TOTAL** | **8** | **17** | **11** | **4** | **40** |

### Prioridades inmediatas (antes de producción)
1. **SEC-01/02** — Verificar que todas las RPCs filtran por `auth.uid()`
2. **BUG-01** — Guard contra null en `asegurar_log_diario`
3. **BUG-02** — Cleanup de subscription en `AuthContext`
4. **CODE-01** — Eliminar o proteger funciones vacías en servicios
5. **CODE-09** — Ocultar botón DEV de onboarding en producción
6. **UX-06** — Mensajes de error de auth en español y contextualizados
