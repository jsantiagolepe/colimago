import { describe, expect, it } from 'vitest';
import {
  addTask,
  deleteTask,
  groupTasks,
  overdueLabel,
  renameTask,
  restoreTask,
  sampleTasks,
  setTaskDone,
  setTaskDue,
  type TasksData,
} from './model';

const vacio = (): TasksData => ({ version: 1, tasks: [] });
const HOY = '2026-10-07';

describe('tareas', () => {
  it('agrega, renombra, cambia fecha, marca y borra', () => {
    let d = addTask(vacio(), '  Pagar la luz ', '2026-10-06');
    expect(addTask(d, '   ')).toBe(d);
    const id = d.tasks[0].id;
    expect(d.tasks[0]).toMatchObject({ title: 'Pagar la luz', due: '2026-10-06', done: false });

    d = renameTask(d, id, 'Pagar la luz y el agua');
    expect(renameTask(d, id, '  ')).toBe(d);
    d = setTaskDue(d, id, undefined);
    expect(d.tasks[0].due).toBeUndefined();
    d = setTaskDone(d, id, true);
    expect(d.tasks[0].done).toBe(true);
    expect(d.tasks[0].doneAt).toBeDefined();
    d = setTaskDone(d, id, false);
    expect(d.tasks[0].doneAt).toBeUndefined();

    const borrada = d.tasks[0];
    const sin = deleteTask(d, id);
    expect(sin.tasks).toEqual([]);
    expect(restoreTask(sin, borrada, 0).tasks).toEqual([borrada]);
  });

  it('agrupa por urgencia y ordena por fecha', () => {
    let d = vacio();
    d = addTask(d, 'Próxima lejana', '2026-10-20');
    d = addTask(d, 'Sin fecha');
    d = addTask(d, 'Vencida', '2026-10-01');
    d = addTask(d, 'Próxima cercana', '2026-10-09');
    d = addTask(d, 'De hoy', HOY);
    d = addTask(d, 'Hecha', HOY);
    const hecha = d.tasks.find((t) => t.title === 'Hecha')!;
    d = setTaskDone(d, hecha.id, true);

    const grupos = groupTasks(d.tasks, HOY).map((g) => [g.id, g.tasks.map((t) => t.title)]);
    expect(grupos).toEqual([
      ['overdue', ['Vencida']],
      ['today', ['De hoy']],
      ['upcoming', ['Próxima cercana', 'Próxima lejana']],
      ['someday', ['Sin fecha']],
      ['done', ['Hecha']],
    ]);
  });

  it('describe lo vencido', () => {
    expect(overdueLabel('2026-10-06', HOY)).toBe('Venció ayer');
    expect(overdueLabel('2026-10-01', HOY)).toBe('Venció el 1 oct');
  });

  it('los ejemplos traen tareas hechas y por hacer alrededor de hoy', () => {
    const { tasks } = sampleTasks(new Date(2026, 9, 7));
    expect(tasks.filter((t) => t.done)).toHaveLength(2);
    expect(tasks.filter((t) => !t.done)).toHaveLength(5);
    expect(tasks.find((t) => t.title === 'Pagar la luz')?.due).toBe('2026-10-06');
  });
});
