import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useDocument } from '../../core/platform/document-store';
import { useToday } from '../../core/useToday';
import { IconTrash } from '../../core/ui/icons';
import { HomeBar } from '../../features/home/HomePage';
import { BackLink } from '../../features/home/hub';
import { googleUrl, guideFor, SOURCE_KINDS, udemyUrl, youtubeUrl, type Guide } from './guides';
import { addNote, deleteNote, isDone, notesOf, setTaskDone, weekEnd, weekStart, type Note, type NoteKind } from './model';
import { projectById } from './projects';
import { KINDS, PHASES, TASKS, weekOfTask } from './roadmap';
import { grcStore } from './store';
import { CheckButton, fechaCorta } from './ui';

export const NOTE_KINDS: Record<NoteKind, { label: string; title: string; body: string; color: string }> = {
  concepto: { label: 'Concepto', title: 'Término', body: 'Definición con tus palabras y un ejemplo', color: '#3364c9' },
  apunte: { label: 'Apunte', title: 'Título (opcional)', body: 'Lo que aprendiste, dudas, resúmenes…', color: '#1f8a6e' },
  enlace: { label: 'Enlace', title: 'Nombre del recurso', body: 'Por qué sirve (opcional)', color: '#8a4fc9' },
  entregable: { label: 'Entregable', title: 'Nombre del archivo o evidencia', body: 'Versión, notas (opcional)', color: '#c97a14' },
};

interface Prefill {
  nonce: number;
  kind: NoteKind;
  title?: string;
  body?: string;
}

function Missing({ text }: { text: string }) {
  return (
    <div className="home grc">
      <HomeBar>
        <BackLink to="/grc">Ruta GRC</BackLink>
      </HomeBar>
      <main className="empty-module">
        <p className="empty-module__text">{text}</p>
      </main>
    </div>
  );
}

/* ---------- Un paso: su guía y tus notas ---------- */

export function TaskPage() {
  const { id } = useParams();
  const { data, update } = useDocument(grcStore);
  const hoy = useToday();
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  const indice = TASKS.findIndex((t) => t.id === id);
  const task = TASKS[indice];
  useEffect(() => {
    document.querySelector('.grc')?.scrollTo({ top: 0 });
    setPrefill(null);
  }, [id]);
  if (!task) return <Missing text="Este paso no existe." />;

  const semana = weekOfTask(task.id)!;
  const fase = PHASES.find((p) => p.weeks.includes(semana))!;
  const tipo = KINDS[task.kind];
  const { guide, generic } = guideFor(task);
  const hecho = data ? isDone(data, task.id) : false;
  const anterior = TASKS[indice - 1];
  const siguiente = TASKS[indice + 1];

  return (
    <div className="home grc">
      <HomeBar>
        <BackLink to="/grc">Ruta GRC</BackLink>
      </HomeBar>
      <main className="grc-study">
        <header className="grc-study__head" style={{ '--c': fase.color } as CSSProperties}>
          <div className="grc-study__titles">
            <p className="grc-eyebrow">
              Mes {fase.month} · Semana {semana.n}
              {data && ` · ${fechaCorta(weekStart(data, semana.n))} – ${fechaCorta(weekEnd(data, semana.n))}`}
            </p>
            <h1 className="grc-study__title">{task.title}</h1>
            {task.detail && <p className="grc-study__detail">{task.detail}</p>}
            <p className="grc-task__meta">
              <span className="grc-kind" style={{ '--k': tipo.color } as CSSProperties}>
                {tipo.label}
              </span>
              {task.milestone && <span className="grc-kind grc-kind--milestone">Hito: {task.milestone}</span>}
              {task.links?.map((l) => (
                <a key={l.url} className="grc-task__link" href={l.url} target="_blank" rel="noreferrer">
                  {l.label} ↗
                </a>
              ))}
            </p>
          </div>
          {data && (
            <div className="grc-study__done">
              <CheckButton
                done={hecho}
                color={tipo.color}
                label={`${task.title}: hecho`}
                onToggle={() => update((d) => setTaskDone(d, task.id, !hecho, hoy))}
                large
              />
              <span>{hecho ? 'Hecho' : 'Marcar hecho'}</span>
            </div>
          )}
        </header>

        <div className="grc-study__grid">
          <GuideView
            guide={guide}
            generic={generic}
            onUseConcept={(term, def) => setPrefill({ nonce: Date.now(), kind: 'concepto', title: term, body: def })}
          />
          <aside className="grc-study__aside">
            {data && (
              <NotesPanel
                key={task.id}
                notes={notesOf(data, task.id)}
                prefill={prefill}
                onAdd={(kind, campos) => update((d) => addNote(d, task.id, kind, campos))}
                onDelete={(noteId) => update((d) => deleteNote(d, task.id, noteId))}
              />
            )}
          </aside>
        </div>

        <nav className="grc-study__nav" aria-label="Pasos">
          {anterior ? (
            <Link to={`/grc/paso/${anterior.id}`} className="grc-study__navlink">
              ← {anterior.title}
            </Link>
          ) : (
            <span />
          )}
          {siguiente && (
            <Link to={`/grc/paso/${siguiente.id}`} className="grc-study__navlink is-next">
              {siguiente.title} →
            </Link>
          )}
        </nav>
      </main>
    </div>
  );
}

