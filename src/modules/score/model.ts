// Números diarios de Score (funciones puras): por día y plataforma, el
// número de cada app (iOS, Android) o página (Facebook). Se guarda completo
// como el documento "score".

import { addDays, dateKey, parseDateKey } from '../../core/dates';
import { PLATFORMS, type Platform, type PlatformInfo } from './platforms';

export type DayValues = Partial<Record<Platform, Record<string, number>>>;

export interface ScoreData {
  version: 2;
  /** Desde cuándo llevas el registro: antes de este día no hay nada que contar. */
  startedOn: string;
  days: Record<string, DayValues>;
}

export const TOTAL = PLATFORMS.length;

export const emptyScore = (today: string): ScoreData => ({ version: 2, startedOn: today, days: {} });

/** La versión 1 guardaba un solo número por plataforma; nunca llegó a tener datos. */
export function migrateScore(raw: unknown): ScoreData {
  const d = raw as { version?: number; startedOn?: string };
  if (d?.version === 2) return raw as ScoreData;
  return emptyScore(d?.startedOn ?? dateKey(new Date()));
}

const info = (p: Platform) => PLATFORMS.find((x) => x.id === p)!;

export const valueOf = (data: ScoreData, day: string, p: Platform, item: string) => data.days[day]?.[p]?.[item];

/** Cuántas apps/páginas de la plataforma tienen número ese día. */
export function recordedItems(data: ScoreData, day: string, p: Platform): number {
  const valores = data.days[day]?.[p] ?? {};
  return info(p).items.filter((i) => valores[i.id] !== undefined).length;
}

/** La plataforma está lista ese día cuando todas sus apps/páginas tienen número. */
export const platformDone = (data: ScoreData, day: string, p: Platform) =>
  recordedItems(data, day, p) === info(p).items.length;

/** Suma de las apps/páginas ese día; `null` si no anotaste ninguna. */
export function platformTotal(data: ScoreData, day: string, p: Platform): number | null {
  const valores = data.days[day]?.[p];
  const nums = info(p).items.map((i) => valores?.[i.id]).filter((v): v is number => v !== undefined);
  return nums.length ? nums.reduce((s, n) => s + n, 0) : null;
}

/** Guarda los números de un día (vacío = borrar ese). */
export function setValues(
  data: ScoreData,
  day: string,
  p: Platform,
  valores: Record<string, number | undefined>,
): ScoreData {
  const plataforma: Record<string, number> = { ...data.days[day]?.[p] };
  let cambio = false;
  for (const [item, valor] of Object.entries(valores)) {
    if (valor !== undefined && (!Number.isFinite(valor) || valor < 0)) continue;
    const limpio = valor === undefined ? undefined : Math.round(valor);
    if (plataforma[item] === limpio) continue;
    cambio = true;
    if (limpio === undefined) delete plataforma[item];
    else plataforma[item] = limpio;
  }
  if (!cambio) return data;
  const dia: DayValues = { ...data.days[day] };
  if (Object.keys(plataforma).length) dia[p] = plataforma;
  else delete dia[p];
  const days = { ...data.days };
  if (Object.keys(dia).length) days[day] = dia;
  else delete days[day];
  return { ...data, days };
}

export const recordedCount = (data: ScoreData, day: string) => PLATFORMS.filter((p) => platformDone(data, day, p.id)).length;

export const isComplete = (data: ScoreData, day: string) => recordedCount(data, day) === TOTAL;

export function sum(data: ScoreData, days: string[], p: Platform): number {
  return days.reduce((s, d) => s + (platformTotal(data, d, p) ?? 0), 0);
}

/**
 * El total de cada día para la gráfica; `null` si ese día faltó alguna
 * app/página (un día a medias se vería como una caída que no existió).
 */
export const series = (data: ScoreData, days: string[], p: Platform) =>
  days.map((d) => (platformDone(data, d, p) ? platformTotal(data, d, p) : null));

/** Días seguidos con todo anotado hasta hoy (si hoy aún no, desde ayer). */
export function streak(data: ScoreData, today: string): number {
  let fecha = parseDateKey(today);
  if (!isComplete(data, today)) fecha = addDays(fecha, -1);
  let racha = 0;
  while (isComplete(data, dateKey(fecha))) {
    racha++;
    fecha = addDays(fecha, -1);
  }
  return racha;
}

export const itemsOf = (p: Platform): PlatformInfo['items'] => info(p).items;
