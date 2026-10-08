import { useState } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../../core/auth/AuthProvider';
import { AppError } from '../../core/tauri';
import { AppMark } from '../../core/ui/AppMark';
import { SplashScreen } from '../../core/ui/SplashScreen';
import './login.css';

function GoogleLogo() {
  return (
    <svg className="login__google-logo" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function LoginPage() {
  const { status, notice, signIn, cancelSignIn, reopenSignIn } = useAuth();
  const [esperando, setEsperando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'checking') return <SplashScreen />;
  if (status === 'signedIn') return <Navigate to="/" replace />;

  async function iniciar() {
    setError(null);
    setEsperando(true);
    try {
      await signIn();
      // Al cambiar el estado de la sesión, esta pantalla redirige sola.
    } catch (err) {
      if (!(err instanceof AppError && err.kind === 'cancelled')) {
        setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
      }
      setEsperando(false);
    }
  }

  function reabrir() {
    reopenSignIn().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }

  return (
    <main className="login">
      <section className="login__panel" aria-labelledby="login-titulo">
        <AppMark className="login__mark" size={64} />
        <h1 id="login-titulo" className="login__title">MyProject</h1>
        <p className="login__subtitle">Tu espacio personal de apps, proyectos y herramientas.</p>

        {notice && !esperando && (
          <p className="login__notice" role="status">
            {notice}
          </p>
        )}

        {esperando ? (
          <div className="login__waiting" role="status" aria-live="polite">
            <span className="login__spinner" aria-hidden="true" />
            <p className="login__waiting-title">Continúa en tu navegador</p>
            <p className="login__waiting-text">
              Abrimos Google en tu navegador. Inicia sesión ahí y MyProject seguirá solo.
            </p>
            <div className="login__waiting-actions">
              <button type="button" className="login__link" onClick={reabrir}>
                Abrir el navegador otra vez
              </button>
              <button type="button" className="login__link" onClick={() => void cancelSignIn()}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="login__google" onClick={() => void iniciar()}>
            <GoogleLogo />
            Continuar con Google
          </button>
        )}

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        <p className="login__fineprint">Solo la cuenta autorizada puede entrar.</p>
      </section>
      <footer className="login__footer">Versión {__APP_VERSION__}</footer>
    </main>
  );
}
