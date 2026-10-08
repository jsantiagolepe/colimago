// Datos del calendario y las operaciones sobre ellos (funciones puras, sin
// React ni disco). Se guardan completos como el documento "calendar".

import { addDays, dateKey } from '../../core/dates';
import { newId } from '../../core/id';

/** Algo que puede ir como check en un día: "Estudiar inglés · 1 hora". */
export interface Activity {
  id: string;
  name: string;
  /** Meta opcional, en texto libre: "1 hora", "5 km"… */
  goal?: string;
  color: string;
}

/** Una actividad puesta en un día, hecha o no. */
export interface DayCheck {
  id: string;
  activityId: string;
  done: boolean;
}

export interface CalendarData {
  version: 1;
  /** Catálogo de actividades, en el orden en que salen en "Agregar". */
  activities: Activity[];
  /** Checks de cada día, por fecha local "AAAA-MM-DD". */
  days: Record<string, DayCheck[]>;
}

export const ACTIVITY_COLORS = ['#3364c9', '#3f7256', '#9b3fb5', '#c97a14', '#2f5d5a', '#c2543f', '#c42a7f', '#5b6170'];

/**
 * Semanas (de lunes a domingo) que cubren el mes de `month`, incluidos
 * los días del mes anterior y el siguiente que completan la primera y la
 * última semana.
 */
export function monthWeeks(month: Date): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // lunes = 0
  const start = addDays(first, -offset);
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

// ---------- Operaciones ----------

export function addChecks(data: CalendarData, day: string, activityIds: string[]): CalendarData {
  const existing = data.days[day] ?? [];
  const already = new Set(existing.map((c) => c.activityId));
  const added = activityIds.filter((id) => !already.has(id)).map((activityId) => ({ id: newId(), activityId, done: false }));
  if (added.length === 0) return data;
  return { ...data, days: { ...data.days, [day]: [...existing, ...added] } };
}

export function setCheckDone(data: CalendarData, day: string, checkId: string, done: boolean): CalendarData {
  const checks = data.days[day];
  const check = checks?.find((c) => c.id === checkId);
  if (!checks || !check || check.done === done) return data;
  return {
    ...data,
    days: { ...data.days, [day]: checks.map((c) => (c === check ? { ...c, done } : c)) },
  };
}

export function toggleCheck(data: CalendarData, day: string, checkId: string): CalendarData {
  const check = data.days[day]?.find((c) => c.id === checkId);
  return check ? setCheckDone(data, day, checkId, !check.done) : data;
}

export function removeCheck(data: CalendarData, day: string, checkId: string): CalendarData {
  const checks = (data.days[day] ?? []).filter((c) => c.id !== checkId);
  const days = { ...data.days };
  if (checks.length) days[day] = checks;
  else delete days[day];
  return { ...data, days };
}

export function createActivity(data: CalendarData, name: string, goal?: string): { data: CalendarData; activity: Activity } {
  const activity: Activity = {
    id: newId(),
    name: name.trim(),
    goal: goal?.trim() || undefined,
    color: ACTIVITY_COLORS[data.activities.length % ACTIVITY_COLORS.length],
  };
  return { data: { ...data, activities: [...data.activities, activity] }, activity };
}

// ---------- Datos de ejemplo ----------

/** Lo que trae el calendario la primera vez: un catálogo y checks de prueba en `today`. */
export function sampleData(today: Date): CalendarData {
  const actividades: [string, string][] = [
    ['Estudiar inglés', '1 hora'],
    ['Correr', '1 hora'],
    ['Estudiar', '1 hora'],
    ['Leer', '30 min'],
    ['Gimnasio', '1 hora'],
    ['Meditar', '10 min'],
  ];
  const activities = actividades.map(([name, goal], i) => ({ id: newId(), name, goal, color: ACTIVITY_COLORS[i] }));
  const [ingles, correr, estudiar, leer] = activities;
  return {
    version: 1,
    activities,
    days: {
      [dateKey(today)]: [
        { id: newId(), activityId: ingles.id, done: true },
        { id: newId(), activityId: correr.id, done: true },
        { id: newId(), activityId: estudiar.id, done: false },
        { id: newId(), activityId: leer.id, done: false },
      ],
    },
  };
}
