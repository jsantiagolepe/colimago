import { dateKey } from '../../core/dates';
import { createDocumentStore } from '../../core/platform/document-store';
import { pendingFromStore } from '../pending';
import { doneCount, emptyEnglish, setSectionDone, TOTAL, type EnglishData } from './model';
import { SECTIONS, type SectionId } from './sections';

export const englishStore = createDocumentStore<EnglishData>('english', () => emptyEnglish(dateKey(new Date())));

/** Las cinco actividades de hoy, para Pendientes, Tu semana y el número de la tarjeta. */
export const englishPending = pendingFromStore(englishStore, {
  items(data, today) {
    const hechas = data.days[today]?.done ?? [];
    return SECTIONS.map((s) => ({ id: s.id, title: s.title, color: s.color, done: hechas.includes(s.id) }));
  },
  setDone: (data, id, done, today) => setSectionDone(data, today, id as SectionId, done),
  // Antes de que empezaras la bitácora no hay nada que contar.
  progress: (data, day) => (day < data.startedOn ? { total: 0, done: 0 } : { total: TOTAL, done: doneCount(data, day) }),
});
