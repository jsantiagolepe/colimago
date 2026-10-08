import { describe, expect, it } from 'vitest';
import { addEntry, deleteEntry, doneCount, emptyEnglish, isComplete, setSectionDone, streak } from './model';
import { SECTIONS } from './sections';

const HOY = '2026-10-08';

describe('bitácora de inglés', () => {
  it('anotar algo palomea la actividad; borrarlo no la despalomea', () => {
    let d = addEntry(emptyEnglish(HOY), HOY, 'loora', { title: ' Practice interview ' });
    expect(d.days[HOY].entries[0]).toMatchObject({ section: 'loora', title: 'Practice interview' });
    expect(d.days[HOY].done).toEqual(['loora']);
    expect(addEntry(d, HOY, 'talk', { title: '  ' })).toBe(d);
    d = deleteEntry(d, HOY, d.days[HOY].entries[0].id);
    expect(d.days[HOY]).toEqual({ done: ['loora'], entries: [] });
  });

  it('a los links sin protocolo les pone https', () => {
    const d = addEntry(emptyEnglish(HOY), HOY, 'youtube', { url: 'youtube.com/watch?v=abc' });
    expect(d.days[HOY].entries[0].url).toBe('https://youtube.com/watch?v=abc');
  });

  it('el día está completo con las cinco, y la racha cuenta días completos', () => {
    let d = emptyEnglish('2026-10-06');
    for (const dia of ['2026-10-06', '2026-10-07']) for (const s of SECTIONS) d = setSectionDone(d, dia, s.id, true);
    d = setSectionDone(d, HOY, 'ia', true);
    expect(isComplete(d, '2026-10-07')).toBe(true);
    expect(doneCount(d, HOY)).toBe(1);
    expect(streak(d, HOY)).toBe(2);
    expect(setSectionDone(d, HOY, 'ia', true)).toBe(d);
  });
});
