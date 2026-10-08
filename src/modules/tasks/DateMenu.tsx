import { useEffect, useRef, useState } from 'react';
import { addDays, dateKey, parseDateKey, relativeDate } from '../../core/dates';
import { IconCalendar } from '../../core/ui/icons';

const diaCorto = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const pista = (key: string) => diaCorto.format(parseDateKey(key)).replace(/\./g, '');

/** El próximo lunes (si hoy es lunes, el de la semana que entra). */
function proximoLunes(hoy: Date) {
  return addDays(hoy, ((8 - hoy.getDay()) % 7) || 7);
}

/** Botón con la fecha de una tarea y un menú para cambiarla o quitarla. */
export function DateMenu({
  value,
  today,
  overdue = false,
  onChange,
}: {
  value?: string;
  today: string;
  overdue?: boolean;
  onChange: (due?: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  function elegir(due?: string) {
    onChange(due);
    setAbierto(false);
  }

  const hoy = parseDateKey(today);
  const opciones: [string, string][] = [
    ['Hoy', today],
    ['Mañana', dateKey(addDays(hoy, 1))],
    ['Próxima semana', dateKey(proximoLunes(hoy))],
  ];

  return (
    <div className="date-menu" ref={raiz}>
      <button
        type="button"
        className={`date-menu__trigger${value ? ' has-value' : ''}${overdue ? ' is-overdue' : ''}`}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label={value ? `Fecha: ${relativeDate(value, today)}. Cambiar` : 'Ponerle fecha'}
        onClick={() => setAbierto((a) => !a)}
      >
        <IconCalendar />
        {value ? relativeDate(value, today) : 'Fecha'}
      </button>

      {abierto && (
        <div className="date-menu__popover">
          {opciones.map(([texto, key]) => (
            <button
              key={texto}
              type="button"
              className={`date-menu__option${value === key ? ' is-selected' : ''}`}
              onClick={() => elegir(key)}
            >
              {texto}
              <span>{pista(key)}</span>
            </button>
          ))}
          <label className="date-menu__custom">
            Otra fecha
            {/* No cierra el menú: mientras escribes el año, el campo pasa por
                fechas como 0002-10-15 que no se deben guardar. */}
            <input
              type="date"
              value={value ?? ''}
              onChange={(e) => /^20\d\d-/.test(e.target.value) && onChange(e.target.value)}
            />
          </label>
          {value && (
            <button type="button" className="date-menu__option is-danger" onClick={() => elegir(undefined)}>
              Quitar fecha
            </button>
          )}
        </div>
      )}
    </div>
  );
}
