// Tareas y sus operaciones (funciones puras, sin React ni disco). Se
// guardan completas como el documento "tasks".

import { addDays, dateKey, daysBetween, relativeDate } from '../../core/dates';
import { newId } from '../../core/id';

export interface Task {
  id: string;
  title: string;
  /** Fecha local "AAAA-MM-DD"; sin ella, la tarea es "Sin fecha". */
  due?: string;
  done: boolean;
  createdAt: string;
  doneAt?: string;
}

export interface TasksData {
  version: 1;
  tasks: Task[];
}

// ---------- Operaciones ----------

const conTarea = (data: TasksData, id: string, cambio: (t: Task) => Task): TasksData => {
  const tarea = data.tasks.find((t) => t.id === id);
  if (!tarea) return data;
  const nueva = cambio(tarea);
  return nueva === tarea ? data : { ...data, tasks: data.tasks.map((t) => (t === tarea ? nueva : t)) };
};

export function addTask(data: TasksData, title: string, due?: string): TasksData {
  const limpio = title.trim();
  if (!limpio) return data;
  const tarea: Task = { id: newId(), title: limpio, due: due || undefined, done: false, createdAt: new Date().toISOString() };
  return { ...data, tasks: [...data.tasks, tarea] };
}

export function setTaskDone(data: TasksData, id: string, done: boolean): TasksData {
  return conTarea(data, id, (t) =>
    t.done === done ? t : { ...t, done, doneAt: done ? new Date().toISOString() : undefined },
  );
}

export function renameTask(data: TasksData, id: string, title: string): TasksData {
  const limpio = title.trim();
  return conTarea(data, id, (t) => (!limpio || limpio === t.title ? t : { ...t, title: limpio }));
}

export function setTaskDue(data: TasksData, id: string, due?: string): TasksData {
  return conTarea(data, id, (t) => (t.due === (due || undefined) ? t : { ...t, due: due || undefined }));
}

export function deleteTask(data: TasksData, id: string): TasksData {
  const tasks = data.tasks.filter((t) => t.id !== id);
  return tasks.length === data.tasks.length ? data : { ...data, tasks };
}

/** Regresa una tarea borrada a donde estaba (para "Deshacer"). */
export function restoreTask(data: TasksData, task: Task, index: number): TasksData {
  if (data.tasks.some((t) => t.id === task.id)) return data;
  const tasks = [...data.tasks];
  tasks.splice(Math.min(index, tasks.length), 0, task);
  return { ...data, tasks };
}

// ---------- Agrupar y describir ----------

export type TaskGroupId = 'overdue' | 'today' | 'upcoming' | 'someday' | 'done';

export const GROUP_TITLES: Record<TaskGroupId, string> = {
  overdue: 'Vencidas',
  today: 'Hoy',
  upcoming: 'Próximas',
  someday: 'Sin fecha',
  done: 'Hechas',
};

export function groupOf(task: Task, today: string): TaskGroupId {
  if (task.done) return 'done';
  if (!task.due) return 'someday';
  if (task.due < today) return 'overdue';
  if (task.due === today) return 'today';
  return 'upcoming';
}

const porFecha = (a: Task, b: Task) => (a.due ?? '').localeCompare(b.due ?? '') || a.createdAt.localeCompare(b.createdAt);
const porCreacion = (a: Task, b: Task) => a.createdAt.localeCompare(b.createdAt);
const ORDEN: Record<TaskGroupId, (a: Task, b: Task) => number> = {
  overdue: porFecha,
  today: porCreacion,
  upcoming: porFecha,
  someday: porCreacion,
  done: (a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''),
};

/** Las tareas en grupos (solo los que tienen algo), en orden de urgencia. */
export function groupTasks(tasks: Task[], today: string): { id: TaskGroupId; tasks: Task[] }[] {
  return (Object.keys(GROUP_TITLES) as TaskGroupId[])
    .map((id) => ({ id, tasks: tasks.filter((t) => groupOf(t, today) === id).sort(ORDEN[id]) }))
    .filter((g) => g.tasks.length > 0);
}

/** Para pendientes atrasados: "Venció ayer", "Venció el 5 oct". */
export function overdueLabel(due: string, today: string): string {
  return daysBetween(due, today) === 1 ? 'Venció ayer' : `Venció el ${relativeDate(due, today)}`;
}

// ---------- Datos de ejemplo ----------

/** Lo que trae Tareas la primera vez: unas hechas y otras no, con fechas alrededor de `today`. */
export function sampleTasks(today: Date): TasksData {
  const dia = (n: number) => dateKey(addDays(today, n));
  const creada = addDays(today, -3).toISOString();
  const ejemplos: [string, string | undefined, boolean][] = [
    ['Pagar la luz', dia(-1), false],
    ['Revisar los eventos pendientes de ColimaGo', dia(0), false],
    ['Llamar al dentista', dia(0), true],
    ['Comprar el regalo de cumpleaños', dia(3), false],
    ['Renovar el dominio colimago.mx', dia(8), false],
    ['Ordenar las fotos del viaje', undefined, false],
    ['Enviar la factura de septiembre', dia(-2), true],
  ];
  return {
    version: 1,
    tasks: ejemplos.map(([title, due, done]) => ({
      id: newId(),
      title,
      due,
      done,
      createdAt: creada,
      doneAt: done ? creada : undefined,
    })),
  };
}
