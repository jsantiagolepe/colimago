import { describe, expect, it } from 'vitest';
import type { PendingSource } from '../../modules/types';
import { percentOf, weekOf, weekProgress, weekSummary } from './week';

const fuente = (porDia: Record<string, [number, number]>): PendingSource => ({
  subscribe: () => () => {},
  load: () => {},
  items: () => [],
  setDone: () => {},
  progress: (day) => {
    const [total, done] = porDia[day] ?? [0, 0];
    return { total, done };
  },
});

describe('la semana del inicio', () => {
  it('va de lunes a domingo', () => {
    expect(weekOf('2026-10-08')).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
    ]);
    // Un domingo pertenece a la semana que empezó el lunes anterior.
    expect(weekOf('2026-10-11')[0]).toBe('2026-10-05');
  });

  it('suma los módulos por día y calcula el porcentaje', () => {
    const calendario = fuente({ '2026-10-06': [4, 4], '2026-10-07': [6, 5], '2026-10-08': [3, 1] });
    const tareas = fuente({ '2026-10-07': [4, 4], '2026-10-08': [1, 0], '2026-10-10': [2, 0] });
    const dias = weekProgress([calendario, tareas], '2026-10-08')!;
    expect(dias.map((d) => [d.total, d.done, d.future])).toEqual([
      [0, 0, false], [4, 4, false], [10, 9, false], [4, 1, false], [0, 0, true], [2, 0, true], [0, 0, true],
    ]);
    expect(percentOf(dias[2])).toBe(90);
    expect(percentOf(dias[0])).toBeNull();
    // 14 de 18 hasta hoy; lo de días que no llegan no cuenta.
    expect(weekSummary(dias)).toEqual({ percent: 78, completeDays: 1, daysWithItems: 3 });
  });

  it('mientras un módulo carga no hay gráfica', () => {
    const cargando: PendingSource = { ...fuente({}), progress: () => null };
    expect(weekProgress([fuente({}), cargando], '2026-10-08')).toBeNull();
  });
});
