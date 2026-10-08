import { createDocumentStore } from '../../core/platform/document-store';
import { pendingFromStore } from '../pending';
import { sampleData, setCheckDone, type CalendarData } from './model';

export const calendarStore = createDocumentStore<CalendarData>('calendar', () => sampleData(new Date()));

/** Los checks de hoy, para la tarjeta de pendientes del inicio. */
export const calendarPending = pendingFromStore(calendarStore, {
  items(data, today) {
    const actividades = new Map(data.activities.map((a) => [a.id, a]));
    return (data.days[today] ?? []).flatMap((check) => {
      const actividad = actividades.get(check.activityId);
      return actividad
        ? [{ id: check.id, title: actividad.name, detail: actividad.goal, color: actividad.color, done: check.done }]
        : [];
    });
  },
  setDone: (data, checkId, done, today) => setCheckDone(data, today, checkId, done),
  // Un check palomeado cuenta para su día aunque lo hayas marcado después.
  progress(data, day) {
    const actividades = new Set(data.activities.map((a) => a.id));
    const checks = (data.days[day] ?? []).filter((c) => actividades.has(c.activityId));
    return { total: checks.length, done: checks.filter((c) => c.done).length };
  },
});
