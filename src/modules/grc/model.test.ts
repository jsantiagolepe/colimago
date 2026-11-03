import { describe, expect, it } from 'vitest';
import {
  calendarWeek,
  currentPhase,
  emptyGrc,
  migrateGrc,
  milestones,
  mondayOf,
  nextTask,
  pace,
  reschedule,
  setTaskDone,
  totalCounts,
  weekEnd,
  weekStart,
  type GrcData,
} from './model';
import { PHASES, TASKS, TOTAL_WEEKS, WEEKS } from './roadmap';
import { grcPending } from './store';

const HOY = '2026-11-03'; // martes

function terminarSemanas(data: GrcData, hasta: number): GrcData {
  return WEEKS.filter((w) => w.n <= hasta)
    .flatMap((w) => w.tasks)
    .reduce((d, t) => setTaskDone(d, t.id, true, HOY), data);
}

describe('la ruta', () => {
  it('dura 26 semanas, 6 meses, numeradas en orden y con ids únicos', () => {
    expect(TOTAL_WEEKS).toBe(26);
    expect(PHASES.map((p) => p.month)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(WEEKS.map((w) => w.n)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    for (const w of WEEKS) expect(w.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it('en el mes 3 ya se aplica a vacantes', () => {
    const mes3 = PHASES[2].weeks.flatMap((w) => w.tasks);
    expect(mes3.some((t) => t.milestone === 'Aplicando')).toBe(true);
    expect(mes3.some((t) => t.milestone === 'CV')).toBe(true);
  });

  it('todos los enlaces son https', () => {
    for (const t of TASKS) for (const l of t.links ?? []) expect(l.url).toMatch(/^https:\/\//);
  });
});

describe('calendario', () => {
  it('empieza el lunes de la semana en que abres la ruta', () => {
    expect(mondayOf(HOY)).toBe('2026-11-02');
    const data = emptyGrc(HOY);
    expect(weekStart(data, 1)).toBe('2026-11-02');
    expect(weekEnd(data, 1)).toBe('2026-11-08');
    expect(weekStart(data, 2)).toBe('2026-11-09');
    expect(calendarWeek(data, HOY)).toBe(1);
    expect(calendarWeek(data, '2026-11-09')).toBe(2);
  });

  it('dice si vas al día, atrasado o adelantado', () => {
    const data = emptyGrc(HOY);
    expect(pace(data, HOY)).toEqual({ status: 'al-dia' });
    expect(pace(data, '2026-11-23')).toEqual({ status: 'atrasado', weeks: 3 });
    expect(pace(terminarSemanas(data, 2), HOY)).toEqual({ status: 'adelantado', weeks: 2 });
    expect(pace(terminarSemanas(data, 26), HOY)).toEqual({ status: 'terminado' });
  });

  it('reprogramar recorre las fechas sin tocar lo hecho', () => {
    const data = terminarSemanas(emptyGrc(HOY), 1);
    const despues = reschedule(data, '2026-12-01'); // vas en la 2, hoy es la 5 del calendario
    expect(despues.done).toBe(data.done);
    expect(calendarWeek(despues, '2026-12-01')).toBe(2);
    expect(pace(despues, '2026-12-01')).toEqual({ status: 'al-dia' });
    expect(reschedule(despues, '2026-12-01')).toBe(despues);
  });
});

describe('pasos', () => {
  it('palomear y despalomear', () => {
    const data = emptyGrc(HOY);
    const id = TASKS[0].id;
    const hecho = setTaskDone(data, id, true, HOY);
    expect(hecho.done[id]).toBe(HOY);
    expect(totalCounts(hecho)).toEqual({ done: 1, total: TASKS.length });
    expect(setTaskDone(hecho, id, true, HOY)).toBe(hecho);
    expect(setTaskDone(hecho, id, false, HOY).done).toEqual({});
  });

  it('el siguiente paso es el primero sin hacer y la fase actual lo sigue', () => {
    const data = terminarSemanas(emptyGrc(HOY), 4);
    expect(nextTask(data)?.id).toBe('s05-a');
    expect(currentPhase(data).month).toBe(2);
    expect(milestones(data).find((m) => m.task.milestone === 'Foundation')?.due).toBe(weekEnd(data, 6));
  });

  it('migra datos viejos o incompletos', () => {
    expect(migrateGrc(null, HOY)).toEqual(emptyGrc(HOY));
    const bueno = emptyGrc(HOY);
    expect(migrateGrc(bueno, HOY)).toBe(bueno);
  });
});

describe('pendiente del inicio', () => {
  it('no cuenta en la gráfica de la semana', () => {
    expect(grcPending.progress(HOY)).toBeNull(); // todavía no carga
  });
});
