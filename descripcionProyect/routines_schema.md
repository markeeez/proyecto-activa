# ACTIVA — Esquema de Rutinas

## Visión general

El sistema de rutinas se divide en dos capas bien separadas:

- **Capa de plantilla:** `routines`, `routine_exercises`, `routine_sets` — definen qué ejercicios y series componen una rutina, con pesos y reps opcionales como referencia.
- **Capa de ejecución:** `workout_sessions`, `workout_session_exercises`, `workout_sets` — registran lo que el usuario hizo realmente cuando ejecutó un entreno. Ya existían, ahora se vinculan a una rutina mediante `routine_id`.
- **Capa social:** `user_favorite_routines` — permite a cada usuario marcar rutinas como favoritas.

La separación entre plantilla y ejecución es deliberada: una rutina no cambia aunque el usuario entrene con ella 50 veces. El historial real vive en `workout_sets`.

---

## Tablas nuevas

---

### `routines`

La plantilla de una rutina. Puede ser creada por el usuario o predeterminada del sistema.

| Campo | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| nombre | text | NO | — | Nombre de la rutina, ej: "Empuje", "Full Body A" |
| descripcion | text | SÍ | — | Descripción opcional de la rutina |
| foto_url | text | SÍ | — | URL de imagen opcional, para uso futuro |
| is_default | boolean | NO | false | true para las rutinas predeterminadas del sistema |
| is_public | boolean | NO | false | true para rutinas visibles por todos los usuarios |
| created_by | uuid | SÍ | — | FK → profiles. NULL para rutinas predeterminadas |
| created_at | timestamptz | NO | now() | Automático |
| updated_at | timestamptz | NO | now() | Actualizado automáticamente via trigger |

**Trigger:** `on_routine_updated` → actualiza `updated_at` en cada modificación.

**RLS:**
- Cualquier usuario puede ver rutinas donde `is_public = true` o `created_by = auth.uid()`.
- Solo el creador puede editar o eliminar su rutina.
- Las rutinas predeterminadas (`created_by = NULL`) son visibles para todos por `is_public = true`, pero nadie puede editarlas ni eliminarlas desde cliente.

**Patrón de rutinas predeterminadas:** igual que `meal_types` y `exercises`. Se insertan directamente en base de datos con `is_default = true`, `is_public = true` y `created_by = NULL`. El flag `is_default` permite distinguirlas en la UI (por ejemplo, no mostrar opción de eliminar).

---

### `routine_exercises`

Los ejercicios que componen una rutina, en orden. Es la tabla intermedia entre `routines` y `exercises`.

| Campo | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| routine_id | uuid | NO | — | FK → routines (CASCADE DELETE) |
| exercise_id | uuid | NO | — | FK → exercises (CASCADE DELETE) |
| orden | integer | NO | 0 | Posición del ejercicio dentro de la rutina |
| notas | text | SÍ | — | Nota opcional por ejercicio, ej: "Controla la bajada" |
| created_at | timestamptz | NO | now() | Automático |

**CASCADE DELETE:** si se elimina una rutina, se eliminan en cascada todos sus `routine_exercises` y, por cascada encadenada, todos sus `routine_sets`.

**RLS:** un usuario puede ver los ejercicios de cualquier rutina que tenga acceso (pública o propia). Solo puede crear, editar o eliminar ejercicios de sus propias rutinas.

**Índice:** `(routine_id, orden)` — optimiza la carga ordenada de ejercicios al abrir una rutina.

---

### `routine_sets`

Las series de cada ejercicio dentro de una rutina. Son la referencia de lo que el usuario planea hacer — no el registro real.

| Campo | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| routine_exercise_id | uuid | NO | — | FK → routine_exercises (CASCADE DELETE) |
| numero_serie | integer | NO | — | Número de la serie: 1, 2, 3... |
| tipo_serie | text | NO | 'lineal' | Tipo: 'lineal', 'warm_up', 'top_set', 'back_off', 'superset' |
| reps | integer | SÍ | — | Reps objetivo. NULL si no se especifica |
| peso_kg | numeric(6,2) | SÍ | — | Peso de referencia en kg. NULL si no se especifica |
| tipo_peso | text | NO | 'kg' | 'kg', 'bodyweight' o 'assisted' |
| created_at | timestamptz | NO | now() | Automático |

**Tipos de serie:**
- `lineal` → serie normal, la por defecto
- `warm_up` → serie de calentamiento, no cuenta para el volumen principal
- `top_set` → serie máxima del día
- `back_off` → serie a menor intensidad tras el top set
- `superset` → combinada con el ejercicio siguiente

