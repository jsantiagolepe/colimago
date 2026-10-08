import { AppMark } from './AppMark';

/** Mientras se lee la sesión del Llavero o se carga un módulo. */
export function SplashScreen() {
  return (
    <div className="splash" role="status" aria-label="Cargando">
      <AppMark size={48} />
    </div>
  );
}
