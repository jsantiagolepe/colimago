import { describe, expect, it } from 'vitest';
import { GUIDES, guideFor } from './guides';
import { addNote, allNotes, deleteNote, emptyGrc, glossary, migrateGrc, notesOf, searchNotes } from './model';
import { PROJECTS } from './projects';
import { TASKS } from './roadmap';

const HOY = '2026-11-03';

describe('guías de estudio', () => {
  it('cada guía es de un paso que existe y todos los pasos tienen guía', () => {
    const ids = new Set(TASKS.map((t) => t.id));
    for (const id of Object.keys(GUIDES)) expect(ids.has(id)).toBe(true);
    for (const t of TASKS) {
      const { guide } = guideFor(t);
      expect(guide.steps.length).toBeGreaterThan(0);
      expect(guide.practice.length).toBeGreaterThan(0);
    }
  });

  it('casi todos los pasos tienen guía propia o compartida', () => {
    const genericas = TASKS.filter((t) => guideFor(t).generic).length;
    expect(genericas).toBeLessThan(TASKS.length * 0.15);
  });

  it('los proyectos caen en semanas de la ruta y tienen ids únicos', () => {
    expect(new Set(PROJECTS.map((p) => p.id)).size).toBe(PROJECTS.length);
    for (const p of PROJECTS) for (const w of p.weeks) expect(w >= 1 && w <= 26).toBe(true);
  });
});

describe('biblioteca', () => {
  it('guarda, busca sin acentos, arma el glosario y borra', () => {
    let d = emptyGrc(HOY);
    d = addNote(d, 's01-b', 'concepto', { title: 'Riesgo residual', body: 'El riesgo que queda después de los controles.' });
    d = addNote(d, 's01-b', 'enlace', { title: 'Glosario NIST', url: 'csrc.nist.gov/glossary' });
    d = addNote(d, 'proj-sgsi', 'concepto', { title: 'Alcance', body: 'Qué entra al SGSI.' });
    expect(addNote(d, 's01-b', 'apunte', { title: '  ', body: '' })).toBe(d);

    const todas = allNotes(d);
    expect(todas).toHaveLength(3);
    expect(searchNotes(todas, 'despues CONTROLES', 'todo').map((n) => n.title)).toEqual(['Riesgo residual']);
    expect(searchNotes(todas, '', 'enlace')[0].url).toBe('https://csrc.nist.gov/glossary');
    expect(glossary(todas).map((n) => n.title)).toEqual(['Alcance', 'Riesgo residual']);

    const id = notesOf(d, 'proj-sgsi')[0].id;
    const sinProyecto = deleteNote(d, 'proj-sgsi', id);
    expect(sinProyecto.notes['proj-sgsi']).toBeUndefined();
    expect(deleteNote(sinProyecto, 'proj-sgsi', 'no-existe')).toBe(sinProyecto);
  });

  it('los datos de la versión 1 se conservan y ganan biblioteca vacía', () => {
    const v1 = { version: 1, startedOn: '2026-11-02', done: { 's01-a': HOY } };
    expect(migrateGrc(v1, HOY)).toEqual({ version: 2, startedOn: '2026-11-02', done: { 's01-a': HOY }, notes: {} });
  });
});
