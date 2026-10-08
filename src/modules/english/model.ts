// Bitácora diaria de inglés (funciones puras). Se guarda completa como el
// documento "english": por día, qué actividades palomeaste y lo que anotaste.

import { addDays, dateKey, parseDateKey } from '../../core/dates';
import { newId } from '../../core/id';
import { SECTIONS, type SectionId } from './sections';

export interface EnglishEntry {
  id: string;
  section: SectionId;
  createdAt: string;
  title?: string;
  url?: string;
  body?: string;
}

export interface EnglishDayLog {
  /** Actividades palomeadas ese día. */
  done: SectionId[];
  entries: EnglishEntry[];
}

export interface EnglishData {
  version: 1;
  /** Desde cuándo llevas la bitácora: antes de este día no hay nada que contar. */
  startedOn: string;
  days: Record<string, EnglishDayLog>;
}

export const TOTAL = SECTIONS.length;

export const emptyEnglish = (today: string): EnglishData => ({ version: 1, startedOn: today, days: {} });

export function dayLog(data: EnglishData, day: string): EnglishDayLog {
  return data.days[day] ?? { done: [], entries: [] };
}

const conDia = (data: EnglishData, day: string, log: EnglishDayLog): EnglishData => ({
  ...data,
  days: { ...data.days, [day]: log },
});

export function setSectionDone(data: EnglishData, day: string, section: SectionId, done: boolean): EnglishData {
  const log = dayLog(data, day);
  if (log.done.includes(section) === done) return data;
  const lista = done ? [...log.done, section] : log.done.filter((s) => s !== section);
  return conDia(data, day, { ...log, done: lista });
}

/** Anotar algo también palomea la actividad de ese día. */
export function addEntry(
  data: EnglishData,
  day: string,
  section: SectionId,
  campos: Pick<EnglishEntry, 'title' | 'url' | 'body'>,
): EnglishData {
  const limpio = (v?: string) => v?.trim() || undefined;
  let url = limpio(campos.url);
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  const entry: EnglishEntry = {
    id: newId(),
    section,
    createdAt: new Date().toISOString(),
    title: limpio(campos.title),
    url,
    body: limpio(campos.body),
  };
  if (!entry.title && !entry.url && !entry.body) return data;
  const log = dayLog(data, day);
  return setSectionDone(conDia(data, day, { ...log, entries: [...log.entries, entry] }), day, section, true);
}

export function deleteEntry(data: EnglishData, day: string, entryId: string): EnglishData {
  const log = dayLog(data, day);
  const entries = log.entries.filter((e) => e.id !== entryId);
  return entries.length === log.entries.length ? data : conDia(data, day, { ...log, entries });
}

/** Cuántas de las actividades quedaron palomeadas ese día. */
export function doneCount(data: EnglishData, day: string): number {
  return dayLog(data, day).done.filter((s) => SECTIONS.some((x) => x.id === s)).length;
}

export const isComplete = (data: EnglishData, day: string) => doneCount(data, day) === TOTAL;

/** Días seguidos con las cinco actividades hasta hoy (si hoy aún no, desde ayer). */
export function streak(data: EnglishData, today: string): number {
  let fecha = parseDateKey(today);
  if (!isComplete(data, today)) fecha = addDays(fecha, -1);
  let racha = 0;
  while (isComplete(data, dateKey(fecha))) {
    racha++;
    fecha = addDays(fecha, -1);
  }
  return racha;
}
