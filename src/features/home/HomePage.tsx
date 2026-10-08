import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../core/auth/AuthProvider';
import { AppMark } from '../../core/ui/AppMark';
import { ModuleIcon } from '../../core/ui/ModuleIcon';
import { modules } from '../../modules/registry';
import type { AppModule } from '../../modules/types';
import { PendingCard } from './PendingCard';
import { usePendingSources } from './usePendingSources';
import { useToday } from '../../core/useToday';
import { WeekCard } from './WeekCard';
import './home.css';

/** Barra superior del inicio y de los módulos vacíos. */
export function HomeBar({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth();
  return (
    <header className="home-bar">
      {children ?? (
        <div className="home-bar__brand">
          <AppMark size={26} />
          <span>MyProject</span>
        </div>
      )}
      <div className="home-bar__account">
        {user?.email && <span className="home-bar__email">{user.email}</span>}
        <button type="button" className="home-bar__signout" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

/** Cuadro de color con el ícono del módulo. */
export function ModuleBadge({ module, large = false }: { module: Pick<AppModule, 'color' | 'icon'>; large?: boolean }) {
  return (
    <span
      className={`module-badge${large ? ' module-badge--large' : ''}`}
      style={{ '--module-color': module.color } as CSSProperties}
    >
      <ModuleIcon name={module.icon} className="module-badge__icon" />
    </span>
  );
}

/** Cuántos pendientes de hoy le faltan al módulo (0 cuando terminaste). */
function PendingCount({ module, today }: { module: AppModule; today: string }) {
  const items = module.pending?.items(today);
  if (!items) return null;
  const faltan = items.filter((i) => !i.done).length;
  return (
    <span className={`home-card__count${faltan === 0 ? ' is-zero' : ''}`} aria-label={`${faltan} por hacer hoy`}>
      {faltan}
    </span>
  );
}

/** Lo primero que ves al entrar: los pendientes de hoy, cómo va la semana y una tarjeta por módulo. */
export function HomePage() {
  usePendingSources(); // para que el número de las tarjetas se actualice
  const hoy = useToday();
  return (
    <div className="home">
      <HomeBar />
      <main className="home__main">
        <h1 className="mp-sr-only">Inicio</h1>
        <div className="home-top">
          <PendingCard />
          <WeekCard />
        </div>

        <ul className="home__grid">
          {modules.map((module) => (
            <li key={module.id}>
              <Link to={module.path} className={`home-card${module.component ? '' : ' home-card--empty'}`}>
                <ModuleBadge module={module} />
                {module.showPendingCount && <PendingCount module={module} today={hoy} />}
                <span className="home-card__text">
                  <span className="home-card__title">{module.title}</span>
                  <span className="home-card__description">{module.description ?? 'Vacío por ahora'}</span>
                </span>
                <svg className="home-card__arrow" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
