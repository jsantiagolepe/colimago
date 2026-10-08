import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, Route, Routes, useParams } from 'react-router';
import { addDays, dateKey, dayAndMonth, parseDateKey, relativeDate, weekdayName } from '../../core/dates';
import { useDocument } from '../../core/platform/document-store';
import { useToday } from '../../core/useToday';
import { IconCheck, IconNext, IconPrev } from '../../core/ui/icons';
import { HomeBar, ModuleBadge } from '../../features/home/HomePage';
import { BackLink, DoneMark, EmptySectionPage, HubCardContent, HubLayout } from '../../features/home/hub';
import { weekOf } from '../../features/home/week';
import {
  isComplete,
  platformDone,
  platformTotal,
  recordedCount,
  recordedItems,
  setValues,
  streak,
  sum,
  TOTAL,
  valueOf,
  type ScoreData,
} from './model';
import { PLATFORMS, platformById, type PlatformInfo } from './platforms';
import { ScoreTrend } from './ScoreTrend';
import { scoreStore } from './store';
import './score.css';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const numero = new Intl.NumberFormat('es-MX');

export default function ScorePage() {
  return (
    <Routes>
      <Route index element={<ScoreHome />} />
      <Route path=":plataforma" element={<PlatformPage />} />
    </Routes>
  );
}

function ScoreHome() {
  const { data } = useDocument(scoreStore);
  const hoy = useToday();

  return (
    <HubLayout title="Score" big={<ScoreStats data={data} today={hoy} />}>
      <ul className="home__grid hub-grid score-grid">
        {PLATFORMS.map((p) => {
          const total = data ? platformTotal(data, hoy, p.id) : null;
          const llevas = data ? recordedItems(data, hoy, p.id) : 0;
          const descripcion =
            total === null
              ? p.description
              : `Hoy: ${numero.format(total)} ${p.metric}${llevas < p.items.length ? ` (${llevas} de ${p.items.length} ${p.itemsName})` : ''}`;
          return (
            <li key={p.id} className="hub-card">
              <Link to={p.id} className="home-card">
                <HubCardContent section={{ ...p, description: descripcion }} />
              </Link>
              {data && <DoneMark section={p} done={platformDone(data, hoy, p.id)} />}
            </li>
          );
        })}
      </ul>
      {data && <ScoreTrend data={data} today={hoy} />}
    </HubLayout>
  );
}

