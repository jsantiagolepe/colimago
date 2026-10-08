import type { CSSProperties } from 'react';
import { dayAndMonth, parseDateKey, weekdayName } from '../../core/dates';
import { useToday } from '../../core/useToday';
import { IconCheck } from '../../core/ui/icons';
import { usePendingSources } from './usePendingSources';
import { percentOf, weekProgress, weekSummary, type WeekDay } from './week';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function rango(dias: WeekDay[]) {
  const inicio = parseDateKey(dias[0].day);
  const fin = parseDateKey(dias[6].day);
  return inicio.getMonth() === fin.getMonth()
    ? `${inicio.getDate()} – ${dayAndMonth(fin)}`
    : `${dayAndMonth(inicio)} – ${dayAndMonth(fin)}`;
}

/** Qué dice cada columna al pasar el mouse o enfocarla. */
function describir(d: WeekDay, esHoy: boolean) {
  const fecha = parseDateKey(d.day);
  const nombre = `${esHoy ? 'Hoy' : weekdayName(fecha)} ${fecha.getDate()}`;
  if (d.total === 0) return `${nombre}: ${d.future ? 'todavía no llega' : 'sin pendientes'}`;
  if (d.future) return `${nombre}: ${d.total} ${d.total === 1 ? 'pendiente' : 'pendientes'}, todavía no llega`;
  return `${nombre}: ${d.done} de ${d.total} resueltos, ${percentOf(d)}%`;
}

/**
 * La semana de lunes a domingo: qué porcentaje de lo que tocaba cada día
 * (checks de Calendar y tareas con esa fecha) quedó resuelto. Una sola
 * serie de 0 a 100%, con el valor escrito en cada columna.
 */
export function WeekCard() {
  const fuentes = usePendingSources();
  const hoy = useToday();
  const dias = weekProgress(
    fuentes.map((m) => m.pending),
    hoy,
  );
  const resumen = dias && weekSummary(dias);

  return (
    <section className="week" aria-labelledby="week-titulo">
      <header className="week__head">
        <div>
          <h2 id="week-titulo" className="week__title">
            Tu semana
          </h2>
          <p className="week__range">{dias ? rango(dias) : ' '}</p>
        </div>
        {resumen && resumen.percent !== null && (
          <div className="week__summary">
            <span className="week__percent">{resumen.percent}%</span>
            <span className="week__caption">
              {resumen.completeDays} de {resumen.daysWithItems} {resumen.daysWithItems === 1 ? 'día' : 'días'} al 100%
            </span>
          </div>
        )}
      </header>

      {dias && (
        <ol className="week__chart">
          {dias.map((d, i) => {
            const esHoy = d.day === hoy;
            const pct = percentOf(d);
            const completo = !d.future && d.total > 0 && d.done === d.total;
            const etiqueta = describir(d, esHoy);
            return (
              <li
                key={d.day}
                className={`week__col${esHoy ? ' is-today' : ''}${d.future ? ' is-future' : ''}`}
                tabIndex={0}
                aria-label={etiqueta}
              >
                <span className="week__value" aria-hidden="true">
                  {d.future || pct === null ? (
                    '—'
                  ) : (
                    <>
                      {completo && <IconCheck className="ui-icon week__check" />}
                      {pct}%
                    </>
                  )}
                </span>
                <span className="week__track" aria-hidden="true">
                  {!d.future && pct !== null && pct > 0 && (
                    <span className="week__bar" style={{ '--pct': `${pct}%` } as CSSProperties} />
                  )}
                </span>
                <span className="week__day" aria-hidden="true">
                  {esHoy ? 'Hoy' : DIAS[i]}
                </span>
                <span className="week__tip" aria-hidden="true">
                  {etiqueta}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
