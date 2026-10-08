import { dateKey } from '../../core/dates';
import { createDocumentStore } from '../../core/platform/document-store';
import { pendingFromStore } from '../pending';
import { overdueLabel, sampleTasks, setTaskDone, type TasksData } from './model';

export const tasksStore = createDocumentStore<TasksData>('tasks', () => sampleTasks(new Date()));

/**
 * Para la tarjeta de pendientes del inicio: las vencidas, las de hoy y las
 * que no tienen fecha (las próximas todavía no).
 */
export const tasksPending = pendingFromStore(tasksStore, {
  items(data, today) {
    return data.tasks
      .filter((t) => !t.due || t.due <= today)
      .sort((a, b) => rango(a, today) - rango(b, today) || (a.due ?? '').localeCompare(b.due ?? ''))
      .map((t) => {
        const vencida = !!t.due && t.due < today;
        return { id: t.id, title: t.title, done: t.done, overdue: vencida, detail: vencida ? overdueLabel(t.due!, today) : undefined };
      });
  },
  setDone: (data, id, done) => setTaskDone(data, id, done),
  // Las tareas cuentan en el día de su fecha, y solo como resueltas si se
  // terminaron a tiempo: una de ayer hecha hoy no sube el día de ayer.
  progress(data, day) {
    const delDia = data.tasks.filter((t) => t.due === day);
    const aTiempo = delDia.filter((t) => t.done && (!t.doneAt || dateKey(new Date(t.doneAt)) <= day));
    return { total: delDia.length, done: aTiempo.length };
  },
});

/** Vencidas primero, luego las de hoy y al final las que no tienen fecha. */
function rango(t: { due?: string }, today: string) {
  if (!t.due) return 2;
  return t.due < today ? 0 : 1;
}
