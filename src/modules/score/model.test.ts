import { describe, expect, it } from 'vitest';
import {
  emptyScore,
  isComplete,
  migrateScore,
  platformDone,
  platformTotal,
  recordedItems,
  series,
  setValues,
  streak,
  sum,
} from './model';

const HOY = '2026-10-08';
const apps = (a: number, b: number, c: number) => ({ 'colima-go': a, 'magenta-group': b, 'real-estate-colima': c });
const paginas = (n: number) => ({ impercasa: n, 'colima-go': n, energycol: n, 'real-estate-js': n, infratec: n });

describe('Score', () => {
  it('guarda un número por app y la plataforma está lista con todas', () => {
    let d = setValues(emptyScore(HOY), HOY, 'ios', { 'colima-go': 12.4, 'magenta-group': 3 });
    expect(d.days[HOY].ios).toEqual({ 'colima-go': 12, 'magenta-group': 3 });
    expect(recordedItems(d, HOY, 'ios')).toBe(2);
    expect(platformDone(d, HOY, 'ios')).toBe(false);
    expect(platformTotal(d, HOY, 'ios')).toBe(15);
    d = setValues(d, HOY, 'ios', { 'real-estate-colima': 0 });
    expect(platformDone(d, HOY, 'ios')).toBe(true);
    expect(setValues(d, HOY, 'ios', { 'colima-go': 12, infratec: -1 })).toBe(d);
    d = setValues(d, HOY, 'ios', { 'colima-go': undefined, 'magenta-group': undefined, 'real-estate-colima': undefined });
    expect(d.days).toEqual({});
    expect(platformTotal(d, HOY, 'ios')).toBeNull();
  });

  it('día completo, suma, serie para la gráfica y racha', () => {
    let d = emptyScore('2026-10-06');
    for (const [dia, n] of [['2026-10-06', 5], ['2026-10-07', 8]] as const) {
      d = setValues(d, dia, 'ios', apps(n, 1, 1));
      d = setValues(d, dia, 'android', apps(n * 2, 0, 0));
      d = setValues(d, dia, 'facebook', paginas(100));
    }
    d = setValues(d, HOY, 'facebook', paginas(40));
    expect(isComplete(d, '2026-10-07')).toBe(true);
    expect(isComplete(d, HOY)).toBe(false);
    expect(sum(d, ['2026-10-06', '2026-10-07', HOY], 'facebook')).toBe(1200);
    expect(series(d, ['2026-10-05', '2026-10-06', '2026-10-07'], 'ios')).toEqual([null, 7, 10]);
    // Un día a medias no entra a la gráfica.
    expect(series(setValues(d, HOY, 'ios', { 'colima-go': 1 }), [HOY], 'ios')).toEqual([null]);
    expect(streak(d, HOY)).toBe(2);
  });

  it('la versión 1 (un número por plataforma, sin datos) pasa a la 2', () => {
    expect(migrateScore({ version: 1, startedOn: '2026-10-08', days: {} })).toEqual(emptyScore('2026-10-08'));
  });
});
