import { describe, expect, it } from 'vitest';
import { addDays, dateKey, parseDateKey, relativeDate } from '../../core/dates';
import {
  addChecks,
  createActivity,
  monthWeeks,
  removeCheck,
  sampleData,
  setCheckDone,
  toggleCheck,
  type CalendarData,
} from './model';

const vacio = (): CalendarData => ({ version: 1, activities: [], days: {} });

describe('fechas del calendario', () => {
  it('usa la fecha local, no UTC', () => {
    expect(dateKey(new Date(2026, 9, 7, 23, 30))).toBe('2026-10-07');
    expect(dateKey(parseDateKey('2026-01-31'))).toBe('2026-01-31');
    expect(dateKey(addDays(parseDateKey('2026-12-31'), 1))).toBe('2027-01-01');
  });

  it('fechas relativas', () => {
    expect(relativeDate('2026-10-07', '2026-10-07')).toBe('Hoy');
    expect(relativeDate('2026-10-08', '2026-10-07')).toBe('Mañana');
    expect(relativeDate('2026-10-06', '2026-10-07')).toBe('Ayer');
    expect(relativeDate('2026-10-15', '2026-10-07')).toBe('15 oct');
    expect(relativeDate('2027-01-02', '2026-10-07')).toBe('2 ene 2027');
  });

  it('el mes empieza en lunes y completa las semanas', () => {
    // Octubre 2026 empieza en jueves: la primera semana arranca el lunes 28 de septiembre.
    const octubre = monthWeeks(new Date(2026, 9, 1));
    expect(octubre).toHaveLength(5);
    expect(dateKey(octubre[0][0])).toBe('2026-09-28');
    expect(dateKey(octubre[4][6])).toBe('2026-11-01');
    // Marzo 2026 empieza en domingo: necesita seis semanas.
    expect(monthWeeks(new Date(2026, 2, 1))).toHaveLength(6);
    // Febrero 2027 empieza en lunes y tiene 28 días: cuatro semanas exactas.
    expect(monthWeeks(new Date(2027, 1, 1))).toHaveLength(4);
  });
});

describe('checks de un día', () => {
  it('agrega actividades sin repetirlas en el mismo día', () => {
    const { data, activity } = createActivity(vacio(), '  Correr ', ' 1 hora ');
    expect(activity).toMatchObject({ name: 'Correr', goal: '1 hora' });
    const conUno = addChecks(data, '2026-10-07', [activity.id]);
    const otraVez = addChecks(conUno, '2026-10-07', [activity.id]);
    expect(otraVez).toBe(conUno);
    expect(conUno.days['2026-10-07']).toEqual([expect.objectContaining({ activityId: activity.id, done: false })]);
  });

  it('marca, desmarca y quita; un día sin checks desaparece', () => {
    const { data, activity } = createActivity(vacio(), 'Leer');
    let d = addChecks(data, '2026-10-07', [activity.id]);
    const id = d.days['2026-10-07'][0].id;
    d = toggleCheck(d, '2026-10-07', id);
    expect(d.days['2026-10-07'][0].done).toBe(true);
    d = toggleCheck(d, '2026-10-07', id);
    expect(d.days['2026-10-07'][0].done).toBe(false);
    expect(setCheckDone(d, '2026-10-07', id, false)).toBe(d);
    d = removeCheck(d, '2026-10-07', id);
    expect(d.days).toEqual({});
  });

  it('una meta vacía no se guarda', () => {
    expect(createActivity(vacio(), 'Nadar', '   ').activity.goal).toBeUndefined();
  });
});

describe('datos de ejemplo', () => {
  it('traen el catálogo y checks de prueba en el día de hoy', () => {
    const hoy = new Date(2026, 9, 7);
    const data = sampleData(hoy);
    const nombres = new Map(data.activities.map((a) => [a.id, a.name]));
    const checks = data.days['2026-10-07'];
    expect(checks.map((c) => nombres.get(c.activityId))).toEqual(['Estudiar inglés', 'Correr', 'Estudiar', 'Leer']);
    expect(checks.filter((c) => c.done)).toHaveLength(2);
  });
});
