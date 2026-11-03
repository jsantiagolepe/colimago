import { useState, type CSSProperties } from 'react';
import { parseDateKey } from '../../core/dates';
import { useDocument } from '../../core/platform/document-store';
import { useToday } from '../../core/useToday';
import { IconCheck } from '../../core/ui/icons';
import { HomeBar } from '../../features/home/HomePage';
import { BackLink } from '../../features/home/hub';
import {
  calendarWeek,
  currentPhase,
  isDone,
  milestones,
  nextTask,
  pace,
  percent,
  phaseCounts,
  reschedule,
  setTaskDone,
  totalCounts,
  weekCounts,
  weekEnd,
  weekStart,
  type GrcData,
} from './model';
import {
  COMPANY,
  KINDS,
  PHASES,
  RESOURCES,
  RULES,
  TOTAL_WEEKS,
  weekOfTask,
  type RoadmapPhase,
  type RoadmapTask,
  type RoadmapWeek,
} from './roadmap';
import { grcStore } from './store';
import '../../features/home/home.css';
import './grc.css';

const corta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const larga = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = (key: string) => corta.format(parseDateKey(key)).replace('.', '');
const fechaLarga = (key: string) => larga.format(parseDateKey(key));

type Tab = string; // id de una fase, 'recursos' o 'metodo'

