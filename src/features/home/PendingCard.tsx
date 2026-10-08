import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { dayAndMonth, parseDateKey, weekdayName } from '../../core/dates';
import { useToday } from '../../core/useToday';
import { IconCheck } from '../../core/ui/icons';
import { usePendingSources } from './usePendingSources';

/**
 * Lo que falta hoy en todos los módulos que tienen pendientes (Calendar,
 * Tareas…). La tarjeta no crece: si hay más de lo que cabe, la lista se
 * recorre. Se pueden palomear aquí mismo; lo que palomeas se queda a la
 * vista, tachado, hasta que sales del inicio.
 */
export function PendingCard() {
  const fuentes = usePendingSources();
  const hoy = useToday();
  const [palomeados, setPalomeados] = useState<ReadonlySet<string>>(new Set());

  const listas = fuentes.map((module) => ({ module, items: module.pending.items(hoy) }));
  const cargando = listas.some((l) => l.items === null);
  const filas = listas
    .flatMap(({ module, items }) =>
      (items ?? []).map((item) => ({ ...item, module, key: `${module.id}:${item.id}` })),
    )
    .filter((f) => !f.done || palomeados.has(f.key))
    // Lo vencido primero; lo demás, en el orden de cada módulo.
    .sort((a, b) => Number(!!b.overdue) - Number(!!a.overdue));
  const pendientes = filas.filter((f) => !f.done).length;
  const { lista, hayMas, medir } = useScrollHint();

  function alternar(fila: (typeof filas)[number]) {
    fila.module.pending.setDone(fila.id, !fila.done, hoy);
    setPalomeados((actual) => new Set(actual).add(fila.key));
  }

  const fecha = parseDateKey(hoy);

  return (
    <section className="pending" aria-labelledby="pending-titulo">
      <header className="pending__head">
        <div>
          <h2 id="pending-titulo" className="pending__title">
            Pendientes
          </h2>
          <p className="pending__date">
            {weekdayName(fecha)}, {dayAndMonth(fecha)}
          </p>
        </div>
        {!cargando && pendientes > 0 && (
          <span className="pending__count" aria-label={`${pendientes} sin hacer`}>
            {pendientes}
          </span>
        )}
      </header>

      {cargando ? null : filas.length === 0 ? (
        <p className="pending__empty">
          <span className="pending__empty-mark">
            <IconCheck />
          </span>
          Todo al día: no tienes pendientes para hoy.
        </p>
      ) : (
        <ul ref={lista} className={`pending__list${hayMas ? ' has-more' : ''}`} onScroll={medir}>
          {filas.map((fila) => (
            <li
              key={fila.key}
              className={`pending-item${fila.done ? ' is-done' : ''}`}
              style={{ '--c': fila.color ?? fila.module.color } as CSSProperties}
            >
              {fila.href ? (
                // Se resuelve en su pantalla (p. ej. escribir el número de hoy).
                <Link to={fila.href} className="pending-item__toggle">
                  <span className="pending-item__box">{fila.done && <IconCheck />}</span>
                  <span className="pending-item__title">{fila.title}</span>
                  {fila.detail && <span className="pending-item__detail">{fila.detail}</span>}
                </Link>
              ) : (
                <button
                  type="button"
                  className="pending-item__toggle"
                  role="checkbox"
                  aria-checked={fila.done}
                  onClick={() => alternar(fila)}
                >
                  <span className="pending-item__box">{fila.done && <IconCheck />}</span>
                  <span className="pending-item__title">{fila.title}</span>
                  {fila.detail && (
                    <span className={`pending-item__detail${fila.overdue ? ' is-overdue' : ''}`}>{fila.detail}</span>
                  )}
                </button>
              )}
              <Link to={fila.module.path} className="pending-item__source">
                {fila.module.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Avisa si la lista tiene más abajo de lo que se ve, para desvanecer su
 * borde inferior (las barras de scroll de macOS solo salen al moverla).
 */
function useScrollHint() {
  const lista = useRef<HTMLUListElement>(null);
  const [hayMas, setHayMas] = useState(false);

  const medir = useCallback(() => {
    const el = lista.current;
    setHayMas(!!el && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  // Después de cada render (cambia la lista) y al cambiar el tamaño de la ventana.
  useLayoutEffect(medir);
  useEffect(() => {
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [medir]);

  return { lista, hayMas, medir };
}
