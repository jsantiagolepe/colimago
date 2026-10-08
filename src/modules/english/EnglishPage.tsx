import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, Route, Routes, useParams } from 'react-router';
import { addDays, dateKey, dayAndMonth, parseDateKey, weekdayName } from '../../core/dates';
import { useDocument } from '../../core/platform/document-store';
import { useToday } from '../../core/useToday';
import { IconCheck, IconNext, IconPrev, IconTrash } from '../../core/ui/icons';
import { HomeBar, ModuleBadge } from '../../features/home/HomePage';
import { weekOf } from '../../features/home/week';
import {
  addEntry,
  dayLog,
  deleteEntry,
  doneCount,
  isComplete,
  setSectionDone,
  streak,
  TOTAL,
  type EnglishData,
} from './model';
import { SECTIONS, sectionById, type EnglishSection } from './sections';
import { englishStore } from './store';
import '../../features/home/home.css';
import './english.css';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** English: igual que el inicio, una tarjeta grande con tu avance y una por actividad diaria. */
export default function EnglishPage() {
  return (
    <Routes>
      <Route index element={<EnglishHome />} />
      <Route path=":seccion" element={<EnglishSectionPage />} />
    </Routes>
  );
}

function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="home-bar__back">
      <IconPrev className="ui-icon" />
      {children}
    </Link>
  );
}

