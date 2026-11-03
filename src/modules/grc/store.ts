import { dateKey } from '../../core/dates';
import { createDocumentStore } from '../../core/platform/document-store';
import { pendingFromStore } from '../pending';
import { calendarWeek, emptyGrc, migrateGrc, nextTask, setTaskDone, type GrcData } from './model';
import { weekOfTask } from './roadmap';

export const grcStore = createDocumentStore<GrcData>(
  'grc',
  () => emptyGrc(dateKey(new Date())),
  (raw) => migrateGrc(raw, dateKey(new Date())),
);

/**
 * En Pendientes del inicio sale solo tu siguiente paso de la ruta, para no
 * perder el hilo sin llenar la lista. No cuenta en la gráfica de la semana:
 * la ruta va por semanas, no por días.
 */
export const grcPending = pendingFromStore(grcStore, {
  items(data, today) {
    const paso = nextTask(data);
    if (!paso) return [];
    const semana = weekOfTask(paso.id)!;
    return [
      {
        id: paso.id,
        title: `GRC: ${paso.title}`,
        detail: `Semana ${semana.n}`,
        overdue: calendarWeek(data, today) > semana.n,
        done: false,
      },
    ];
  },
  setDone: (data, id, done, today) => setTaskDone(data, id, done, today),
  progress: () => ({ total: 0, done: 0 }),
});
