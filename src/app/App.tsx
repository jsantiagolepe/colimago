import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from '../core/auth/AuthProvider';
import { RequireAuth } from '../core/auth/RequireAuth';
import { EmptyModulePage } from '../features/home/EmptyModulePage';
import { HomePage } from '../features/home/HomePage';
import { LoginPage } from '../features/login/LoginPage';
import { modules } from '../modules/registry';
import { AppShell } from './AppShell';

// HashRouter: la app se sirve desde archivos empaquetados (tauri://), así
// que las rutas viven en el hash y recargar nunca da un 404.
export function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              {modules.map((module) => {
                const Modulo = module.component;
                return (
                  <Route
                    key={module.id}
                    path={`${module.path}/*`}
                    element={Modulo ? <Modulo /> : <EmptyModulePage module={module} />}
                  />
                );
              })}
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