/** Lo de la semana por plataforma, la racha y los días con todo anotado. */
function ScoreStats({ data, today }: { data: ScoreData | null; today: string }) {
  if (!data) return <section className="hub-big" aria-busy="true" />;

  const semana = weekOf(today);
  const hastaHoy = semana.filter((d) => d <= today);
  const faltan = TOTAL - recordedCount(data, today);
  const racha = streak(data, today);

  return (
    <section className="hub-big score-big" aria-labelledby="score-titulo">
      <div className="score-big__main">
        <div className="score-big__head">
          <h2 id="score-titulo" className="score-big__title">
            Tu score
          </h2>
          <span className="score-big__streak">
            {racha} {racha === 1 ? 'día' : 'días'} seguidos con todo anotado
          </span>
        </div>
        <ul className="score-figures">
          {PLATFORMS.map((p) => {
            const hoyValor = platformTotal(data, today, p.id);
            return (
              <li key={p.id} className="score-figure" style={{ '--c': p.color } as CSSProperties} data-platform={p.id}>
                <span className="score-figure__label">
                  <span className="score-figure__dot" aria-hidden="true" />
                  {p.title} · {p.metric}
                </span>
                <span className="score-figure__number">{numero.format(sum(data, hastaHoy, p.id))}</span>
                <span className="score-figure__sub">
                  esta semana · hoy {hoyValor === null ? '—' : numero.format(hoyValor)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="score-big__side">
        <span className={`score-count${faltan === 0 ? ' is-zero' : ''}`} aria-label={`${faltan} por anotar hoy`}>
          {faltan}
        </span>
        <ol className="score-week" aria-label="Días de esta semana con todo anotado">
          {semana.map((d, i) => {
            const esHoy = d === today;
            const futuro = d > today;
            const antes = d < data.startedOn;
            const completo = isComplete(data, d);
            const estado = completo ? 'completo' : futuro ? 'todavía no llega' : antes ? 'antes de empezar' : `${recordedCount(data, d)} de ${TOTAL}`;
            return (
              <li
                key={d}
                className={`score-week__day${completo ? ' is-done' : ''}${!completo && !futuro && !antes && !esHoy ? ' is-missed' : ''}${esHoy ? ' is-today' : ''}`}
                aria-label={`${esHoy ? 'Hoy' : DIAS[i]} ${parseDateKey(d).getDate()}: ${estado}`}
              >
                <span className="score-week__dot" aria-hidden="true">
                  {completo && <IconCheck />}
                </span>
                <span className="score-week__label" aria-hidden="true">
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

/** Escribir los números de un día (uno por app o página) y ver los últimos días. */
function PlatformPage() {
  const { plataforma } = useParams();
  const p = platformById(plataforma);
  const hoy = useToday();
  const [dia, setDia] = useState(hoy);
  const { data, update } = useDocument(scoreStore);

  if (!p) return <EmptySectionPage back={{ to: '/score', label: 'Score' }} />;

  const fecha = parseDateKey(dia);
  const listo = data ? platformDone(data, dia, p.id) : false;
  const llevas = data ? recordedItems(data, dia, p.id) : 0;
  const ultimos = Array.from({ length: 14 }, (_, i) => dateKey(addDays(parseDateKey(hoy), -i)));
  const semana = weekOf(hoy).filter((d) => d <= hoy);

  return (
    <div className="home">
      <HomeBar>
        <BackLink to="/score">Score</BackLink>
      </HomeBar>
      <main className="score-page">
        <header className="score-page__head">
          <ModuleBadge module={p} />
          <div className="score-page__titles">
            <h1 className="score-page__title">{p.title}</h1>
            <div className="score-page__day">
              <button type="button" className="score-icon-btn" aria-label="Día anterior" onClick={() => setDia(dateKey(addDays(fecha, -1)))}>
                <IconPrev className="ui-icon" />
              </button>
              <span>
                {dia === hoy ? 'Hoy' : weekdayName(fecha)}, {dayAndMonth(fecha)}
              </span>
              <button
                type="button"
                className="score-icon-btn"
                aria-label="Día siguiente"
                onClick={() => setDia(dateKey(addDays(fecha, 1)))}
                disabled={dia >= hoy}
              >
                <IconNext className="ui-icon" />
              </button>
            </div>
          </div>
          <span className="score-page__state">
            {listo ? 'Todo anotado' : `${llevas} de ${p.items.length} ${p.itemsName}`}
            <DoneMark section={p} done={listo} large />
          </span>
        </header>

        {data && (
          <ValuesForm
            key={`${p.id}-${dia}`}
            platform={p}
            title={`${p.metric.charAt(0).toUpperCase()}${p.metric.slice(1)} ${dia === hoy ? 'de hoy' : `del ${dayAndMonth(fecha)}`}`}
            values={Object.fromEntries(p.items.map((i) => [i.id, valueOf(data, dia, p.id, i.id)]))}
            onSave={(v) => update((d) => setValues(d, dia, p.id, v))}
          />
        )}

        {data && (
          <section className="score-history" aria-labelledby="score-historial">
            <div className="score-history__head">
              <h2 id="score-historial" className="score-history__title">
                Últimos 14 días
              </h2>
              <span className="score-history__total">
                Esta semana: <strong>{numero.format(sum(data, semana, p.id))}</strong> {p.metric}
              </span>
            </div>
            <ul className="score-history__list">
              {ultimos.map((d) => {
                const total = platformTotal(data, d, p.id);
                const n = recordedItems(data, d, p.id);
                return (
                  <li key={d}>
                    <button
                      type="button"
                      className={`score-history__row${d === dia ? ' is-current' : ''}`}
                      onClick={() => setDia(d)}
                    >
                      <span>{relativeDate(d, hoy)}</span>
                      <span className={total === null ? 'is-empty' : ''}>
                        {total === null ? 'Sin anotar' : numero.format(total)}
                        {total !== null && n < p.items.length && (
                          <span className="score-history__partial">
                            {' '}
                            ({n} de {p.items.length})
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function ValuesForm({
  platform,
  title,
  values,
  onSave,
}: {
  platform: PlatformInfo;
  title: string;
  values: Record<string, number | undefined>;
  onSave: (v: Record<string, number | undefined>) => void;
}) {
  const inicial = Object.fromEntries(platform.items.map((i) => [i.id, values[i.id] === undefined ? '' : String(values[i.id])]));
  const [textos, setTextos] = useState<Record<string, string>>(inicial);
  const leer = (t: string) => (t.trim() === '' ? undefined : Number(t.replace(/[,\s]/g, '')));
  const leidos = Object.fromEntries(platform.items.map((i) => [i.id, leer(textos[i.id] ?? '')]));
  const invalido = Object.values(leidos).some((v) => v !== undefined && (!Number.isFinite(v) || v < 0));
  const cambio = platform.items.some((i) => leidos[i.id] !== values[i.id]);
  const total = Object.values(leidos).reduce<number>((s, v) => s + (v !== undefined && Number.isFinite(v) ? v : 0), 0);

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (!invalido && cambio) onSave(leidos);
  }

  return (
    <form className="score-form" onSubmit={guardar}>
      <div className="score-form__head">
        <h2 className="score-form__title">{title}</h2>
        <span className="score-form__total">
          Total: <strong>{numero.format(total)}</strong>
        </span>
      </div>
      <div className="score-form__items">
        {platform.items.map((item, idx) => (
          <label key={item.id} className="score-form__item">
            <span>{item.name}</span>
            <input
              className="score-form__input"
              inputMode="numeric"
              placeholder="0"
              value={textos[item.id] ?? ''}
              onChange={(e) => setTextos((t) => ({ ...t, [item.id]: e.target.value }))}
              autoFocus={idx === 0}
            />
          </label>
        ))}
      </div>
      <div className="score-form__actions">
        {invalido && <span className="score-form__error">Solo números de 0 en adelante.</span>}
        <button type="submit" className="score-form__btn" disabled={invalido || !cambio}>
          Guardar
        </button>
      </div>
    </form>
  );
}
