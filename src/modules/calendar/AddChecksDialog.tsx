import { useState, type CSSProperties, type FormEvent } from 'react';
import { Dialog } from '../../core/ui/Dialog';
import { dayAndMonth, parseDateKey } from '../../core/dates';
import { IconCheck, IconPlus } from '../../core/ui/icons';
import type { Activity, CalendarData } from './model';

/** Modal con el catálogo de actividades para ponerlas como checks en un día. */
export function AddChecksDialog({
  day,
  data,
  onClose,
  onAdd,
  onCreate,
}: {
  day: string;
  data: CalendarData;
  onClose: () => void;
  onAdd: (activityIds: string[]) => void;
  /** Crea la actividad en el catálogo y la regresa. */
  onCreate: (name: string, goal: string) => Activity;
}) {
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [meta, setMeta] = useState('');
  const yaEstan = new Set((data.days[day] ?? []).map((c) => c.activityId));

  function alternar(id: string) {
    setElegidas((actual) => (actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]));
  }

  function crear(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    const actividad = onCreate(nombre, meta);
    setElegidas((actual) => [...actual, actividad.id]);
    setNombre('');
    setMeta('');
    setCreando(false);
  }

  return (
    <Dialog className="cal-add" labelledBy="cal-add-titulo" onClose={onClose}>
      <div className="cal-add__inner">
        <header className="cal-add__head">
          <h2 id="cal-add-titulo" className="cal-add__title">
            Agregar al {dayAndMonth(parseDateKey(day))}
          </h2>
          <p className="cal-add__hint">Elige lo que quieres cumplir ese día.</p>
        </header>

        <ul className="cal-options">
          {data.activities.map((actividad) => {
            const yaEsta = yaEstan.has(actividad.id);
            return (
              <li key={actividad.id}>
                <label
                  className={`cal-option${yaEsta ? ' is-disabled' : ''}`}
                  style={{ '--c': actividad.color } as CSSProperties}
                >
                  <input
                    type="checkbox"
                    className="cal-option__input"
                    checked={yaEsta || elegidas.includes(actividad.id)}
                    disabled={yaEsta}
                    onChange={() => alternar(actividad.id)}
                  />
                  <span className="cal-option__box" aria-hidden="true">
                    <IconCheck />
                  </span>
                  <span className="cal-option__name">{actividad.name}</span>
                  {actividad.goal && <span className="cal-option__goal">{actividad.goal}</span>}
                  {yaEsta && <span className="cal-option__tag">Ya está</span>}
                </label>
              </li>
            );
          })}
        </ul>

        {creando ? (
          <form className="cal-new" onSubmit={crear}>
            <input
              className="cal-input"
              placeholder="Nombre, p. ej. Nadar"
              aria-label="Nombre de la actividad"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
            <input
              className="cal-input cal-input--short"
              placeholder="Meta, p. ej. 30 min"
              aria-label="Meta (opcional)"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
            />
            <button type="submit" className="cal-secondary" disabled={!nombre.trim()}>
              Crear
            </button>
          </form>
        ) : (
          <button type="button" className="cal-new-btn" onClick={() => setCreando(true)}>
            <IconPlus />
            Nueva actividad
          </button>
        )}

        <footer className="cal-add__foot">
          <button type="button" className="cal-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="cal-primary"
            disabled={elegidas.length === 0}
            onClick={() => onAdd(elegidas)}
          >
            {elegidas.length > 1 ? `Agregar ${elegidas.length}` : 'Agregar'}
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
