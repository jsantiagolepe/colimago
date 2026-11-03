import { describe, expect, it } from 'vitest';
import { modules } from './registry';

describe('registro de módulos', () => {
  it('cada módulo tiene id y ruta únicos, y su ruta es /<id>', () => {
    expect(new Set(modules.map((m) => m.id)).size).toBe(modules.length);
    for (const m of modules) expect(m.path).toBe(`/${m.id}`);
  });

  it('ColimaGo va primero; los módulos con pantalla', () => {
    expect(modules[0].id).toBe('colima-go');
    expect(modules.filter((m) => m.component).map((m) => m.id)).toEqual(['colima-go', 'magenta', 'english', 'grc', 'tasks', 'score', 'calendar']);
  });

  it('English, GRC, Tareas, Score y Calendar alimentan la tarjeta de pendientes', () => {
    expect(modules.filter((m) => m.pending).map((m) => m.id)).toEqual(['english', 'grc', 'tasks', 'score', 'calendar']);
  });

  it('GRC ocupa en el inicio el lugar de Calendar, que ya no tiene tarjeta', () => {
    const enInicio = modules.filter((m) => !m.hidden).map((m) => m.id);
    expect(enInicio).toContain('grc');
    expect(enInicio).not.toContain('calendar');
    expect(enInicio).toHaveLength(9);
  });
});
