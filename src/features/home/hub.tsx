// Piezas compartidas por los módulos que se ven como el inicio (English,
// Magenta, Score): enlace para regresar, tarjetas de sección y la pantalla
// de una sección vacía.

import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { IconCheck, IconPrev } from '../../core/ui/icons';
import type { ModuleIconName } from '../../core/ui/ModuleIcon';
import { HomeBar, ModuleBadge } from './HomePage';
import './home.css';

export interface HubSection {
  id: string;
  title: string;
  description: string;
  icon: ModuleIconName;
  color: string;
}

export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="home-bar__back">
      <IconPrev className="ui-icon" />
      {children}
    </Link>
  );
}

/** Contenido de una tarjeta de sección (ícono, título y descripción). */
export function HubCardContent({ section }: { section: HubSection }) {
  return (
    <>
      <ModuleBadge module={section} />
      <span className="home-card__text">
        <span className="home-card__title">{section.title}</span>
        <span className="home-card__description">{section.description}</span>
      </span>
    </>
  );
}

/** Círculo de "hecho hoy" arriba a la derecha de una tarjeta; sin `onToggle` solo muestra el estado. */
export function DoneMark({
  section,
  done,
  onToggle,
  large = false,
}: {
  section: Pick<HubSection, 'title' | 'color'>;
  done: boolean;
  onToggle?: () => void;
  large?: boolean;
}) {
  const clase = `hub-done${done ? ' is-done' : ''}${large ? ' hub-done--large' : ''}`;
  const estilo = { '--c': section.color } as CSSProperties;
  if (!onToggle) {
    return (
      <span className={`${clase} is-static`} style={estilo} role="img" aria-label={`${section.title}: ${done ? 'hecho hoy' : 'falta hoy'}`}>
        {done && <IconCheck />}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={clase}
      style={estilo}
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

/** Pantalla de una sección que todavía no tiene contenido. */
export function EmptySectionPage({ section, back }: { section?: HubSection; back: { to: string; label: string } }) {
  return (
    <div className="home">
      <HomeBar>
        <BackLink to={back.to}>{back.label}</BackLink>
      </HomeBar>
      <main className="empty-module">
        {section ? (
          <>
            <ModuleBadge module={section} large />
            <h1 className="empty-module__title">{section.title}</h1>
            <p className="empty-module__text">Este espacio está vacío por ahora.</p>
          </>
        ) : (
          <p className="empty-module__text">Esta sección no existe.</p>
        )}
      </main>
    </div>
  );
}

/** Pantalla tipo inicio: barra con regreso, tarjeta grande y fila de tarjetas. */
export function HubLayout({ title, big, children }: { title: string; big: ReactNode; children: ReactNode }) {
  return (
    <div className="home">
      <HomeBar>
        <BackLink to="/">Inicio</BackLink>
      </HomeBar>
      <main className="home__main">
        <h1 className="mp-sr-only">{title}</h1>
        {big}
        {children}
      </main>
    </div>
  );
}