/** Círculo para palomear una actividad del día. */
function DoneToggle({
  section,
  done,
  onToggle,
  large = false,
}: {
  section: EnglishSection;
  done: boolean;
  onToggle: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      className={`english-done${done ? ' is-done' : ''}${large ? ' english-done--large' : ''}`}
      style={{ '--c': section.color } as CSSProperties}
      role="checkbox"
      aria-checked={done}
      aria-label={`${section.title} hecho hoy`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {done && <IconCheck />}
    </button>
  );
}

function EnglishHome() {
  const { data, update } = useDocument(englishStore);
  const hoy = useToday();
  const hechas = data ? dayLog(data, hoy).done : [];

  return (
    <div className="home">
      <HomeBar>
        <BackLink to="/">Inicio</BackLink>
      </HomeBar>
      <main className="home__main">
        <h1 className="mp-sr-only">English</h1>
        <EnglishStats data={data} today={hoy} />
        <ul className="home__grid english-grid">
          {SECTIONS.map((s) => {
            const done = hechas.includes(s.id);
            const alternar = () => update((d) => setSectionDone(d, hoy, s.id, !done));
            const contenido = (
              <>
                <ModuleBadge module={s} />
                <span className="home-card__text">
                  <span className="home-card__title">{s.title}</span>
                  <span className="home-card__description">{s.description}</span>
                </span>
              </>
            );
            return (
              <li key={s.id} className={`english-card${done ? ' is-done' : ''}`}>
                {/* Sin nada que anotar (IA English), la tarjeta entera palomea. */}
                {s.fields.length ? (
                  <Link to={s.id} className="home-card">
                    {contenido}
                  </Link>
                ) : (
                  <button type="button" className="home-card english-card__plain" onClick={alternar} disabled={!data}>
                    {contenido}
                  </button>
                )}
                {data && <DoneToggle section={s} done={done} onToggle={alternar} />}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

/**
 * Tu avance: el día cuenta como completo cuando palomeas las cinco
 * actividades. Arriba a la derecha, cuántas te faltan hoy.
 */
function EnglishStats({ data, today }: { data: EnglishData | null; today: string }) {
  if (!data) return <section className="english-stats" aria-busy="true" />;

  const semana = weekOf(today);
  const completos = semana.filter((d) => d <= today && isComplete(data, d)).length;
  const racha = streak(data, today);
  const faltan = TOTAL - doneCount(data, today);

  return (
    <section className="english-stats" aria-labelledby="english-stats-titulo">
      <div className="english-stats__main">
        <h2 id="english-stats-titulo" className="english-stats__title">
          Tu inglés
        </h2>
        <div className="english-stats__figures">
          <div>
            <span className="english-stats__number">{completos}</span>
            <span className="english-stats__label">{completos === 1 ? 'día completo' : 'días completos'} esta semana</span>
          </div>
          <div>
            <span className="english-stats__number">{racha}</span>
            <span className="english-stats__label">{racha === 1 ? 'día' : 'días'} de racha</span>
          </div>
        </div>
        <p className="english-stats__today">
          Hoy llevas <strong>{TOTAL - faltan} de {TOTAL}</strong>
          {faltan === 0 ? '. ¡Día completo!' : '.'}
        </p>
      </div>

      <div className="english-stats__side">
        <span className={`english-stats__count${faltan === 0 ? ' is-zero' : ''}`} aria-label={`${faltan} por hacer hoy`}>
          {faltan}
        </span>
        <ol className="english-week" aria-label="Días de esta semana">
          {semana.map((d, i) => {
            const esHoy = d === today;
            const futuro = d > today;
            const antes = d < data.startedOn;
            const completo = isComplete(data, d);
            const hechas = doneCount(data, d);
            const estado = completo
              ? 'completo'
              : futuro
                ? 'todavía no llega'
                : antes
                  ? 'antes de empezar'
                  : `${hechas} de ${TOTAL}`;
            return (
              <li
                key={d}
                className={`english-week__day${completo ? ' is-done' : ''}${!completo && !futuro && !antes && !esHoy ? ' is-missed' : ''}${esHoy ? ' is-today' : ''}`}
                aria-label={`${esHoy ? 'Hoy' : DIAS[i]} ${parseDateKey(d).getDate()}: ${estado}`}
              >
                <span className="english-week__dot" aria-hidden="true">
                  {completo && <IconCheck />}
                </span>
                <span className="english-week__label" aria-hidden="true">
                  {esHoy ? 'Hoy' : DIAS[i]}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** Loora, YouTube, Text o Talk: lo que hiciste ese día y el formulario para anotar más. */
function EnglishSectionPage() {
  const { seccion } = useParams();
  const s = sectionById(seccion);
  const hoy = useToday();
  const [dia, setDia] = useState(hoy);
  const { data, update } = useDocument(englishStore);

  if (!s) {
    return (
      <div className="home">
        <HomeBar>
          <BackLink to="/english">English</BackLink>
        </HomeBar>
        <main className="empty-module">
          <p className="empty-module__text">Esta sección no existe.</p>
        </main>
      </div>
    );
  }

  const log = data ? dayLog(data, dia) : null;
  const entradas = log?.entries.filter((e) => e.section === s.id) ?? [];
  const done = !!log?.done.includes(s.id);
  const fecha = parseDateKey(dia);
  const mover = (n: number) => setDia(dateKey(addDays(fecha, n)));

  return (
    <div className="home">
      <HomeBar>
        <BackLink to="/english">English</BackLink>
      </HomeBar>
      <main className="english-section">
        <header className="english-section__head">
          <ModuleBadge module={s} />
          <div className="english-section__titles">
            <h1 className="english-section__title">{s.title}</h1>
            <div className="english-section__day">
              <button type="button" className="english-icon-btn" aria-label="Día anterior" onClick={() => mover(-1)}>
                <IconPrev className="ui-icon" />
              </button>
              <span>
                {dia === hoy ? 'Hoy' : weekdayName(fecha)}, {dayAndMonth(fecha)}
              </span>
              <button
                type="button"
                className="english-icon-btn"
                aria-label="Día siguiente"
                onClick={() => mover(1)}
                disabled={dia >= hoy}
              >
                <IconNext className="ui-icon" />
              </button>
            </div>
          </div>
          {data && (
            <label className="english-section__done">
              {done ? 'Hecho' : 'Sin hacer'}
              <DoneToggle section={s} done={done} large onToggle={() => update((d) => setSectionDone(d, dia, s.id, !done))} />
            </label>
          )}
        </header>

        {data && (
          <EntryForm
            key={`${s.id}-${dia}`}
            section={s}
            onAdd={(campos) => update((d) => addEntry(d, dia, s.id, campos))}
          />
        )}

        {data && (
          <section aria-label={`Lo de ${dia === hoy ? 'hoy' : dayAndMonth(fecha)}`}>
            {entradas.length === 0 ? (
              <p className="english-section__empty">
                Nada anotado {dia === hoy ? 'hoy' : 'ese día'}. Anota tu {s.entryName} arriba y se palomea sola.
              </p>
            ) : (
              <ul className="english-entries">
                {entradas.map((e) => (
                  <li key={e.id} className="english-entry">
                    <div className="english-entry__body">
                      {e.title && <p className="english-entry__title">{e.title}</p>}
                      {e.url && (
                        <a className="english-entry__url" href={e.url} target="_blank" rel="noreferrer">
                          {e.url}
                        </a>
                      )}
                      {e.body && <p className="english-entry__text">{e.body}</p>}
                      <p className="english-entry__time">
                        {new Date(e.createdAt).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="english-entry__delete"
                      aria-label={`Borrar ${e.title ?? e.url ?? s.entryName}`}
                      onClick={() => update((d) => deleteEntry(d, dia, e.id))}
                    >
                      <IconTrash className="ui-icon" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function EntryForm({
  section,
  onAdd,
}: {
  section: EnglishSection;
  onAdd: (campos: { title?: string; url?: string; body?: string }) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const listo = section.fields.every((f) => !f.required || valores[f.name]?.trim());

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!listo) return;
    onAdd(valores);
    setValores({});
  }

  return (
    <form className="english-form" onSubmit={enviar}>
      {section.fields.map((f) => {
        const comun = {
          id: `campo-${f.name}`,
          className: 'english-input',
          placeholder: f.placeholder,
          value: valores[f.name] ?? '',
          onChange: (e: { target: { value: string } }) => setValores((v) => ({ ...v, [f.name]: e.target.value })),
        };
        return (
          <div key={f.name} className={`english-form__field${f.multiline ? ' is-wide' : ''}`}>
            <label htmlFor={comun.id}>{f.label}</label>
            {f.multiline ? <textarea rows={4} {...comun} /> : <input {...comun} />}
          </div>
        );
      })}
      <button type="submit" className="english-form__btn" disabled={!listo}>
        Agregar {section.entryName}
      </button>
    </form>
  );
}
