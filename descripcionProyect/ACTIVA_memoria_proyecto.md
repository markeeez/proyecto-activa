# ACTIVA — Memoria del proyecto

## Visión general

ACTIVA es una app de fitness y nutrición construida con **Expo (React Native)** y **Supabase (PostgreSQL)**. El objetivo es que sea una app funcional y bien construida desde el inicio, con margen para crecer.

Las funcionalidades principales son:
- Registro y seguimiento de nutrición diaria
- Registro y seguimiento de entrenamientos
- Seguimiento de métricas corporales (peso, grasa, etc.)
- Asistente de IA contextual por comida y entrenamiento
- Chat general con IA con historial
- Sistema de planes: free, plus y premium

---

## Stack tecnológico

- **Frontend:** Expo (React Native)
- **Backend / Base de datos:** Supabase (PostgreSQL)
- **Autenticación:** Supabase Auth
- **IA:** Anthropic API (Claude)

---

## Sistema de planes

| Plan | Acceso IA | Mensajes/mes | Historial mensajes |
|---|---|---|---|
| free | No | 0 | 0 |
| plus | Sí | 100 | 20 |
| premium | Sí | 1000 | 50 |

---

## Autenticación y usuarios

Supabase gestiona la autenticación con su tabla interna `auth.users`. La app extiende esto con una tabla `public.profiles` que se crea automáticamente mediante un trigger cuando el usuario se registra.

El campo `id` de `profiles` es el mismo `uuid` que genera Supabase Auth.

---

## Esquema de la base de datos

Todas las tablas tienen **Row Level Security (RLS)** activado. Cada usuario solo puede leer y escribir sus propios datos.

---

### `profiles`
Perfil público del usuario, vinculado a `auth.users`.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK, referencia a auth.users |
| username | text | único, obligatorio |
| nombre | text | obligatorio |
| apellidos | text | opcional |
| plan | text | 'free', 'plus', 'premium'. Default: 'free' |
| email_verified | boolean | default false |
| is_active | boolean | default true |
| created_at | timestamptz | automático |
| updated_at | timestamptz | automático via trigger |

**Triggers:**
- `on_profile_updated` → actualiza `updated_at` automáticamente
- `on_auth_user_created` → crea el perfil automáticamente al registrarse

---

### `user_goals`
Objetivos calóricos y de macros del usuario.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| objetivo | text | 'perder_peso', 'mantener', 'ganar_masa', 'mejorar_rendimiento' |
| calorias_objetivo | numeric(7,2) | |
| proteinas_objetivo | numeric(5,2) | |
| carbos_objetivo | numeric(5,2) | |
| grasas_objetivo | numeric(5,2) | |
| created_at | timestamptz | automático |

---

### `user_body_metrics`
Registro diario de métricas corporales.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| peso_kg | numeric(5,2) | |
| altura_cm | numeric(5,2) | |
| grasa_corporal | numeric(4,2) | porcentaje |
| fecha | date | default hoy |
| created_at | timestamptz | automático |

**Índice:** `(user_id, fecha desc)`

---

### `foods`
Alimentos del sistema. Pueden venir de una API externa (ej. FatSecret, Open Food Facts) o ser creados por el usuario. Los valores nutricionales son por 100g.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | text | obligatorio |
| api_source | text | nombre de la API origen |
| api_id | text | id en la API origen |
| calorias | numeric(7,2) | por 100g |
| proteinas | numeric(5,2) | por 100g |
| carbohidratos | numeric(5,2) | por 100g |
| grasas | numeric(5,2) | por 100g |
| fibra | numeric(5,2) | por 100g |
| azucar | numeric(5,2) | por 100g |
| is_custom | boolean | true si lo creó el usuario |
| created_by | uuid | FK → profiles |
| created_at | timestamptz | automático |

**Estrategia de caché:** cuando se busca un alimento de una API externa, se guarda en esta tabla para evitar llamadas repetidas. Se busca primero en BD local antes de llamar a la API.

**Índices:** `(nombre)`, `unique (api_source, api_id)`

**Políticas RLS actualizadas:**
- **Select:** alimentos del sistema (`is_custom = false` y `created_by = null`) visibles para todos los autenticados, más los propios personalizados.
- **Insert:** se permite insertar alimentos del sistema (sin `created_by`) o personalizados propios.
- **Update:** igual que select.
- **Delete:** solo alimentos personalizados propios.

---

### `meal_types`
Tipos de comida. Hay 4 predeterminadas del sistema y el usuario puede crear las suyas.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | text | obligatorio |
| orden | integer | orden de visualización |
| is_default | boolean | true para las 4 del sistema |
| user_id | uuid | FK → profiles (null para las predeterminadas) |
| created_at | timestamptz | automático |

**Valores predeterminados insertados:** Desayuno (1), Almuerzo (2), Merienda (3), Cena (4).

