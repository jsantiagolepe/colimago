// Avance de la semana (lunes a domingo) para la gráfica del inicio.

import { addDays, dateKey, parseDateKey } from '../../core/dates';
import type { PendingSource } from '../../modules/types';

export interface WeekDay {
  day: string;
  /** Lo que tocaba ese día en todos los módulos. */
  total: number;
  done: number;
  /** Todavía no llega. */
  future: boolean;
}

/** Los siete días, de lunes a domingo, de la semana de `today`. */
export function weekOf(today: string): string[] {
  const fecha = parseDateKey(today);
  const lunes = addDays(fecha, -((fecha.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => dateKey(addDays(lunes, i)));
}

/** `null` mientras algún módulo sigue cargando. */
export function weekProgress(sources: PendingSource[], today: string): WeekDay[] | null {
  const dias: WeekDay[] = [];
  for (const day of weekOf(today)) {
    let total = 0;
    let done = 0;
    for (const source of sources) {
      const p = source.progress(day);
      if (!p) return null;
      total += p.total;
      done += p.done;
    }
    dias.push({ day, total, done, future: day > today });
  }
  return dias;
}

/** Lo resuelto de lunes a hoy, contando todo junto (no el promedio de los días). */
export function weekSummary(days: WeekDay[]) {
  const hastaHoy = days.filter((d) => !d.future && d.total > 0);
  const total = hastaHoy.reduce((s, d) => s + d.total, 0);
  const done = hastaHoy.reduce((s, d) => s + d.done, 0);
  return {
    percent: total ? Math.round((done / total) * 100) : null,
    completeDays: hastaHoy.filter((d) => d.done === d.total).length,
    daysWithItems: hastaHoy.length,
  };
}

export const percentOf = (d: { total: number; done: number }) => (d.total ? Math.round((d.done / d.total) * 100) : null);
