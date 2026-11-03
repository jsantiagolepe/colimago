// Avance en la ruta GRC (funciones puras). Se guarda como el documento
// "grc": desde qué lunes cuenta tu calendario y qué pasos terminaste (y
// cuándo). La ruta en sí es fija (roadmap.ts).

import { addDays, dateKey, daysBetween, parseDateKey } from '../../core/dates';
import { PHASES, TASKS, TOTAL_WEEKS, WEEKS, type RoadmapPhase, type RoadmapTask, type RoadmapWeek } from './roadmap';

export interface GrcData {
  version: 1;
  /** Lunes en que empieza la semana 1 ("AAAA-MM-DD"). */
  startedOn: string;
  /** Paso terminado → día en que lo palomeaste. */
  done: Record<string, string>;
}

/** El lunes de la semana de `day`. */
export function mondayOf(day: string): string {
  const fecha = parseDateKey(day);
  return dateKey(addDays(fecha, -((fecha.getDay() + 6) % 7)));
}

export const emptyGrc = (today: string): GrcData => ({ version: 1, startedOn: mondayOf(today), done: {} });

/** Primer día (lunes) de la semana `n` (1 a 26). */
export const weekStart = (data: GrcData, n: number) => dateKey(addDays(parseDateKey(data.startedOn), (n - 1) * 7));
/** Último día (domingo) de la semana `n`. */
export const weekEnd = (data: GrcData, n: number) => dateKey(addDays(parseDateKey(data.startedOn), (n - 1) * 7 + 6));

/** En qué semana del calendario cae `today` (puede pasar de 26 o ser menor que 1). */
export function calendarWeek(data: GrcData, today: string): number {
  return Math.floor(daysBetween(data.startedOn, today) / 7) + 1;
}

export const isDone = (data: GrcData, taskId: string) => Object.hasOwn(data.done, taskId);

export function setTaskDone(data: GrcData, taskId: string, done: boolean, today: string): GrcData {
  if (isDone(data, taskId) === done) return data;
  const siguiente = { ...data.done };
  if (done) siguiente[taskId] = today;
  else delete siguiente[taskId];
  return { ...data, done: siguiente };
}

export interface Counts {
  done: number;
  total: number;
}

const contar = (data: GrcData, tasks: RoadmapTask[]): Counts => ({
  done: tasks.filter((t) => isDone(data, t.id)).length,
  total: tasks.length,
});

export const totalCounts = (data: GrcData) => contar(data, TASKS);
export const weekCounts = (data: GrcData, week: RoadmapWeek) => contar(data, week.tasks);
export const phaseCounts = (data: GrcData, phase: RoadmapPhase) =>
  contar(data, phase.weeks.flatMap((w) => w.tasks));

export const percent = (c: Counts) => (c.total ? Math.round((c.done / c.total) * 100) : 0);

/** El primer paso sin terminar, en el orden de la ruta. */
export const nextTask = (data: GrcData): RoadmapTask | undefined => TASKS.find((t) => !isDone(data, t.id));

/** La primera semana con algo pendiente (`null` si ya terminaste todo). */
export function openWeek(data: GrcData): RoadmapWeek | null {
  return WEEKS.find((w) => w.tasks.some((t) => !isDone(data, t.id))) ?? null;
}

export type Pace =
  | { status: 'terminado' }
  | { status: 'al-dia' }
  | { status: 'atrasado'; weeks: number }
  | { status: 'adelantado'; weeks: number };

/** Si la semana en la que vas va con el calendario. */
export function pace(data: GrcData, today: string): Pace {
  const abierta = openWeek(data);
  if (!abierta) return { status: 'terminado' };
  const diferencia = calendarWeek(data, today) - abierta.n;
  if (diferencia > 0) return { status: 'atrasado', weeks: diferencia };
  if (diferencia < 0) return { status: 'adelantado', weeks: -diferencia };
  return { status: 'al-dia' };
}

/**
 * Mueve el calendario para que la semana en la que vas sea la de hoy. No
 * toca lo que ya terminaste: solo corre las fechas de lo que falta.
 */
export function reschedule(data: GrcData, today: string): GrcData {
  const abierta = openWeek(data);
  if (!abierta) return data;
  const startedOn = dateKey(addDays(parseDateKey(mondayOf(today)), -(abierta.n - 1) * 7));
  return startedOn === data.startedOn ? data : { ...data, startedOn };
}

export interface Milestone {
  task: RoadmapTask;
  week: RoadmapWeek;
  done: boolean;
  /** Fecha meta: el domingo de su semana. */
  due: string;
}

export function milestones(data: GrcData): Milestone[] {
  return WEEKS.flatMap((week) =>
    week.tasks
      .filter((t) => t.milestone)
      .map((task) => ({ task, week, done: isDone(data, task.id), due: weekEnd(data, week.n) })),
  );
}

/** La fase (mes) que toca ver primero: la de la semana en la que vas. */
export function currentPhase(data: GrcData): RoadmapPhase {
  const abierta = openWeek(data);
  return PHASES.find((p) => p.weeks.some((w) => w.n === (abierta?.n ?? TOTAL_WEEKS)))!;
}

/** Lee lo guardado y lo deja en el formato actual. */
export function migrateGrc(raw: unknown, today: string): GrcData {
  const r = (raw ?? {}) as Partial<GrcData>;
  const startedOn = typeof r.startedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.startedOn) ? r.startedOn : mondayOf(today);
  const done: Record<string, string> = r.done && typeof r.done === 'object' ? r.done : {};
  if (r.version === 1 && r.startedOn === startedOn && r.done === done) return r as GrcData;
  return { version: 1, startedOn, done };
}
