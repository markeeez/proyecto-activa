/**
 * Fechas en calendario nutrición: siempre componentes locales (evita desfases UTC / lunes mal marcado).
 */

export function parseFechaLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function fechaIsoDesdeDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Hoy según el reloj del dispositivo (zona local). */
export function fechaHoyIsoLocal(): string {
  return fechaIsoDesdeDate(new Date());
}

/**
 * true si `fechaIso` es estrictamente anterior a hoy (local).
 * Se usa para ocultar comidas vacías al revisar días pasados desde otro día.
 */
export function esDiaPasadoVsHoy(fechaIso: string): boolean {
  return fechaIso < fechaHoyIsoLocal();
}

export function agregarDiasIso(iso: string, delta: number): string {
  const d = parseFechaLocal(iso);
  d.setDate(d.getDate() + delta);
  return fechaIsoDesdeDate(d);
}

const MESES_CORTOS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/**
 * Rango legible de la semana (lun–dom), p. ej. `27 may – 2 jun` o `1 – 7 abr` si el mes coincide.
 */
export function formatRangoSemanaCortoES(semana: { fechaIso: string }[]): string {
  const first = parseFechaLocal(semana[0].fechaIso);
  const last = parseFechaLocal(semana[6].fechaIso);
  const m0 = MESES_CORTOS_ES[first.getMonth()];
  const m1 = MESES_CORTOS_ES[last.getMonth()];
  const d0 = first.getDate();
  const d1 = last.getDate();
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return `${d0} – ${d1} ${m0}`;
  }
  return `${d0} ${m0} – ${d1} ${m1}`;
}

/** Semana que contiene `fechaIso`, Lunes → Domingo. Letras L M X J V S D. */
export function getSemanaMovil(fechaIso: string) {
  const base = parseFechaLocal(fechaIso);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);

  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = fechaIsoDesdeDate(d);
    return {
      key: days[i],
      dia: d.getDate(),
      activo: iso === fechaIso,
      fechaIso: iso,
    };
  });
}

// ─── Helpers de mes (para CalendarioNutricion) ────────────────────────────────

const MESES_LARGOS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

/** Etiqueta tipo "Mayo 2025" para la cabecera del calendario. */
export function formatMesAñoES(año: number, mesIndex: number): string {
  const m = MESES_LARGOS_ES[mesIndex] ?? '';
  return `${m} ${año}`;
}

/** Primer día (ISO YYYY-MM-01) del mes (mesIndex 0–11). */
export function primerDiaMesIso(año: number, mesIndex: number): string {
  return fechaIsoDesdeDate(new Date(año, mesIndex, 1));
}

/** Último día (ISO YYYY-MM-DD del último día) del mes (mesIndex 0–11). */
export function ultimoDiaMesIso(año: number, mesIndex: number): string {
  // Día 0 del mes siguiente = último día de este mes (truco JS clásico).
  return fechaIsoDesdeDate(new Date(año, mesIndex + 1, 0));
}

/** Número de días del mes (28-31). */
export function diasDelMes(año: number, mesIndex: number): number {
  return new Date(año, mesIndex + 1, 0).getDate();
}

/**
 * Construye el grid del mes en celdas (semanas Lun→Dom), con `null` para los
 * huecos del principio (offset Lun) y del final hasta cerrar la última semana.
 *
 * Cada celda con día tiene { dia, fechaIso, esFuturo }.
 */
export interface CeldaCalendarioMes {
  dia: number;
  fechaIso: string;
  esFuturo: boolean;
}

export function getGridMes(año: number, mesIndex: number): (CeldaCalendarioMes | null)[] {
  const hoy = fechaHoyIsoLocal();
  const primero = new Date(año, mesIndex, 1);
  // getDay(): 0=Dom, 1=Lun, ..., 6=Sáb. Queremos offset desde Lunes.
  const dow = primero.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  const total = diasDelMes(año, mesIndex);

  const celdas: (CeldaCalendarioMes | null)[] = [];
  for (let i = 0; i < offset; i++) celdas.push(null);

  for (let d = 1; d <= total; d++) {
    const fechaIso = fechaIsoDesdeDate(new Date(año, mesIndex, d));
    celdas.push({
      dia: d,
      fechaIso,
      esFuturo: fechaIso > hoy,
    });
  }

  // Rellenar hasta múltiplo de 7 para que el grid quede cuadrado.
  while (celdas.length % 7 !== 0) celdas.push(null);

  return celdas;
}

/**
 * Ir al mes anterior / siguiente devolviendo { año, mesIndex } sin pasarse de hoy.
 * Si `bloquearFuturo` es true y el destino sería un mes futuro, devuelve el actual.
 */
export function añadirMeses(
  año: number,
  mesIndex: number,
  delta: number,
  bloquearFuturo = false,
): { año: number; mesIndex: number } {
  const d = new Date(año, mesIndex + delta, 1);
  if (bloquearFuturo) {
    const hoy = new Date();
    if (d.getFullYear() > hoy.getFullYear() ||
        (d.getFullYear() === hoy.getFullYear() && d.getMonth() > hoy.getMonth())) {
      return { año: hoy.getFullYear(), mesIndex: hoy.getMonth() };
    }
  }
  return { año: d.getFullYear(), mesIndex: d.getMonth() };
}

/** True si (año, mesIndex) es estrictamente posterior al mes actual. */
export function esMesFuturo(año: number, mesIndex: number): boolean {
  const hoy = new Date();
  if (año > hoy.getFullYear()) return true;
  if (año < hoy.getFullYear()) return false;
  return mesIndex > hoy.getMonth();
}
