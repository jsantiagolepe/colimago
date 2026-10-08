import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../core/auth/AuthProvider';
import { saveTextFile } from '../../core/platform/files';
import { fetchColimaGo } from './api';
import { montarDashboard } from './legacy/dashboard';

/**
 * El panel de Colima Go de siempre (JS sin framework, ver legacy/), montado
 * dentro de la app. Pasarlo a componentes de React se puede hacer después,
 * sección por sección, sin tocar el resto de MyProject.
 */
export default function ColimaGoDashboard() {
  const { user, signOut, expireSession } = useAuth();
  const navigate = useNavigate();
  const raiz = useRef<HTMLDivElement>(null);
  const nombre = user?.name ?? 'Administrador';

  useEffect(() => {
    if (!raiz.current) return;
    return montarDashboard(raiz.current, {
      fetch: fetchColimaGo,
      usuario: { nombre },
      cerrarSesion: () => void signOut(),
      volverAlInicio: () => void navigate('/'),
      alExpirarSesion: expireSession,
      guardarArchivo: saveTextFile,
    });
  }, [nombre, signOut, expireSession, navigate]);

  return <div ref={raiz} />;
}
