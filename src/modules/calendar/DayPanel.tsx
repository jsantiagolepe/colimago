import type { CSSProperties } from 'react';
import { Dialog } from '../../core/ui/Dialog';
import { dayAndMonth, parseDateKey, weekdayName } from '../../core/dates';
import { IconCheck, IconClose, IconNext, IconPlus, IconPrev } from '../../core/ui/icons';
import type { CalendarData } from './model';

/** Panel lateral de un día: sus checks, marcarlos, quitarlos y agregar más. */
export function DayPanel({
  day,
  isToday,
  data,
  onClose,
  onMove,
  onToggle,
  onRemove,
  onAdd,
}: {
  day: string;
  isToday: boolean;
  data: CalendarData;
  onClose: () => void;
  /** Ir al día anterior (-1) o siguiente (+1). */
  onMove: (dias: number) => void;
  onToggle: (checkId: string) => void;
  onRemove: (checkId: string) => void;
  onAdd: () => void;
}) {
  const fecha = parseDateKey(day);
  const actividades = new Map(data.activities.map((a) => [a.id, a]));
  const checks = (data.days[day] ?? []).filter((c) => actividades.has(c.activityId));
  const hechos = checks.filter((c) => c.done).length;

  return (
    <Dialog className="cal-panel" labelledBy="cal-panel-titulo" onClose={onClose}>
      <div className="cal-panel__inner">
        <header className="cal-panel__head">
          <div>
            <p className="cal-panel__eyebrow">{isToday ? `Hoy · ${weekdayName(fecha)}` : weekdayName(fecha)}</p>
            <h2 id="cal-panel-titulo" className="cal-panel__title">
              {dayAndMonth(fecha)}
            </h2>
          </div>
          <div className="cal-panel__tools">
            <button type="button" className="cal-icon-btn" aria-label="Día anterior" onClick={() => onMove(-1)}>
              <IconPrev />
            </button>
            <button type="button" className="cal-icon-btn" aria-label="Día siguiente" onClick={() => onMove(1)}>
              <IconNext />
            </button>
            <button type="button" className="cal-icon-btn" aria-label="Cerrar" onClick={onClose}>
              <IconClose />
            </button>
          </div>
        </header>

        {checks.length > 0 ? (
          <>
            <div className="cal-progress" aria-live="polite">
              <span className="cal-progress__text">
                {hechos === checks.length ? '¡Todo hecho!' : `${hechos} de ${checks.length} hechos`}
              </span>
              <span className="cal-progress__bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${hechos / checks.length})` }} />
              </span>
            </div>

            <ul className="cal-checks">
              {checks.map((check) => {
                const actividad = actividades.get(check.activityId)!;
                return (
                  <li
                    key={check.id}
                    className={`cal-check${check.done ? ' is-done' : ''}`}
                    style={{ '--c': actividad.color } as CSSProperties}
                  >
                    <button
                      type="button"
                      className="cal-check__toggle"
                      role="checkbox"
                      aria-checked={check.done}
                      onClick={() => onToggle(check.id)}
                    >
                      <span className="cal-check__box">{check.done && <IconCheck />}</span>
                      <span className="cal-check__text">
                        <span className="cal-check__name">{actividad.name}</span>
                        {actividad.goal && <span className="cal-check__goal">{actividad.goal}</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="cal-check__remove"
                      aria-label={`Quitar ${actividad.name} de este día`}
                      onClick={() => onRemove(check.id)}
                    >
                      <IconClose />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="cal-panel__empty">Nada para este día todavía. Agrega lo que quieres cumplir.</p>
        )}

        <button type="button" className="cal-add-row" onClick={onAdd}>
          <IconPlus />
          Agregar
        </button>
      </div>
    </Dialog>
  );
}
