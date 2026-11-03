import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { saveTextFile } from '../../core/platform/files';
import { allNotes, glossary, isDone, notesOf, searchNotes, type GrcData, type LibraryEntry, type NoteKind } from './model';
import { projectById, PROJECTS } from './projects';
import { TASKS, weekOfTask } from './roadmap';
import { NOTE_KINDS } from './StudyPage';

/** De dónde viene una nota: su paso o su proyecto. */
function origen(key: string): { label: string; to: string } {
  const proyecto = projectById(key);
  if (proyecto) return { label: `Proyecto ${proyecto.n}: ${proyecto.title}`, to: `proyecto/${key}` };
  const paso = TASKS.find((t) => t.id === key);
  if (paso) return { label: `Sem ${weekOfTask(key)!.n} · ${paso.title}`, to: `paso/${key}` };
  return { label: 'Paso eliminado de la ruta', to: '' };
}

/* ---------- Proyectos ---------- */

export function ProjectsView({ data }: { data: GrcData }) {
  return (
    <section aria-label="Proyectos">
      <header className="grc-phase__head">
        <div>
          <p className="grc-eyebrow">Portafolio</p>
          <h2 className="grc-phase__title">Tus proyectos</h2>
          <p className="grc-phase__summary">
            Cada proyecto junta varios pasos de la ruta en algo que puedes mostrar en tu web, tu CV y tus entrevistas.
          </p>
        </div>
      </header>
      <ul className="grc-projects">
        {PROJECTS.map((p) => {
          const pasos = TASKS.filter((t) => p.weeks.includes(weekOfTask(t.id)!.n));
          const hechos = pasos.filter((t) => isDone(data, t.id)).length;
          const notas = notesOf(data, p.id).length;
          return (
            <li key={p.id}>
              <Link to={`proyecto/${p.id}`} className={`grc-project${p.extra ? ' is-extra' : ''}`}>
                <span className="grc-project__n">{p.n}</span>
                <span className="grc-project__title">{p.title}</span>
                <span className="grc-project__goal">{p.goal}</span>
                <span className="grc-project__meta">
                  {p.extra ? 'Extra · cuando vayas adelantado' : `Semanas ${p.weeks.join(', ')} · ${hechos}/${pasos.length} pasos`}
                  {notas > 0 && ` · ${notas} ${notas === 1 ? 'nota' : 'notas'}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- Biblioteca ---------- */

type Filtro = NoteKind | 'todo';

function exportarMarkdown(entries: LibraryEntry[]): string {
  const lineas: string[] = ['# Mi biblioteca GRC', '', `Exportada el ${new Date().toLocaleDateString('es-MX')}`, ''];
  const terminos = glossary(entries);
  if (terminos.length) {
    lineas.push('## Glosario', '');
    for (const t of terminos) lineas.push(`- **${t.title ?? '(sin término)'}**: ${t.body ?? ''}`);
    lineas.push('');
  }
  const porOrigen = new Map<string, LibraryEntry[]>();
  for (const e of entries) if (e.kind !== 'concepto') porOrigen.set(e.key, [...(porOrigen.get(e.key) ?? []), e]);
  for (const [key, notas] of porOrigen) {
    lineas.push(`## ${origen(key).label}`, '');
    for (const n of [...notas].reverse()) {
      lineas.push(`### ${NOTE_KINDS[n.kind].label}${n.title ? `: ${n.title}` : ''}`);
      if (n.url) lineas.push(n.url);
      if (n.body) lineas.push('', n.body);
      lineas.push('');
    }
  }
  return lineas.join('\n');
}

export function LibraryView({ data }: { data: GrcData }) {
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [aviso, setAviso] = useState<string | null>(null);
  const todas = useMemo(() => allNotes(data), [data]);
  const encontradas = searchNotes(todas, texto, filtro);
  const lista = filtro === 'concepto' ? glossary(encontradas) : encontradas;

  async function exportar() {
    try {
      const ok = await saveTextFile('biblioteca-grc.md', exportarMarkdown(todas));
      setAviso(ok ? 'Biblioteca exportada.' : null);
    } catch {
      setAviso('No se pudo exportar.');
    }
  }

  const filtros: [Filtro, string][] = [
    ['todo', 'Todo'],
    ...(Object.keys(NOTE_KINDS) as NoteKind[]).map((k): [Filtro, string] => [k, k === 'concepto' ? 'Glosario' : `${NOTE_KINDS[k].label}s`]),
  ];

  return (
    <section className="grc-library" aria-label="Biblioteca">
      <header className="grc-phase__head">
        <div>
          <p className="grc-eyebrow">Tu base de conocimiento</p>
          <h2 className="grc-phase__title">Biblioteca</h2>
          <p className="grc-phase__summary">
            Todo lo que guardas en cada paso y proyecto, en un solo lugar. Busca, repasa tu glosario o expórtala a
            Markdown para NotebookLM.
          </p>
        </div>
        <button type="button" className="grc-button" onClick={() => void exportar()} disabled={!todas.length}>
          Exportar
        </button>
      </header>
      {aviso && <p className="grc-footnote">{aviso}</p>}

      <div className="grc-library__bar">
        <input
          className="grc-input grc-library__search"
          type="search"
          placeholder="Buscar en tus notas (ej. riesgo residual, SoA, MFA)…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="grc-notes__kinds" role="radiogroup" aria-label="Filtrar por tipo">
          {filtros.map(([k, nombre]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={filtro === k}
              className={`grc-notes__kind${filtro === k ? ' is-active' : ''}`}
              style={{ '--k': k === 'todo' ? '#5f5f66' : NOTE_KINDS[k].color } as CSSProperties}
              onClick={() => setFiltro(k)}
            >
              {nombre} ({k === 'todo' ? todas.length : todas.filter((n) => n.kind === k).length})
            </button>
          ))}
        </div>
      </div>

      {todas.length === 0 ? (
        <p className="grc-notes__empty">
          Tu biblioteca está vacía. Abre cualquier paso de la ruta y guarda tu primer concepto, apunte, enlace o entregable.
        </p>
      ) : lista.length === 0 ? (
        <p className="grc-notes__empty">Nada coincide con tu búsqueda.</p>
      ) : (
        <ul className={filtro === 'concepto' ? 'grc-glossary' : 'grc-library__list'}>
          {lista.map((n) => {
            const o = origen(n.key);
            return (
              <li key={n.id} className="grc-note" style={{ '--k': NOTE_KINDS[n.kind].color } as CSSProperties}>
                <div className="grc-note__head">
                  <span className="grc-kind" style={{ '--k': NOTE_KINDS[n.kind].color } as CSSProperties}>
                    {NOTE_KINDS[n.kind].label}
                  </span>
                  {o.to ? (
                    <Link className="grc-note__source" to={o.to}>
                      {o.label}
                    </Link>
                  ) : (
                    <span className="grc-note__source">{o.label}</span>
                  )}
                </div>
                {n.title && <p className="grc-note__title">{n.title}</p>}
                {n.body && <p className="grc-note__body">{n.body}</p>}
                {n.url && (
                  <a className="grc-note__url" href={n.url} target="_blank" rel="noreferrer">
                    {n.url}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
