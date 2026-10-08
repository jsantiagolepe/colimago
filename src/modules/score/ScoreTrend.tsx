import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { addDays, dateKey, parseDateKey, relativeDate } from '../../core/dates';
import { series, type ScoreData } from './model';
import { PLATFORMS, type PlatformInfo } from './platforms';

const DIAS = 14;
const ALTO = 72;
const numero = new Intl.NumberFormat('es-MX');

/** Ancho real del elemento, para dibujar la gráfica en píxeles exactos. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

/** Un número redondo arriba del máximo, para la escala (10, 50, 200, 1,000…). */
function techo(max: number) {
  if (max <= 0) return 10;
  const potencia = 10 ** Math.floor(Math.log10(max));
  for (const paso of [1, 2, 5, 10]) if (paso * potencia >= max) return paso * potencia;
  return 10 * potencia;
}

/**
 * Cómo van las descargas y visualizaciones en los últimos 14 días: una
 * gráfica por plataforma (cada una con su escala; Facebook va en otra
 * magnitud) y el cambio contra el día anterior. Solo cuentan los días con
 * todas las apps/páginas anotadas.
 */
export function ScoreTrend({ data, today }: { data: ScoreData; today: string }) {
  const dias = Array.from({ length: DIAS }, (_, i) => dateKey(addDays(parseDateKey(today), i - (DIAS - 1))));
  return (
    <section className="hub-big score-trend" aria-labelledby="score-tendencia">
      <h2 id="score-tendencia" className="score-trend__title">
        Tendencia <span>· últimos {DIAS} días</span>
      </h2>
      <div className="score-trend__charts">
        {PLATFORMS.map((p) => (
          <TrendChart key={p.id} platform={p} days={dias} values={series(data, dias, p.id)} today={today} />
        ))}
      </div>
    </section>
  );
}

function TrendChart({
  platform,
  days,
  values,
  today,
}: {
  platform: PlatformInfo;
  days: string[];
  values: (number | null)[];
  today: string;
}) {
  const [ref, ancho] = useWidth<HTMLDivElement>();
  const [activo, setActivo] = useState<number | null>(null);

  const conDato = values.map((v, i) => [i, v] as const).filter((x): x is readonly [number, number] => x[1] !== null);
  const ultimo = conDato.at(-1);
  const previo = conDato.at(-2);
  const max = techo(Math.max(0, ...conDato.map(([, v]) => v)));
  const paso = days.length > 1 ? (ancho - 8) / (days.length - 1) : 0;
  const x = (i: number) => 4 + i * paso;
  const y = (v: number) => 4 + (ALTO - 8) * (1 - v / max);

  // Tramos de días seguidos con dato; un día sin anotar corta la línea.
  const tramos: string[] = [];
  let tramo = '';
  values.forEach((v, i) => {
    if (v === null) {
      if (tramo) tramos.push(tramo);
      tramo = '';
    } else tramo += `${tramo ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  if (tramo) tramos.push(tramo);
  const sueltos = conDato.filter(([i]) => values[i - 1] == null && values[i + 1] == null);

  let cambio: { texto: string; sube: boolean } | null = null;
  if (ultimo && previo) {
    const dif = ultimo[1] - previo[1];
    const pct = previo[1] ? Math.round((dif / previo[1]) * 100) : null;
    cambio = {
      sube: dif >= 0,
      texto: `${dif >= 0 ? '+' : '−'}${pct === null ? numero.format(Math.abs(dif)) : `${Math.abs(pct)}%`} vs ${relativeDate(days[previo[0]], today).toLowerCase()}`,
    };
  }

  const resumen = conDato.length
    ? `${platform.title}: ${conDato.map(([i, v]) => `${relativeDate(days[i], today)} ${numero.format(v)}`).join(', ')}`
    : `${platform.title}: sin números todavía`;

  return (
    <figure className="trend" style={{ '--c': platform.color } as CSSProperties} data-platform={platform.id}>
      <figcaption className="trend__head">
        <span className="trend__name">
          <span className="trend__dot" aria-hidden="true" />
          {platform.title} · {platform.metric}
        </span>
        <span className="trend__value">
          {ultimo ? numero.format(ultimo[1]) : '—'}
          {ultimo && days[ultimo[0]] !== today && (
            <span className="trend__when"> · {relativeDate(days[ultimo[0]], today).toLowerCase()}</span>
          )}
        </span>
        {cambio ? (
          <span className={`trend__delta${cambio.sube ? ' is-up' : ' is-down'}`}>
            <span aria-hidden="true">{cambio.sube ? '▲' : '▼'}</span> {cambio.texto}
          </span>
        ) : (
          <span className="trend__delta">{ultimo ? 'Anota otro día completo para comparar' : 'Sin días completos todavía'}</span>
        )}
      </figcaption>

      <div className="trend__plot" ref={ref}>
        {ancho > 0 && (
          <svg width={ancho} height={ALTO} role="img" aria-label={resumen}>
            <line className="trend__base" x1={0} x2={ancho} y1={ALTO - 4} y2={ALTO - 4} />
            {activo !== null && <line className="trend__cross" x1={x(activo)} x2={x(activo)} y1={0} y2={ALTO - 4} />}
            {tramos.map((d, i) => (
              <path key={i} className="trend__line" d={d} />
            ))}
            {sueltos.map(([i, v]) => (
              <circle key={i} className="trend__point" cx={x(i)} cy={y(v)} r={4} />
            ))}
            {ultimo && <circle className="trend__point" cx={x(ultimo[0])} cy={y(ultimo[1])} r={4} />}
            {activo !== null && values[activo] !== null && (
              <circle className="trend__point is-active" cx={x(activo)} cy={y(values[activo]!)} r={5} />
            )}
            {/* Zonas para el mouse: una por día, más anchas que la línea. */}
            {days.map((d, i) => (
              <rect
                key={d}
                className="trend__hit"
                x={x(i) - paso / 2}
                y={0}
                width={Math.max(paso, 8)}
                height={ALTO}
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
              />
            ))}
          </svg>
        )}
        {activo !== null && ancho > 0 && (
          <span
            className="trend__tip"
            style={{ left: Math.min(Math.max(x(activo), 60), ancho - 60) }}
            aria-hidden="true"
          >
            <strong>{values[activo] === null ? 'Sin anotar' : numero.format(values[activo]!)}</strong>{' '}
            {relativeDate(days[activo], today)}
          </span>
        )}
      </div>
      <div className="trend__axis" aria-hidden="true">
        <span>{relativeDate(days[0], today)}</span>
        <span>máx. {numero.format(max)}</span>
        <span>Hoy</span>
      </div>
    </figure>
  );
}