function SearchLinks({ text }: { text: string }) {
  return (
    <li className="grc-search">
      <span className="grc-search__text">{text}</span>
      <span className="grc-search__links">
        <a href={googleUrl(text)} target="_blank" rel="noreferrer">
          Google
        </a>
        <a href={youtubeUrl(text)} target="_blank" rel="noreferrer">
          YouTube
        </a>
        <a href={udemyUrl(text)} target="_blank" rel="noreferrer">
          Udemy
        </a>
      </span>
    </li>
  );
}

function GuideView({
  guide,
  generic,
  onUseConcept,
}: {
  guide: Guide;
  generic: boolean;
  onUseConcept: (term: string, def: string) => void;
}) {
  return (
    <article className="grc-guide">
      <section className="grc-guide__why">
        <h2 className="grc-guide__h">Por qué importa</h2>
        <p>{guide.why}</p>
        {generic && <p className="grc-guide__generic">Guía general para este tipo de paso; usa las búsquedas para profundizar.</p>}
      </section>

      <section>
        <h2 className="grc-guide__h">Cómo estudiarlo, en orden</h2>
        <ol className="grc-guide__steps">
          {guide.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      {guide.concepts && guide.concepts.length > 0 && (
        <section>
          <h2 className="grc-guide__h">Lo que debes poder explicar</h2>
          <dl className="grc-concepts">
            {guide.concepts.map(([term, def]) => (
              <div key={term} className="grc-concept">
                <dt>{term}</dt>
                <dd>{def}</dd>
                <button type="button" className="grc-concept__use" onClick={() => onUseConcept(term, def)}>
                  Usar en mi glosario
                </button>
              </div>
            ))}
          </dl>
        </section>
      )}

      {guide.searches.length > 0 && (
        <section>
          <h2 className="grc-guide__h">Qué buscar</h2>
          <ul className="grc-searches">
            {guide.searches.map((t) => (
              <SearchLinks key={t} text={t} />
            ))}
          </ul>
        </section>
      )}

      {guide.sources && guide.sources.length > 0 && (
        <section>
          <h2 className="grc-guide__h">Dónde aprenderlo</h2>
          <ul className="grc-sources">
            {guide.sources.map((s) => (
              <li key={s.url}>
                <a className="grc-source" href={s.url} target="_blank" rel="noreferrer">
                  <span className={`grc-source__kind is-${s.kind}`}>{SOURCE_KINDS[s.kind]}</span>
                  <span className="grc-source__label">{s.label} ↗</span>
                  {s.note && <span className="grc-source__note">{s.note}</span>}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="grc-guide__h">Practica</h2>
        <ul className="grc-guide__list">
          {guide.practice.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      {guide.template && (
        <section>
          <h2 className="grc-guide__h">Estructura del entregable</h2>
          <ol className="grc-template">
            {guide.template.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </section>
      )}

      {guide.prompt && (
        <section>
          <h2 className="grc-guide__h">Prompt para la IA</h2>
          <pre className="grc-prompt">{guide.prompt}</pre>
          <button type="button" className="grc-concept__use" onClick={() => void navigator.clipboard?.writeText(guide.prompt!)}>
            Copiar prompt
          </button>
        </section>
      )}

      {guide.tips && guide.tips.length > 0 && (
        <section className="grc-tips">
          <h2 className="grc-guide__h">Tips</h2>
          <ul className="grc-guide__list">
            {guide.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/* ---------- Tus notas de un paso o proyecto ---------- */

export function NotesPanel({
  notes,
  prefill,
  onAdd,
  onDelete,
  title = 'Tu biblioteca de este paso',
}: {
  notes: Note[];
  prefill: Prefill | null;
  onAdd: (kind: NoteKind, campos: { title?: string; url?: string; body?: string }) => void;
  onDelete: (noteId: string) => void;
  title?: string;
}) {
  const [kind, setKind] = useState<NoteKind>('apunte');
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [borrando, setBorrando] = useState<string | null>(null);

  useEffect(() => {
    if (!prefill) return;
    setKind(prefill.kind);
    setTitulo(prefill.title ?? '');
    setCuerpo(prefill.body ?? '');
    setUrl('');
  }, [prefill]);

  const conUrl = kind === 'enlace' || kind === 'entregable';
  const listo = !!(titulo.trim() || cuerpo.trim() || url.trim());
  const info = NOTE_KINDS[kind];

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (!listo) return;
    onAdd(kind, { title: titulo, url: conUrl ? url : undefined, body: cuerpo });
    setTitulo('');
    setUrl('');
    setCuerpo('');
  }

  const ordenadas = [...notes].reverse();

  return (
    <section className="grc-notes" aria-label={title}>
      <h2 className="grc-guide__h">{title}</h2>
      <form className="grc-notes__form" onSubmit={guardar}>
        <div className="grc-notes__kinds" role="radiogroup" aria-label="Tipo de nota">
          {(Object.keys(NOTE_KINDS) as NoteKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className={`grc-notes__kind${kind === k ? ' is-active' : ''}`}
              style={{ '--k': NOTE_KINDS[k].color } as CSSProperties}
              onClick={() => setKind(k)}
            >
              {NOTE_KINDS[k].label}
            </button>
          ))}
        </div>
        <input className="grc-input" placeholder={info.title} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        {conUrl && (
          <input className="grc-input" placeholder="https://… (Drive, GitHub, video, artículo)" value={url} onChange={(e) => setUrl(e.target.value)} />
        )}
        <textarea className="grc-input" rows={kind === 'apunte' ? 5 : 3} placeholder={info.body} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
        <button type="submit" className="grc-button" disabled={!listo}>
          Guardar {info.label.toLowerCase()}
        </button>
      </form>

      {ordenadas.length === 0 ? (
        <p className="grc-notes__empty">Aún no guardas nada aquí. Lo que guardes aparece también en la Biblioteca, con búsqueda.</p>
      ) : (
        <ul className="grc-notes__list">
          {ordenadas.map((n) => (
            <li key={n.id} className="grc-note" style={{ '--k': NOTE_KINDS[n.kind].color } as CSSProperties}>
              <div className="grc-note__head">
                <span className="grc-kind" style={{ '--k': NOTE_KINDS[n.kind].color } as CSSProperties}>
                  {NOTE_KINDS[n.kind].label}
                </span>
                {borrando === n.id ? (
                  <span className="grc-note__confirm">
                    <button type="button" onClick={() => onDelete(n.id)}>
                      Borrar
                    </button>
                    <button type="button" onClick={() => setBorrando(null)}>
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button type="button" className="grc-note__delete" aria-label="Borrar nota" onClick={() => setBorrando(n.id)}>
                    <IconTrash className="ui-icon" />
                  </button>
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
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Un proyecto del portafolio ---------- */

export function ProjectPage() {
  const { id } = useParams();
  const { data, update } = useDocument(grcStore);
  const p = projectById(id);
  if (!p) return <Missing text="Este proyecto no existe." />;

  const pasos = TASKS.filter((t) => p.weeks.includes(weekOfTask(t.id)!.n));

  return (
    <div className="home grc">
      <HomeBar>
        <BackLink to="/grc">Ruta GRC</BackLink>
      </HomeBar>
      <main className="grc-study">
        <header className="grc-study__head">
          <div className="grc-study__titles">
            <p className="grc-eyebrow">
              Proyecto {p.n}
              {p.extra ? ' · Extra' : ` · Semanas ${p.weeks.join(', ')}`}
            </p>
            <h1 className="grc-study__title">{p.title}</h1>
            <p className="grc-study__detail">{p.goal}</p>
            <p className="grc-task__meta">
              {p.skills.map((s) => (
                <span key={s} className="grc-kind" style={{ '--k': '#1f8a6e' } as CSSProperties}>
                  {s}
                </span>
              ))}
            </p>
          </div>
        </header>

        <div className="grc-study__grid">
          <article className="grc-guide">
            <section>
              <h2 className="grc-guide__h">Entregables</h2>
              <ul className="grc-guide__list">
                {p.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="grc-guide__h">Pasos</h2>
              <ol className="grc-guide__steps">
                {p.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
            {pasos.length > 0 && (
              <section>
                <h2 className="grc-guide__h">Pasos de la ruta que lo construyen</h2>
                <ul className="grc-project-tasks">
                  {pasos.map((t) => (
                    <li key={t.id} className={data && isDone(data, t.id) ? 'is-done' : ''}>
                      <Link to={`/grc/paso/${t.id}`}>
                        Sem {weekOfTask(t.id)!.n} · {t.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h2 className="grc-guide__h">Herramientas</h2>
              <p className="grc-guide__plain">{p.tools.join(' · ')}</p>
            </section>
            <section className="grc-tips">
              <h2 className="grc-guide__h">Cómo contarlo</h2>
              <p className="grc-guide__plain">{p.pitch}</p>
              <p className="grc-guide__plain">
                <strong>Para tu CV:</strong> {p.cvLine}
              </p>
            </section>
          </article>
          <aside className="grc-study__aside">
            {data && (
              <NotesPanel
                title="Entregables y notas del proyecto"
                notes={notesOf(data, p.id)}
                prefill={null}
                onAdd={(kind, campos) => update((d) => addNote(d, p.id, kind, campos))}
                onDelete={(noteId) => update((d) => deleteNote(d, p.id, noteId))}
              />
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
