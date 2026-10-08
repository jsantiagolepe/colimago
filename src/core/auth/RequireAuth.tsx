import { Navigate, Outlet } from 'react-router';
import { SplashScreen } from '../ui/SplashScreen';
import { useAuth } from './AuthProvider';

/** Todo lo que cuelga de esta ruta exige sesión iniciada. */
export function RequireAuth() {
  const { status } = useAuth();
  if (status === 'checking') return <SplashScreen />;
  if (status !== 'signedIn') return <Navigate to="/login" replace />;
  return <Outlet />;
}
