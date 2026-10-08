import { Link } from 'react-router';
import type { AppModule } from '../../modules/types';
import { HomeBar, ModuleBadge } from './HomePage';
import './home.css';

/** Pantalla de un módulo que todavía no tiene contenido. */
export function EmptyModulePage({ module }: { module: AppModule }) {
  return (
    <div className="home">
      <HomeBar>
        <Link to="/" className="home-bar__back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Inicio
        </Link>
      </HomeBar>
      <main className="empty-module">
        <ModuleBadge module={module} large />
        <h1 className="empty-module__title">{module.title}</h1>
        <p className="empty-module__text">Este espacio está vacío por ahora.</p>
      </main>
    </div>
  );
}