---

### `nutrition_logs`
Un registro por usuario por día. Es el contenedor del log diario de nutrición.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| fecha | date | default hoy |
| created_at | timestamptz | automático |

**Restricción:** `unique(user_id, fecha)` — solo un log por día por usuario.

**Índice:** `(user_id, fecha desc)`

---

### `nutrition_log_meals`
Comidas dentro del log diario. Cada una está asociada a un tipo de comida.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| log_id | uuid | FK → nutrition_logs |
| meal_type_id | uuid | FK → meal_types |
| created_at | timestamptz | automático |

---

### `nutrition_log_items`
Alimentos concretos dentro de una comida, con sus macros ya calculados según los gramos indicados.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| meal_id | uuid | FK → nutrition_log_meals |
| food_id | uuid | FK → foods |
| gramos | numeric(7,2) | cantidad consumida |
| calorias_calculadas | numeric(7,2) | calculado en app según gramos |
| proteinas_calculadas | numeric(5,2) | calculado en app según gramos |
| carbos_calculados | numeric(5,2) | calculado en app según gramos |
| grasas_calculadas | numeric(5,2) | calculado en app según gramos |

**Nota:** el balance diario total se calcula sumando los campos `_calculados` de todos los items del día, sin necesidad de tabla extra.

---

### `exercises`
Ejercicios del sistema. Pueden venir de una API externa o ser creados por el usuario.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | text | obligatorio |
| api_source | text | nombre de la API origen |
| api_id | text | id en la API origen |
| musculo_primario | text | obligatorio |
| musculos_secundarios | text[] | array de músculos secundarios |
| categoria | text | 'fuerza', 'cardio', 'flexibilidad', 'otro' |
| descripcion | text | opcional |
| is_custom | boolean | true si lo creó el usuario |
| created_by | uuid | FK → profiles |
| created_at | timestamptz | automático |

**Estrategia de caché:** igual que foods, se guarda al traerlo de la API.

**Índices:** `(nombre)`, `unique (api_source, api_id)`

---

### `workout_sessions`
Sesión de entrenamiento. Un usuario puede tener varias sesiones en el mismo día.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| nombre | text | opcional, ej: "Empuje", "Pierna" |
| fecha | date | default hoy |
| hora_inicio | time | opcional |
| hora_fin | time | opcional |
| notas | text | opcional |
| created_at | timestamptz | automático |

**Índice:** `(user_id, fecha desc)`

---

### `workout_session_exercises`
Ejercicios dentro de una sesión, en orden.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | FK → workout_sessions |
| exercise_id | uuid | FK → exercises |
| orden | integer | orden dentro de la sesión |
| notas | text | nota/comentario por ejercicio |

---

### `workout_sets`
Series de cada ejercicio en la sesión.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| session_exercise_id | uuid | FK → workout_session_exercises |
| numero_serie | integer | número de la serie |
| tipo_serie | text | 'normal', 'top_set', 'drop_set', 'calentamiento' |
| repeticiones | integer | opcional |
| peso_kg | numeric(6,2) | opcional (null si es bodyweight) |
| tipo_peso | text | 'kg', 'bodyweight', 'assisted' |
| duracion_seg | integer | opcional, para ejercicios por tiempo |
| descanso_seg | integer | opcional |
| completada | boolean | default false |

**Nota sobre peso:** si `tipo_peso` es `bodyweight`, `peso_kg` puede ser null. Si es `assisted`, `peso_kg` representa el peso de asistencia (negativo conceptualmente).

---

### `plan_limits`
Límites de cada plan. Solo lectura para usuarios autenticados.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| plan | text | único: 'free', 'plus', 'premium' |
| acceso_ia | boolean | |
| ai_mensajes_mes | integer | |
| ai_mensajes_historial | integer | |
| updated_at | timestamptz | |

---

### `ai_usage`
Control del consumo de mensajes de IA por usuario. Un registro por usuario.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles, único |
| mensajes_mes_actual | integer | se resetea cada mes |
| reset_fecha | date | fecha del último reset |
| updated_at | timestamptz | |

---

### `ai_chat_sessions`
Sesiones de chat con la IA. Pueden ser generales o estar ligadas a un contexto (una comida, un entreno, etc.).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| contexto_tipo | text | 'general', 'nutrition_log', 'workout_session', 'food', 'exercise' |
| contexto_id | uuid | id del elemento al que está ligado |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `ai_chat_messages`
Mensajes dentro de una sesión de chat.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | FK → ai_chat_sessions |
| rol | text | 'user' o 'assistant' |
| contenido | text | |
| created_at | timestamptz | |

**Historial limitado:** se guardan solo los últimos N mensajes según el plan del usuario (`ai_mensajes_historial` en `plan_limits`).

**Índice:** `(session_id, created_at asc)`

---

### `user_favorite_foods`
Tabla puente para alimentos favoritos del usuario.

| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid | PK parcial, FK → auth.users |
| food_id | uuid | PK parcial, FK → foods |
| created_at | timestamptz | automático |

**Clave primaria compuesta:** `(user_id, food_id)` — un usuario no puede marcar el mismo alimento como favorito dos veces.

**RLS:** el usuario solo puede ver, añadir y eliminar sus propios favoritos.

---

### `user_favorite_exercises`
Tabla puente para ejercicios favoritos del usuario.

| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid | PK parcial, FK → auth.users |
| exercise_id | uuid | PK parcial, FK → exercises |
| created_at | timestamptz | automático |

**Clave primaria compuesta:** `(user_id, exercise_id)` — un usuario no puede marcar el mismo ejercicio como favorito dos veces.

**RLS:** el usuario solo puede ver, añadir y eliminar sus propios favoritos.

---

### `exercise_progress_summary`
Vista materializada que precalcula la progresión de cada usuario por ejercicio y fecha. Se refresca automáticamente mediante un trigger cuando se marca un set como completado.

| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid | FK → profiles |
| exercise_id | uuid | FK → exercises |
| fecha | date | fecha de la sesión |
| mejor_peso_kg | numeric | máximo peso levantado en esa sesión |
| mejores_repeticiones | integer | máximo de repeticiones en esa sesión |
| volumen_total_kg | numeric | suma de (peso × reps) de todos los sets |
| total_series | integer | número de series completadas |
| session_id | uuid | sesión de origen |

**Tipo:** vista materializada — datos precalculados para consultas rápidas.

**Índices:** `(user_id, exercise_id, fecha desc)`, `(exercise_id, fecha desc)`

**Trigger:** `on_set_completed` → se dispara al insertar o actualizar un set con `completada = true`, refrescando la vista automáticamente.

---

### `ai_notes`
Notas generadas por la IA y guardadas en un contexto concreto (una comida, un entreno, un alimento o ejercicio).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| contexto_tipo | text | 'nutrition_log', 'workout_session', 'food', 'exercise' |
| contexto_id | uuid | id del elemento relacionado |
| contenido | text | resumen o nota generada |
| created_at | timestamptz | |

**Índice:** `(user_id, contexto_tipo, contexto_id)`

---

## Relaciones clave

```
auth.users
    └── profiles
            ├── user_goals
            ├── user_body_metrics
            ├── foods (created_by)
            │       └── user_favorite_foods ── profiles
            ├── exercises (created_by)
            │       └── user_favorite_exercises ── profiles
            ├── meal_types (user_id, nullable para defaults)
            ├── nutrition_logs
            │       └── nutrition_log_meals
            │               └── nutrition_log_items ── foods
            ├── workout_sessions
            │       └── workout_session_exercises ── exercises
            │               └── workout_sets
            │                       └── exercise_progress_summary (vista materializada)
            ├── ai_usage
            ├── ai_chat_sessions
            │       └── ai_chat_messages
            └── ai_notes
```

---

## Decisiones de diseño importantes

1. **Caché de API:** los alimentos y ejercicios traídos de APIs externas se guardan en BD la primera vez que se usan. Esto evita llamadas repetidas y protege el historial si la API cambia.

2. **Balance diario de nutrición:** no hay tabla extra para el balance. Se calcula en tiempo real sumando los campos `_calculados` de `nutrition_log_items` del día.

3. **Múltiples sesiones por día:** un usuario puede tener varias `workout_sessions` en el mismo día, ya que la unidad es la sesión, no el día.

4. **Ejercicios sin peso:** `peso_kg` es nullable. El campo `tipo_peso` indica si es `kg`, `bodyweight` o `assisted`.

5. **Comidas predeterminadas:** las 4 comidas del sistema tienen `user_id = null` y `is_default = true`. Las personalizadas tienen `user_id` del usuario y `is_default = false`.

6. **RLS en todas las tablas:** activado desde el principio. Cada usuario solo accede a sus datos. Los alimentos y ejercicios no personalizados son visibles para todos.

7. **IA contextual vs chat general:** el campo `contexto_tipo` + `contexto_id` en `ai_chat_sessions` y `ai_notes` permite ligar cualquier conversación o nota a cualquier elemento de la app sin duplicar tablas.

8. **Límites de IA dinámicos:** los límites están en la tabla `plan_limits`, no hardcodeados en el código. Si se quieren cambiar los límites de un plan, basta con actualizar esa tabla.

9. **Progresión de ejercicios mediante vista materializada:** en lugar de calcular la progresión en tiempo real (costoso a escala), se usa una vista materializada `exercise_progress_summary` que precalcula el mejor peso, mejores repeticiones y volumen total por usuario, ejercicio y fecha. Se refresca automáticamente al completar cualquier set, manteniendo los datos siempre actualizados sin coste en las consultas.
