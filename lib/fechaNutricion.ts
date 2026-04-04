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