**Pesos y reps opcionales:** el usuario puede crear una rutina solo con el número de series y el tipo, sin especificar kg ni reps. Esto es habitual al crear una rutina por primera vez. Los valores se pueden rellenar antes de iniciar el entreno o directamente durante la sesión.

**RLS:** hereda el acceso de `routine_exercises` → solo puede gestionar series de ejercicios de sus propias rutinas.

**Índice:** `(routine_exercise_id, numero_serie)` — optimiza la carga ordenada de series al abrir un ejercicio.

---

### `user_favorite_routines`

Rutinas marcadas como favoritas por cada usuario. Misma estructura que `user_favorite_exercises` y `user_favorite_foods`.

| Campo | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| user_id | uuid | NO | — | FK → profiles (CASCADE DELETE) |
| routine_id | uuid | NO | — | FK → routines (CASCADE DELETE) |
| created_at | timestamptz | NO | now() | Fecha en que se marcó como favorita |

**PK compuesta:** `(user_id, routine_id)` — un usuario no puede marcar la misma rutina como favorita dos veces.

**RLS:** cada usuario solo puede ver y gestionar sus propios favoritos.

**Uso en UI:** las rutinas favoritas aparecen destacadas o primero en la lista. Un usuario puede marcar como favorita tanto una rutina propia como una predeterminada del sistema.

---

## Modificación sobre tabla existente

### `workout_sessions` — campo añadido

Se añadió el campo `routine_id` a la tabla existente `workout_sessions`:

| Campo | Tipo | Nullable | Default | Descripción |
|---|---|---|---|---|
| routine_id | uuid | SÍ | — | FK → routines (SET NULL on delete). NULL si el entreno se creó sin rutina |

**Comportamiento:** cuando el usuario inicia un entreno desde una rutina, se crea una `workout_session` con `routine_id` apuntando a esa rutina. Los ejercicios y series de la plantilla se copian a `workout_session_exercises` y `workout_sets` como punto de partida, y el usuario los completa con los valores reales durante el entreno.

Si la rutina se elimina posteriormente, `routine_id` pasa a NULL en las sesiones existentes (SET NULL), preservando el historial del entreno.

---

## Flujo completo: de rutina a entreno

```
1. Usuario crea una rutina
   routines (nombre: "Empuje")
       └── routine_exercises (Press Banca, orden: 1)
               └── routine_sets (Serie 1, lineal, 4x80kg)
                   routine_sets (Serie 2, lineal, 4x80kg)
                   routine_sets (Serie 3, top_set, 1x90kg)

2. Usuario inicia el entreno con esa rutina
   workout_sessions (fecha: hoy, routine_id: → "Empuje")
       └── workout_session_exercises (Press Banca, orden: 1)
               └── workout_sets (Serie 1, peso real: 82.5kg, reps: 4, completada: true)
                   workout_sets (Serie 2, peso real: 82.5kg, reps: 4, completada: true)
                   workout_sets (Serie 3, peso real: 92.5kg, reps: 1, completada: true)

3. La próxima vez que el usuario inicie una rutina con Press Banca
   → Se consulta el último workout_sets completado de ese ejercicio para ese usuario
   → Se muestra en la columna "Anterior" de la UI
```

---

## Relaciones completas

```
profiles
    └── routines (created_by)
            ├── routine_exercises
            │       └── routine_sets
            └── user_favorite_routines ← profiles (user_id)

workout_sessions (routine_id → routines)
    └── workout_session_exercises
            └── workout_sets  ← fuente del historial "Anterior"
```

---

## Decisiones de diseño

1. **Plantilla vs. ejecución separadas:** una rutina nunca se modifica al entrenar. El historial real vive en `workout_sets`. Esto permite cambiar la rutina sin perder el historial ni afectar sesiones pasadas.

2. **Historial "Anterior" sin tabla extra:** el campo "Anterior" que se muestra durante un entreno se obtiene consultando el último `workout_set` completado de ese `exercise_id` para ese usuario, independientemente de la rutina. No hace falta tabla de historial separada.

3. **CASCADE DELETE encadenado:** eliminar una rutina elimina sus `routine_exercises` y sus `routine_sets` automáticamente. Las `workout_sessions` que usaron esa rutina conservan su historial con `routine_id = NULL`.

4. **Pesos y reps opcionales en plantilla:** el usuario puede definir una rutina sin especificar kg ni reps. La plantilla es flexible — puede ser tan detallada o tan esquemática como el usuario quiera.

5. **`is_public` vs. `is_default`:** son independientes. `is_default` indica que la creó el sistema. `is_public` controla la visibilidad. Las rutinas predeterminadas tienen ambos en true. Una rutina de usuario podría ser pública en el futuro sin ser predeterminada.
