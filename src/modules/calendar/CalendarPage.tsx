import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { addDays, dateKey, dayAndMonth, monthName, parseDateKey, weekdayName } from '../../core/dates';
import { useDocument } from '../../core/platform/document-store';
import { useToday } from '../../core/useToday';
import { AddChecksDialog } from './AddChecksDialog';
import { DayPanel } from './DayPanel';
import { IconCheck, IconNext, IconPrev } from '../../core/ui/icons';
import { addChecks, createActivity, monthWeeks, removeCheck, toggleCheck, type Activity } from './model';
import { calendarStore } from './store';
import './calendar.css';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const primeroDelMes = (fecha: Date) => new Date(fecha.getFullYear(), fecha.getMonth(), 1);

/** El mes a pantalla completa; cada día abre su panel de checks. */
export default function CalendarPage() {
  const { data, error, update } = useDocument(calendarStore);
  const [mes, setMes] = useState(() => primeroDelMes(new Date()));
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);

  const hoy = useToday();
  const semanas = monthWeeks(mes);
  // Con seis semanas las celdas son más bajas: cabe un check menos.
  const visibles = semanas.length > 5 ? 3 : 4;
  const actividades = new Map(data?.activities.map((a) => [a.id, a]));

  function cambiarMes(delta: number) {
    setMes((actual) => new Date(actual.getFullYear(), actual.getMonth() + delta, 1));
  }

  function irAHoy() {
    setMes(primeroDelMes(new Date()));
  }

  function moverDia(dias: number) {
    if (!diaAbierto) return;
    const fecha = addDays(parseDateKey(diaAbierto), dias);
    setDiaAbierto(dateKey(fecha));
    setMes(primeroDelMes(fecha));
  }

  function crearActividad(nombre: string, meta: string): Activity {
    let creada!: Activity;
    update((actual) => {
      const resultado = createActivity(actual, nombre, meta);
      creada = resultado.activity;
      return resultado.data;
    });
    return creada;
  }

  return (
    <div className="cal">
      <header className="cal-bar">
        <Link to="/" className="cal-back">
          <IconPrev />
          Inicio
        </Link>
        <h1 className="cal-bar__title">
          {monthName(mes)} <span>{mes.getFullYear()}</span>
        </h1>
        <div className="cal-bar__nav">
          <button type="button" className="cal-today-btn" onClick={irAHoy}>
            Hoy
          </button>
          <button type="button" className="cal-icon-btn" aria-label="Mes anterior" onClick={() => cambiarMes(-1)}>
            <IconPrev />
          </button>
          <button type="button" className="cal-icon-btn" aria-label="Mes siguiente" onClick={() => cambiarMes(1)}>
            <IconNext />
          </button>
        </div>
      </header>

      {error && (
        <p className="cal-error" role="alert">
          {error}
        </p>
      )}

      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cal-grid" style={{ gridTemplateRows: `repeat(${semanas.length}, minmax(0, 1fr))` }}>
        {semanas.flat().map((fecha) => {
          const clave = dateKey(fecha);
          const checks = (data?.days[clave] ?? []).filter((c) => actividades.has(c.activityId));
          const hechos = checks.filter((c) => c.done).length;
          const fueraDelMes = fecha.getMonth() !== mes.getMonth();
          const clases = [
            'cal-day',
            fueraDelMes && 'is-outside',
            clave === hoy && 'is-today',
            clave === diaAbierto && 'is-open',
            checks.length > 0 && hechos === checks.length && 'is-complete',
          ]
            .filter(Boolean)
            .join(' ');
          const resumen = checks.length ? `, ${hechos} de ${checks.length} hechos` : '';

          return (
            <button
              key={clave}
              type="button"
              className={clases}
              aria-label={`${weekdayName(fecha)} ${dayAndMonth(fecha)}${resumen}`}
              onClick={() => setDiaAbierto(clave)}
            >
              <span className="cal-day__head">
                <span className="cal-day__num">{fecha.getDate()}</span>
                {checks.length > 0 && (
                  <span className="cal-day__count">
                    {hechos}/{checks.length}
                  </span>
                )}
              </span>
              <span className="cal-day__checks">
                {checks.slice(0, visibles).map((check) => {
                  const actividad = actividades.get(check.activityId)!;
                  return (
                    <span
                      key={check.id}
                      className={`cal-chip${check.done ? ' is-done' : ''}`}
                      style={{ '--c': actividad.color } as CSSProperties}
                    >
                      <span className="cal-chip__mark">{check.done && <IconCheck />}</span>
                      <span className="cal-chip__name">{actividad.name}</span>
                    </span>
                  );
                })}
                {checks.length > visibles && <span className="cal-day__more">+{checks.length - visibles} más</span>}
              </span>
            </button>
          );
        })}
      </div>

      {data && diaAbierto && (
        <DayPanel
          day={diaAbierto}
          isToday={diaAbierto === hoy}
          data={data}
          onClose={() => setDiaAbierto(null)}
          onMove={moverDia}
          onToggle={(id) => update((d) => toggleCheck(d, diaAbierto, id))}
          onRemove={(id) => update((d) => removeCheck(d, diaAbierto, id))}
          onAdd={() => setAgregando(true)}
        />
      )}

      {data && diaAbierto && agregando && (
        <AddChecksDialog
          day={diaAbierto}
          data={data}
          onClose={() => setAgregando(false)}
          onAdd={(ids) => {
            update((d) => addChecks(d, diaAbierto, ids));
            setAgregando(false);
          }}
          onCreate={crearActividad}
        />
      )}
    </div>
  );
}
