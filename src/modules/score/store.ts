import { dateKey } from '../../core/dates';
import { createDocumentStore } from '../../core/platform/document-store';
import { pendingFromStore } from '../pending';
import { emptyScore, migrateScore, platformDone, recordedCount, recordedItems, setValues, TOTAL, type ScoreData } from './model';
import { PLATFORMS, type Platform } from './platforms';

export const scoreStore = createDocumentStore<ScoreData>('score', () => emptyScore(dateKey(new Date())), migrateScore);

/**
 * Las tres plataformas de hoy para Pendientes, Tu semana y el número de la
 * tarjeta. Desde el inicio no se palomean: abren su pantalla para escribir
 * los números.
 */
export const scorePending = pendingFromStore(scoreStore, {
  items: (data, today) =>
    PLATFORMS.map((p) => {
      const llevas = recordedItems(data, today, p.id);
      return {
        id: p.id,
        title: p.title,
        detail: llevas ? `${llevas} de ${p.items.length} ${p.itemsName}` : `Escribir ${p.metric}`,
        color: p.color,
        done: platformDone(data, today, p.id),
        href: `/score/${p.id}`,
      };
    }),
  // Desmarcar desde otra pantalla borra los números de hoy; marcar sin números no aplica.
  setDone: (data, id, done, today) => {
    if (done) return data;
    const p = PLATFORMS.find((x) => x.id === id)!;
    return setValues(data, today, id as Platform, Object.fromEntries(p.items.map((i) => [i.id, undefined])));
  },
  progress: (data, day) => (day < data.startedOn ? { total: 0, done: 0 } : { total: TOTAL, done: recordedCount(data, day) }),
});