/** GRC: tu ruta de 6 meses, semana por semana, con cada paso para palomear. */
export default function GrcPage() {
  const { data, error, update } = useDocument(grcStore);
  const hoy = useToday();
  const [tab, setTab] = useState<Tab | null>(null);

  const alternar = (taskId: string) => update((d) => setTaskDone(d, taskId, !isDone(d, taskId), hoy));
  const pestana = tab ?? (data ? currentPhase(data).id : PHASES[0].id);

  function irASemana(n: number) {
    const fase = PHASES.find((p) => p.weeks.some((w) => w.n === n));
    if (fase) setTab(fase.id);
    requestAnimationFrame(() =>
      document.getElementById(`grc-semana-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  return (
    <div className="home grc">
      <HomeBar>
        <BackLink to="/">Inicio</BackLink>
      </HomeBar>
      <main className="grc__main">
        <h1 className="mp-sr-only">GRC</h1>
        {error && <p className="grc-error">{error}</p>}
        {!data ? (
          <section className="grc-hero" aria-busy="true" />
        ) : (
          <>
            <Hero
              data={data}
              today={hoy}
              onToggle={alternar}
              onGoToWeek={irASemana}
              onReschedule={() => update((d) => reschedule(d, hoy))}
            />
            <Milestones data={data} onGoToWeek={irASemana} />
            <Tabs data={data} current={pestana} onChange={setTab} />
            {pestana === 'recursos' ? (
              <ResourcesView />
            ) : pestana === 'metodo' ? (
              <MethodView data={data} today={hoy} onReschedule={() => update((d) => reschedule(d, hoy))} />
            ) : (
              <PhaseView
                phase={PHASES.find((p) => p.id === pestana) ?? PHASES[0]}
                data={data}
                today={hoy}
                onToggle={alternar}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ---------- Arriba: avance y siguiente paso ---------- */

function Hero({
  data,
  today,
  onToggle,
  onGoToWeek,
  onReschedule,
}: {
  data: GrcData;
  today: string;
  onToggle: (taskId: string) => void;
  onGoToWeek: (n: number) => void;
  onReschedule: () => void;
}) {
  const totales = totalCounts(data);
  const pct = percent(totales);
  const semanaHoy = Math.min(Math.max(calendarWeek(data, today), 1), TOTAL_WEEKS);
  const fase = PHASES.find((p) => p.weeks.some((w) => w.n === semanaHoy))!;
  const ritmo = pace(data, today);
  const paso = nextTask(data);
  const semanaPaso = paso ? weekOfTask(paso.id)! : null;

  return (
    <section className="grc-hero" aria-labelledby="grc-hero-titulo">
      <div className="grc-hero__main">
        <p className="grc-eyebrow">Ruta GRC · 6 meses</p>
        <h2 id="grc-hero-titulo" className="grc-hero__title">
          Semana {semanaHoy} de {TOTAL_WEEKS}
          <span className="grc-hero__phase">
            {' '}
            · Mes {fase.month}: {fase.title}
          </span>
        </h2>

        <div
          className="grc-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Avance de la ruta"
        >
          <span className="grc-progress__bar" style={{ width: `${pct}%` }} />
        </div>
        <p className="grc-hero__figures">
          <strong>
            {totales.done} de {totales.total}
          </strong>{' '}
          pasos · {pct} %
        </p>

        <div className="grc-hero__foot">
          <PaceBadge pace={ritmo} onReschedule={onReschedule} />
          <span className="grc-hero__dates">
            Del {fechaLarga(weekStart(data, 1))} al {fechaLarga(weekEnd(data, TOTAL_WEEKS))}
          </span>
        </div>
      </div>

      <div className="grc-next">
        <p className="grc-next__label">Siguiente paso</p>
        {paso && semanaPaso ? (
          <>
            <div className="grc-next__row">
              <CheckButton
                done={false}
                color={KINDS[paso.kind].color}
                label={paso.title}
                onToggle={() => onToggle(paso.id)}
                large
              />
              <div className="grc-next__text">
                <p className="grc-next__title">{paso.title}</p>
                {paso.detail && <p className="grc-next__detail">{paso.detail}</p>}
              </div>
            </div>
            <button type="button" className="grc-link-button" onClick={() => onGoToWeek(semanaPaso.n)}>
              Semana {semanaPaso.n}: {semanaPaso.title} →
            </button>
          </>
        ) : (
          <p className="grc-next__title">Terminaste toda la ruta. Felicidades.</p>
        )}
      </div>
    </section>
  );
}

function PaceBadge({ pace: ritmo, onReschedule }: { pace: ReturnType<typeof pace>; onReschedule: () => void }) {
  if (ritmo.status === 'terminado') return <span className="grc-pace is-ok">Ruta completa</span>;
  if (ritmo.status === 'al-dia') return <span className="grc-pace is-ok">Vas al día</span>;
  if (ritmo.status === 'adelantado')
    return (
      <span className="grc-pace is-ahead">
        Vas {ritmo.weeks} {ritmo.weeks === 1 ? 'semana' : 'semanas'} adelantado
      </span>
    );
  return (
    <span className="grc-pace is-late">
      Vas {ritmo.weeks} {ritmo.weeks === 1 ? 'semana' : 'semanas'} atrás
      <button type="button" className="grc-pace__action" onClick={onReschedule}>
        Reprogramar desde hoy
      </button>
    </span>
  );
}

/* ---------- Hitos ---------- */

function Milestones({ data, onGoToWeek }: { data: GrcData; onGoToWeek: (n: number) => void }) {
  return (
    <ol className="grc-milestones" aria-label="Hitos">
      {milestones(data).map((m) => (
        <li key={m.task.id}>
          <button
            type="button"
            className={`grc-milestone${m.done ? ' is-done' : ''}`}
            onClick={() => onGoToWeek(m.week.n)}
            title={m.task.title}
          >
            <span className="grc-milestone__dot" aria-hidden="true">
              {m.done && <IconCheck />}
            </span>
            <span className="grc-milestone__name">{m.task.milestone}</span>
            <span className="grc-milestone__due">
              {m.done ? 'Hecho' : `Sem ${m.week.n} · ${fechaCorta(m.due)}`}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Pestañas ---------- */

function Tabs({ data, current, onChange }: { data: GrcData; current: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="grc-tabs" role="tablist" aria-label="Secciones de la ruta">
      {PHASES.map((p) => {
        const c = phaseCounts(data, p);
        const completa = c.done === c.total;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={current === p.id}
            className={`grc-tab${current === p.id ? ' is-active' : ''}${completa ? ' is-complete' : ''}`}
            style={{ '--c': p.color } as CSSProperties}
            onClick={() => onChange(p.id)}
          >
            <span className="grc-tab__name">Mes {p.month}</span>
            <span className="grc-tab__meter" aria-hidden="true">
              <span style={{ width: `${percent(c)}%` }} />
            </span>
            <span className="grc-tab__count">
              {c.done}/{c.total}
            </span>
          </button>
        );
      })}
      <span className="grc-tabs__sep" aria-hidden="true" />
      {[
        ['recursos', 'Recursos'],
        ['metodo', 'Método'],
      ].map(([id, nombre]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={current === id}
          className={`grc-tab grc-tab--plain${current === id ? ' is-active' : ''}`}
          onClick={() => onChange(id)}
        >
          <span className="grc-tab__name">{nombre}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Un mes ---------- */

function PhaseView({
  phase,
  data,
  today,
  onToggle,
}: {
  phase: RoadmapPhase;
  data: GrcData;
  today: string;
  onToggle: (taskId: string) => void;
}) {
  const c = phaseCounts(data, phase);
  const semanaHoy = calendarWeek(data, today);
  return (
    <section className="grc-phase" style={{ '--c': phase.color } as CSSProperties} aria-labelledby="grc-fase-titulo">
      <header className="grc-phase__head">
        <div>
          <p className="grc-eyebrow">
            Mes {phase.month} · semanas {phase.weeks[0].n} a {phase.weeks[phase.weeks.length - 1].n}
          </p>
          <h2 id="grc-fase-titulo" className="grc-phase__title">
            {phase.title}
          </h2>
          <p className="grc-phase__summary">{phase.summary}</p>
        </div>
        <span className="grc-count">
          {c.done}/{c.total}
        </span>
      </header>
      <ol className="grc-weeks">
        {phase.weeks.map((w) => (
          <WeekCard key={w.n} week={w} data={data} isNow={w.n === semanaHoy} onToggle={onToggle} />
        ))}
      </ol>
    </section>
  );
}

function WeekCard({
  week,
  data,
  isNow,
  onToggle,
}: {
  week: RoadmapWeek;
  data: GrcData;
  isNow: boolean;
  onToggle: (taskId: string) => void;
}) {
  const c = weekCounts(data, week);
  const completa = c.done === c.total;
  return (
    <li
      id={`grc-semana-${week.n}`}
      className={`grc-week${isNow ? ' is-now' : ''}${completa ? ' is-complete' : ''}`}
    >
      <header className="grc-week__head">
        <div className="grc-week__titles">
          <p className="grc-week__meta">
            Semana {week.n} · {fechaCorta(weekStart(data, week.n))} – {fechaCorta(weekEnd(data, week.n))}
            {isNow && <span className="grc-week__now">Esta semana</span>}
          </p>
          <h3 className="grc-week__title">{week.title}</h3>
          <p className="grc-week__goal">{week.goal}</p>
        </div>
        <span className={`grc-count${completa ? ' is-complete' : ''}`}>
          {completa ? <IconCheck /> : `${c.done}/${c.total}`}
        </span>
      </header>
      <ul className="grc-tasks">
        {week.tasks.map((t) => (
          <TaskRow key={t.id} task={t} done={isDone(data, t.id)} onToggle={() => onToggle(t.id)} />
        ))}
      </ul>
    </li>
  );
}

function TaskRow({ task, done, onToggle }: { task: RoadmapTask; done: boolean; onToggle: () => void }) {
  const tipo = KINDS[task.kind];
  return (
    <li className={`grc-task${done ? ' is-done' : ''}`}>
      <CheckButton done={done} color={tipo.color} label={task.title} onToggle={onToggle} />
      <div className="grc-task__body">
        <p className="grc-task__title">{task.title}</p>
        {task.detail && <p className="grc-task__detail">{task.detail}</p>}
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
    </li>
  );
}

function CheckButton({
  done,
  color,
  label,
  onToggle,
  large = false,
}: {
  done: boolean;
  color: string;
  label: string;
  onToggle: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      className={`grc-check${done ? ' is-done' : ''}${large ? ' grc-check--large' : ''}`}
      style={{ '--c': color } as CSSProperties}
      onClick={onToggle}
    >
      {done && <IconCheck />}
    </button>
  );
}

/* ---------- Recursos y método ---------- */

function ResourcesView() {
  return (
    <section className="grc-resources" aria-label="Recursos">
      {RESOURCES.map((grupo) => (
        <div key={grupo.title} className="grc-resources__group">
          <h2 className="grc-section-title">{grupo.title}</h2>
          <ul className="grc-resources__list">
            {grupo.items.map((r) => (
              <li key={r.url}>
                <a className="grc-resource" href={r.url} target="_blank" rel="noreferrer">
                  <span className="grc-resource__name">{r.label} ↗</span>
                  <span className="grc-resource__note">{r.note}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="grc-footnote">Precios aproximados a noviembre de 2026; confírmalos antes de pagar.</p>
    </section>
  );
}

function MethodView({ data, today, onReschedule }: { data: GrcData; today: string; onReschedule: () => void }) {
  const ritmo = pace(data, today);
  return (
    <section className="grc-method" aria-label="Método">
      <div className="grc-company">
        <p className="grc-eyebrow">Tu empresa ficticia</p>
        <h2 className="grc-company__name">{COMPANY.name}</h2>
        <p className="grc-company__pitch">{COMPANY.pitch}</p>
      </div>

      <h2 className="grc-section-title">Reglas para no perder el hilo</h2>
      <ul className="grc-rules">
        {RULES.map((r, i) => (
          <li key={r.title} className="grc-rule">
            <span className="grc-rule__n">{i + 1}</span>
            <div>
              <p className="grc-rule__title">{r.title}</p>
              <p className="grc-rule__text">{r.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="grc-calendar">
        <div>
          <p className="grc-rule__title">Tu calendario</p>
          <p className="grc-rule__text">
            La semana 1 empezó el {fechaLarga(data.startedOn)}. Tu siguiente paso aparece también en Pendientes, en el
            inicio. Si una semana se complica, reprograma: las fechas se recorren y lo que ya hiciste se queda.
          </p>
        </div>
        <button
          type="button"
          className="grc-button"
          onClick={onReschedule}
          disabled={ritmo.status === 'al-dia' || ritmo.status === 'terminado'}
        >
          Reprogramar desde hoy
        </button>
      </div>
    </section>
  );
}
