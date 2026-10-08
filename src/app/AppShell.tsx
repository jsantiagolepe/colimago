import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { SplashScreen } from '../core/ui/SplashScreen';

/**
 * Marco de la parte privada de la app: el inicio (una tarjeta por módulo,
 * ver features/home) y cada módulo, que trae su propia navegación y su
 * forma de volver al inicio.
 */
export function AppShell() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <Outlet />
    </Suspense>
  );
}
